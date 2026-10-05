# Jev, memory and long-conversation repairs

Implemented 2026-10-05 in Conclave first. Converse owns the dedicated Workspace UI. The original two supplied conversation exports remain unchanged and untracked in Converse.

## Behavior

- Retrieval v4 asks whether a passage supplies useful information rather than dividing relevance among four overlapping categories. The 0.65 confidence threshold remains unchanged. Uncertain sources keep their deterministic relative order; only confident positive evidence permits a changed selection. Query-centered excerpts include source identity and exact UTF-16 ranges. Fitting shortens passages across the complete shortlist; if even the minimum cannot fit, it skips before spending. Two related fallbacks on unchanged evidence trigger a two-minute cooldown; a different query/evidence set and cached decisions remain eligible.
- `search_source` searches one known original source, excludes removed/suppressed/superseded sources, and returns exact ranges without a paid selector. Retrieval decisions record baseline, selected IDs, actual supplied candidates, confidence, errors, cost-gate estimates, reuse and explicit outcomes.
- Claude restarts preserve pending tool observations not yet supplied in a completed answer request. Already delivered receipts become historical excerpts. Byte fitting pages fresh content with an exact `next_offset`; full canonical receipts survive. Answer request telemetry records supplied source ranges and explicitly does not claim the model read or verified them. Signed native prefixes are not rewritten.
- Memory v3 considers a previous completed research answer on the next human turn after three source/file reads, or when the human asks to save findings. One bounded extraction allowance is shared with human candidate extraction. Exact assistant spans remain unresolved `model_proposed` candidates. Partial/suppressed output is excluded; capture commands are not commitments. Zero-result checks, paid extraction and admitted counts are explicit.
- Controller history is a synchronous read-only projection. It omits obsolete signed/native output and checkpoints while retaining the latest matching request intact for native-prefix comparisons, source identity and scalar usage. Its load is included in the existing processing guard. Canonical history, checkpoints and export fidelity are unchanged; cost-only mutations remain in shadow mode.
- Wrapped PostgreSQL schema/auth/permission failures retain SQLSTATE and trigger a two-minute conversation cooldown across harness instances. The configured Converse database was missing `conclave.embeddings`; its existing migration was applied and a direct SQL read verified that table and the vector extension.

## Evidence

The final bounded native probe covers two historical decisions and one synthetic positive control: [Jev probe](jev-probe.json). Both historical decisions previously fell back; v4 yielded five and six confident useful judgments respectively. Their top-four selection stayed unchanged. The synthetic control moved the answer source from sixth to first. These are relevance/coverage checks, not proof of improved long-form answers, factual correctness or billed savings. Calls reported 5,789 input / 627 output tokens in total. The production threshold was not lowered.

The offline export replay retains every original event and snapshot: [profile](export-profile.json). Brain completed in 0.361 seconds; Pain in 1.439 seconds including hydration/build/serialization. Controller projection sizes were 4.55 MB and 4.70 MB versus canonical histories of 9.23 MB and 58.75 MB. Both shadow evaluations completed in this recorded run (128 ms / 185 ms) under the 200 ms cooperative guard. Timing remains workload/machine dependent; production download latency is unmeasured.

Source validation: 239 checks passed, one optional export fixture skipped. Dedicated regressions cover complete Jev candidate coverage, confidence gating, cache-disabled fallback behavior, cooldown reset, fresh evidence and exact paging, suppression, native-prefix preservation, automatic episode capture, unknown usage and telemetry pagination. Converse validation and browser results are recorded in its companion repair report.

## Reproduce

```powershell
node scripts/replay-jev.js <saved-export.json> --output=jev-probe.json
node scripts/replay-jev.js <saved-export.json> --live --output=jev-live-probe.json
node scripts/profile-export.js <brain-export.json> <pain-export.json> --shadow --output=export-profile.json
```

The replay is offline by default; `--live` makes at most three native Jev calls. It never replays task answers or changes original exports. More representative relevance labels, episodic consolidation, paid-review usefulness, source recovery/entailment, production latency, and matched long-form task economics still require measurement.
