# CLAMP 1.0: bounded Clyps

CLAMP means **Context Layer and Memory Protocol**. A **Clyp** is one bounded
continuation handoff; **Clypping** is saving it for another model or app.
This is Conclave's initial versioned profile, not an externally adopted standard.
The dashboard and model handoffs are the first surfaces; Obsidian is a possible later client.

## Contract

Use `save_handoff` with the existing packet sections and this profile:

```json
{
  "packet": {
    "title": "CLAMP dashboard",
    "summary": "The bounded profile is implemented locally; release is pending.",
    "objective": "Verify continuation in a second connected model.",
    "constraints": ["Keep the existing handoff history available."],
    "open_questions": ["Does the receiving model need any supporting source?"],
    "next_steps": ["Retrieve this Clyp in another app and inspect the returned constraints."],
    "project": "Conclave",
    "clamp": { "version": "1.0", "kind": "clyp", "links": [] }
  },
  "request_id": "clamp-first-save"
}
```

`title`, `summary` (current state), nonempty `objective`, and at least one
`next_steps` item are required. Decisions, constraints, unresolved questions,
context and references use the existing fields. Keep the core self-contained
enough to choose the next action; links supply supporting detail.

- Aim for 500–1,000 tokens. The server rejects a complete ORMD document above
  **1,500 o200k_base tokens**, including metadata, headings, links and prose.
  This is a reproducible document limit, not a provider's billed token count;
  transport instructions/framing and separately retrieved documents are excluded.
- Each section list has at most 8 items, and there are at most 6 typed links.
  Existing per-field and 64 KB packet guards also apply.
- Overflow rejects the entire transaction. Narrow the objective or move
  supporting detail to a referenced source. Never silently remove an essential
  constraint or unresolved question to fit.
- Reads always return the complete Clyp; `focus` does not shorten it.
- Source/model labels, confidence and relationships are reported claims. Saving
  a Clyp never promotes its contents into authoritative human memory.
- Updates require `expected_revision` and retain the CLAMP profile. Identical
  retries reuse `request_id` and return the originally committed receipt.

Legacy packets remain readable and retain their old hashes/limits. Explicitly
adding the profile on a later revision adopts CLAMP without rewriting history.

## Readable references

Each handoff returns a stable `readable_id` such as `dashboard-planning--2`.
The name comes from the original title; a short account-local event number
distinguishes duplicate titles. A title change keeps the existing reference.
Titles without Latin letters/digits use `conversation--N`. References identify
handoffs within the signed-in account, not across unrelated accounts or stores.

Use `readable_id` as `handoff_id` in saves, reads, history, comparisons and
revision-pinned links. Save receipts also return it as `reference`. The canonical
`conv_…` value remains in `handoff_id` for compatibility and audit; both forms
resolve to the same packet. Links are normalized to canonical IDs before saving
and hashing. Readable references do not change existing packet/document bytes.
Legacy names derive from the first saved packet without rewriting its events.

The dashboard shows/copies the readable reference, includes the current title
in continuation text, names exported files, and uses it in fragment URLs.
Old canonical-ID bookmarks still open and become readable URLs. Backups restored
as fresh handoffs receive fresh references; original cross-handoff links retain
their original canonical identities.

## Relationships and graph

An optional link is `{relation, handoff_id, revision}`. Retrieve the target first;
both ID and positive revision are required. Approved relations read as
"this Clyp [relation] that saved revision": `continues`, `depends_on`, `supports`,
`conflicts_with`, and `supersedes`. Targets must exist in the same account.
Duplicate links and self-links are rejected. Ordinary revision lineage is separate.

The dashboard's Connections view draws explicit reported links only. Nodes show
latest titles/project membership; edge buttons open the precise saved revisions.
Filtering by project includes one boundary hop to directly linked targets in
other projects, without loading those targets' outgoing links or content.
Graphs above 100 nodes fail explicitly; choose a smaller project rather than
displaying an incomplete graph. There is no automatic link traversal or inference.
Projects currently use exact names, as existing handoffs do; independent project
and idea identities are future work.

## ORMD storage and reading

New Clyp events store the complete UTF-8 ORMD document in immutable event
`content`, and its normalized structured packet in metadata in the same
transaction. The packet is an index for existing search/history/comparison APIs.
The source document has its own SHA-256; existing packet SHA-256 receipts remain
available. PostgreSQL JSONB key ordering does not change either checksum.

The document uses `<!-- ormd:1.0 -->`, YAML frontmatter with JSON flow values,
and readable Markdown sections. It preserves `frame`, declared `lineage`,
`policy`, `semantics`, and `resolution`. Policy metadata describes intended
scope; actual access is enforced by the existing account/OAuth checks.
Unknown confidence stays `null`. CLAMP's handoff profile is distinct from the
existing [CLP evidence broker](CLP_BROKER.md); its confidence field does not
establish evidence thresholds or calibrated certainty.

Use `get_handoff({handoff_id, revision, format:"ormd"})` to retrieve original
document bytes. Default packet reads remain compatible and include Clyp budget
and document checksum metadata. The dashboard offers Export ORMD and displays
the complete-document count. Models submit structured fields; the server writes
ORMD, so they need not compose YAML.

Existing local backups preserve normalized packet histories. Clyp imports assign
fresh IDs and regenerate bounded ORMD with declared, unverified import lineage;
their original packet hashes survive but original document hashes do not.
External link IDs are retained, not remapped or fetched. Missing targets remain
unresolved and are omitted from the graph. This is an explicit backup restore,
not an arbitrary ORMD editing/import round trip.

## Scope of this increment

Implemented: bounded profile, immutable ORMD revisions, structured model save
and document read, dashboard token counts/export and explicit connections.
Deferred: arbitrary ORMD import/editing, durable-memory promotion, stable
independent idea/project IDs, dependency closure beyond one boundary hop, and
live ChatGPT/Claude acceptance. Local tests establish storage and transport
behavior; continuation quality and useful budget ranges require real trials.

The [ChatGPT ↔ Claude pilot](CLAMP_PILOT.md) includes a synthetic seed, three
copyable prompts, acceptance checks and an independent-client local rehearsal.
