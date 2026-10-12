import { hash } from './store.js';
import { validateHandoff } from './handoffs.js';
import { renderClyp, assertClypBudget, documentHash } from './clyps.js';

export const MAX_HANDOFF_BUNDLE_BYTES = 8 * 1024 * 1024;
const fail = message => { throw Object.assign(Error(message), { code: 'invalid_input' }); };
const fields = (value, allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key)))
    fail('Invalid handoff backup fields');
};
const isoDate = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)
    fail('Use a valid UTC timestamp in the handoff backup');
  return value;
};

function backupDocument(entry, sourceId) {
  if (!entry.packet.clamp) return null;
  // Version 1 never saved original document bytes or previous event IDs.
  // Reconstruct source identity with unknown previous lineage, never random
  // destination IDs. Actual import lineage lives in event metadata.
  if (entry.ormd === undefined) return renderClyp(entry.packet, {
    handoff_id: sourceId, revision: entry.revision, previous_event_id: null,
  });
  if (typeof entry.ormd !== 'string' || entry.ormd_sha256 !== documentHash(entry.ormd))
    fail('Backup document checksum mismatch');
  let lineage;
  try { lineage = JSON.parse(/^lineage: (.+)$/m.exec(entry.ormd)?.[1]); } catch { fail('Invalid backup document lineage'); }
  const origin = typeof lineage?.origin?.uri === 'string' && lineage.origin.uri.match(/^urn:conclave:(conv_[a-zA-Z0-9_-]+)$/)?.[1];
  if (!origin || lineage.origin.revision !== entry.revision ||
    !(lineage.previous_event_id === null || typeof lineage.previous_event_id === 'string' && /^evt_[a-zA-Z0-9_-]+$/.test(lineage.previous_event_id)) ||
    entry.ormd !== renderClyp(entry.packet, { handoff_id: origin, revision: entry.revision, previous_event_id: lineage.previous_event_id }))
    fail('Backup document does not match its packet and lineage');
  return entry.ormd;
}

// Checksums detect corruption, not who authored a packet. Validate the whole
// bundle before opening a write transaction or accepting any imported claim.
export function validateHandoffBundle(input) {
  if (Buffer.byteLength(JSON.stringify(input) || '') > MAX_HANDOFF_BUNDLE_BYTES) fail('Handoff backup exceeds 8 MiB');
  fields(input, ['format', 'schema_version', 'exported_at', 'source_handoff_id', 'revisions']);
  if (input.format !== 'conclave-handoff' || ![1, 2].includes(input.schema_version)) fail('Unsupported handoff backup format');
  if (typeof input.source_handoff_id !== 'string' || !/^conv_[a-zA-Z0-9_-]+$/.test(input.source_handoff_id)) fail('Invalid source handoff ID');
  if (!Array.isArray(input.revisions) || !input.revisions.length || input.revisions.length > 1000) fail('Backup must contain 1–1000 complete revisions');
  const revisions = input.revisions.map((entry, index) => {
    fields(entry, ['revision', 'saved_at', 'sha256', 'packet', ...(input.schema_version === 2 ? ['ormd', 'ormd_sha256'] : [])]);
    if (entry.revision !== index + 1) fail('Backup revisions must be complete, contiguous and oldest first');
    const packet = validateHandoff(entry.packet);
    if (entry.sha256 !== hash(packet)) fail('Backup checksum mismatch; no packets were imported');
    if (input.schema_version === 2 && packet.clamp && typeof entry.ormd !== 'string') fail('Clyp backups require their complete document');
    if (!packet.clamp && (entry.ormd !== undefined || entry.ormd_sha256 !== undefined)) fail('Legacy packets have no ORMD document');
    const normalized = { revision: entry.revision, saved_at: isoDate(entry.saved_at), sha256: entry.sha256, packet,
      ...(entry.ormd !== undefined ? { ormd: entry.ormd, ormd_sha256: entry.ormd_sha256 } : {}) };
    const ormd = backupDocument(normalized, input.source_handoff_id);
    if (ormd) assertClypBudget(ormd);
    return normalized;
  });
  return { format: input.format, schema_version: input.schema_version, exported_at: isoDate(input.exported_at),
    source_handoff_id: input.source_handoff_id, revisions };
}

export function exportHandoffBundle(service, handoff_id) {
  return service.store.atomic(() => {
    const first = service.history({ handoff_id, limit: 1 });
    if (first.total > 1000) throw Object.assign(Error('Handoff has more than 1000 revisions; this backup format cannot include it completely'), { code: 'capacity' });
    const revisions = [];
    for (let revision = 1; revision <= first.total; revision++) {
      const saved = service.get({ handoff_id, revision, max_characters: 128000 });
      const doc = saved.packet.clamp ? service.get({ handoff_id, revision, format: 'ormd', max_characters: 128000 }) : null;
      revisions.push({ revision, saved_at: saved.saved_at, sha256: saved.sha256, packet: saved.packet,
        ...(doc ? { ormd: doc.ormd, ormd_sha256: doc.clyp.ormd_sha256 } : {}) });
    }
    return validateHandoffBundle({ format: 'conclave-handoff', schema_version: revisions.some(r => r.packet.clamp) ? 2 : 1, exported_at: new Date().toISOString(),
      source_handoff_id: first.handoff_id, revisions });
  });
}

// Local-only explicit import: new IDs/events, unchanged packet hashes and
// external-data authority. Never restore sessions, tokens, actor or ownership.
export function importHandoffBundle(service, input) {
  const bundle = validateHandoffBundle(input);
  // Preserve the version-1 deduplication identity across format upgrades.
  const importId = hash({ source_handoff_id: bundle.source_handoff_id,
    revisions: bundle.revisions.map(({ ormd, ormd_sha256, ...entry }) => entry) });
  return service.store.atomic(() => {
    for (const row of service.store.list()) {
      const events = service.store.events(row.conversation_id).filter(event => event.kind === 'handoff_packet');
      const previous = events.findLast(event => event.metadata.import_id === importId);
      if (previous) return { ...service.receipt(previous, true), imported_revisions: bundle.revisions.length };
    }
    const handoff_id = service.store.create(bundle.revisions[0].packet.title);
    let previous;
    for (const entry of bundle.revisions) {
      const ormd = backupDocument(entry, bundle.source_handoff_id);
      previous = service.store.append(handoff_id, 'handoff_packet', ormd || JSON.stringify(entry.packet), {
        schema_version: 1, packet: entry.packet, revision: entry.revision, previous_event_id: previous?.id || null,
        ...(ormd ? { format: 'ormd', ormd_sha256: documentHash(ormd),
          document_origin: entry.ormd !== undefined ? 'preserved_backup' : 'reconstructed_v1_backup' } : {}),
        import_id: importId,
        provenance: { channel: 'external_handoff', authority: 'external_data', author_claims_verified: false,
          imported_from: { handoff_id: bundle.source_handoff_id, revision: entry.revision,
            saved_at: entry.saved_at, sha256: entry.sha256, claims_verified: false,
            ...(ormd ? { document_preserved: entry.ormd !== undefined } : {}) } },
      }, 'external');
    }
    return { ...service.receipt(previous, false), imported_revisions: bundle.revisions.length };
  });
}
