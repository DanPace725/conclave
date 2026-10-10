# Graph pinch, pan and fit

Resumed hosted Clyp `mobile-graph-ui-zoom-and-fit-improvements--45`, canonical ID `conv_ff63af88-fdc7-4ae7-949e-d0f937216996`, revision 1 (complete ORMD, no omitted context). It records a user screenshot confirming graph rendering in ChatGPT Android but clipped nodes and unavailable pinch zoom. The current request authorizes implementation. No deployment is requested.

## Change

The shared dashboard/MCP App renderer now uses an SVG camera fitted to the visible canvas with padding. Added +, −, Fit, a zoom readout relative to fit, drag panning, native two-pointer pinch/pan, Ctrl/Command wheel zoom, and canvas keyboard navigation. Zoom is bounded to 50–800% of fit. ResizeObserver maintains the viewport aspect ratio and relative zoom through narrow layouts and iframe/fullscreen resizing; removed graphs disconnect their observer.

Node taps and Enter/Space preserve latest-revision navigation; linked-revision buttons still use the pinned revision. Pointer movement suppresses accidental node activation after a drag. Keyboard focus reveals an offscreen node. The camera makes no tool calls, requires no server-tool permission, and works in a view-only host. The MCP App preserves zoom-limit button states through its existing busy/capability updates. The compiled content-hashed resource is regenerated.

## Validation

- Conclave suite: 373 passed, one optional skip. Syntax and compiled-resource checks pass.
- Dashboard: all 12 desktop/mobile Edge cases pass, including initial containment, button/keyboard zoom limits, mouse drag without node activation, native CDP two-touch pinch and two-finger pan, 320px resize, focus recovery, and a subsequent mobile node tap.
- Embedded MCP App: 13 of 14 suite cases passed initially, including both new camera cases through the actual SDK bridge and sandboxed iframe. Fullscreen expansion resets to fit, local camera operations produce no tool calls, and subsequent keyboard node navigation reads a packet. Existing graph/pinned-revision/view-only cases pass. An existing mobile recovery case raced its search response; added the same one-result wait already used by the packet helper before selecting its unique result, then both desktop/mobile recovery cases passed on rerun. Three final UI-resource checks pass after the last bundle regeneration.
- Browser launches fail in the filesystem sandbox; the successful Edge runs use approved execution outside it. Screenshots are local synthetic fixtures, including `.conclave/dashboard-test-results/dashboard-graph-fits-zooms-40522-hout-losing-node-navigation-mobile/graph-fit.png`.

## Limits

Real ChatGPT Android, real mobile dashboard and native Safari gestures remain unverified. The host may intercept touch events; the explicit buttons and linked-revision list remain alternatives. Existing host-capability fullscreen support is reused. The initial fit applies to the displayed graph; an inline preview still discloses its eight-linked-node bound. No account data, schema, model calls, hosted packet writes, push or deployment changes.

## Authorized main publication

The user subsequently requested main publication and explicitly selected Conclave main only after reviewing that Converse main lacks the earlier integration prerequisites. Implementation `5798362` was merged into current Conclave main (`e6c6c46`) as `2f80305`; that merge has exactly the tested feature tree. Converse snapshot `b77c121` remains local on `codex/clyp-graph`. The separate user AGENTS.md edit was preserved and restored byte-for-byte in Git's comparison, excluded from this batch. The main push receipt and any observed automatic Railway deployment are recorded separately in the hosted progress log; no Railway configuration or explicit deployment action is needed for the requested Git publication.
