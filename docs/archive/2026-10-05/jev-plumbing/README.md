# Jev plumbing and publication exports — 2026-10-05

The original [evaluation report](../../../../memory-selection-eval/REPORT.md) found that four-way kind confidence rejected many correct keep judgments. Its post-hoc keep-probability simulation is a lead, not fresh quality evidence. The [interpretation](../../../../memory-selection-eval/interpretation.md) identified confidence targeting, event-level fallback, repeated prompt text and passage exclusions.

## Implemented

- Jev memory v2 gates on the binary keep/skip distribution: keep probability is 1 minus skip probability. A passage is uncertain when neither side meets the configured threshold. Kind is the highest-probability non-skip kind and kind uncertainty is recorded separately. Selection confidence never becomes factual confidence.
- Shared task/rules reduce repeated instructions; per-question criteria remain required by the typed API. Immediate human requests are skips; only explicitly unresolved/deferred issues are durable questions. Evidence limitations belong with findings. Exact duplicate checks replace substring checks, which could discard a new qualification.
- Memory policy v5 offers complete paragraphs throughout the source, up to 8,000 characters per paragraph. Assistant quotations, citations and inline code are data; human quoted instructions remain excluded. Coverage receipts expose omitted oversized spans. Oversized paragraphs are preserved canonically; there is no claim of universal ingestion coverage.
- Task extraction batches complete passages under its 12,000-byte guard and 600-token reserve, up to eight calls per selected source. One source selection per turn and a global eight-record cap remain. Excess complete coverage is deferred explicitly. Source-local IDs are validated with a map, including sparse fallback IDs.
- Opt-in `CONCLAVE_MEMORY_SELECTOR=jev-hybrid` merges confident Jev choices with task-model extraction of uncertain/oversized items only. A Jev failure falls back to the eligible passages; Stop remains authoritative. No second shadow call is made in hybrid mode. Proposal/applied events, per-record selector/model attribution and paged Jev telemetry distinguish decisions from committed unresolved candidates.
- Default remains task-model extraction with a Jev shadow. Promoting the hybrid requires fresh labeled evaluation; this patch does not claim improved recall or cost savings.

## Publication boundary

Canonical storage, audit exports and backups stay exact. Shareable copies redact recognizable Google/provider/AWS keys, bearer/JWT/private-key material, credential fields, credential assignments, URL credentials and signatures. Patterns are conservative heuristics, not a comprehensive secret/PII guarantee. Copies carry a sanitization receipt and explicitly cannot validate original hashes/offsets.

Use `node src/cli.js export PATH --conversation ID --sanitize`, `node src/cli.js download PATH --conversation ID --sanitize`, service `shareableExport`, HTTP `action=shareable_export`, or `sanitize=1` on export/download. The labeled-evaluation generator sanitizes outputs automatically. `node scripts/sanitize-artifacts.js --check FILE_OR_FOLDER` exits nonzero on matches without displaying values; `--write` redacts publication artifacts, including malformed JSON excerpts. Source checks now scan the evaluation folder.

The Google Maps key was removed from the live heat-pump publication export and the user's saved API-key excerpt. Both repositories' tracked JSON/JSONL/Markdown/HTML/text files were scanned: no remaining pattern matches after fixing placeholder and JSON-LD false positives. One historical revision of the live export still contains the key; published history has not been rewritten and no third party has been contacted.

## Verification

Seven added offline regressions cover binary confidence, sparse item-only fallback, no unnecessary task-model call, failure/Stop, complete late quoted findings, batching/invalid IDs, redaction/idempotence and canonical/service/HTTP separation. Source suite and syntax checks run before migration; exact totals are recorded in the completion receipt.

The [native format probe](native-format-probe.json) made one synthetic call to Jev 1.13.0 (802 reported input tokens, 146 output tokens). It accepted shared rules and selected a preference and qualified finding while skipping a transient question. This validates request format, not quality or whole-task economics. No fresh corpus labels or frontier-model comparison were run.
