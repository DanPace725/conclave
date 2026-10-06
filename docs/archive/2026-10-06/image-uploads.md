# Context and Agent image sources

Implemented native JPEG/PNG input in the shared Conclave engine. Saved image sources keep exact processed pixels with immutable IDs; canonical requests and Agent checkpoints contain compact references. Native pixels are recovered at the model boundary and across service restarts. Older images are available through `view_image`, with a fresh projection for signed Claude continuations. Transcript and thumbnail reads avoid repeated binary transfer. No database migration is needed.

Local verification: seven image regressions passed; full source suite **292 passed, one optional skip, zero failures**; syntax and credential-artifact checks passed. Hosted persistence was tested against PGlite through fresh HTTP repository instances, including authenticated reads, cross-conversation rejection, removal and follow-up recovery. These are fixture/provider-adapter checks, not evidence of live model vision quality or production performance.

The first suite run exposed a fixed-budget text-only demo regression from adding the image schema to every request. The final implementation exposes that tool only when eligible images exist; the unchanged text-only demo passes. Image accounting uses an explicitly uncalibrated reserve instead of tokenizing base64. Full details: [contract](../../IMAGES.md).
