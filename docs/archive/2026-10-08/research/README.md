# Converse and Conclave: consolidated research and citation audit

Compiled October 8, 2026. This is a retrospective of the research recoverable from the local project files and saved Codex/Claude records. It covers the application, the Conclave engine, and their integration. Detailed technical research is predominantly from September 30 through October 8; earlier application material is included where it survives in the files.

**Yes, sources were cited.** They are distributed across archived reports, active technical guides, assistant answers, and web-tool results. The project had no single bibliography connecting those locations. This packet supplies that connection.

Start with this synthesis. Use the [source index](SOURCE_INDEX.md) to recover external links and the exact file/line where they were preserved. The [discovery inventory](ALL_DISCOVERED_SOURCES.json) retains additional leads; [coverage metadata](COVERAGE.json) records the inspected threads and counting method.

For the conceptual thread alone, read [Context and memory: an abridged research synthesis](CONTEXT_AND_MEMORY_IDEAS.md).

## What the audit actually found

| Record | Recovered coverage |
|---|---|
| Project Markdown | 260 files, excluding dependencies, vendored library documentation and generated runtime/smoke directories; 66 contain external URLs before filtering operational addresses |
| Codex records | 29 user-thread traces, 71 guardian traces, and one task-subagent trace |
| Codex web activity | 22 user threads contain 190 recorded orchestration batches invoking the web tool; batches include search, open, find and click operations, sometimes together |
| Claude records | Nine local project traces; two contain six WebSearch and ten WebFetch calls |
| Explicit saved references | 142 distinct external URLs preserved in Markdown or assistant answers, after removing query strings, placeholders, private application addresses and account-console URLs |
| Discovery inventory | 920 distinct recovered external URLs, including the saved references and additional web-result/fetch-request leads |

These are record counts, not counts of independent researchers, unique queries, fully read papers or verified claims. Guardian traces are not separate research contributions. The task subagent was recorded as CLI validation; no separate web-search activity was found in its trace. For 16 of the 22 Codex web-active threads, at least one final answer preserves an external reference after filtering. The six remaining threads are **not** established citation failures: their final responses often report implementation or link local evidence instead of restating the external research.

The index distinguishes `saved_reference`, `surfaced_in_web_result` and `fetch_requested`. A URL in a search result does not establish that the agent opened the page, adopted its findings, or cited it to support a conclusion. A fetch request alone does not establish successful retrieval.

## Research brought together by topic

### 1. The context architecture and its intellectual starting points

The project combines an editable working projection with preserved original sources, lineage and recovery. Its own architecture proposal and CLP material supply much of that design. The copied E2-workspace synthesis contributes ideas about persistent trajectory, multiple memory layers, consolidation, bounded attention and stale memory.

That E2 synthesis is a document review, with theory/design/simulation/preregistered-result tags and a substantial source-path list. It explicitly says it did not verify the code. Its experiments belong to those earlier systems, not to Converse's implementation or measured economics. Some original source paths point outside this workspace and were not independently reopened for this audit.

The external **Context Language Models** paper is a more direct technical reference: it treats context as an editable file and studies model-managed context. The project follow-up explicitly examined its cache accounting and distinguished server-side suffix-cache reuse from a discount available through commercial provider APIs. The paper's benchmark results are not Conclave benchmark results. [Paper](https://arxiv.org/abs/2609.37725), [official implementation](https://github.com/facebookresearch/context-language-models).

Project evidence: [architecture proposal](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-02/docs/Context Layer Architecture.md>), [E2 memory/context synthesis](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-02/external references/MEMORY_AND_CONTEXT_PATTERNS.md>), [CLM-informed follow-up](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-02/docs/NEXT_ITERATION_2026-10-02.md>).

**Citation status:** named internal source documents and explicit CLM paper/repository links survive. The E2 source list needs its original corpus to verify individual upstream claims.

### 2. Token accounting, caching and total cost

Agents researched provider pricing, prompt caching, token-count endpoints and usage normalization. The consequential corrections were that shrinking saved context does not necessarily shrink the next serialized request, a local tokenizer is not provider-reported usage, and cheap cache reads can make an early rewrite more expensive than retaining context.

The October 2 evaluation reports **67.4% less saved working text** across 11 exports. A separate offline reconstruction estimated **13.8% fewer serialized input tokens** over 303 saved requests. Those measure different things. Its bounded paid comparisons found document-task cases where layered context had lower valuation than harness append, while ordinary layered chat could cost more and tool-free plain chat could be cheaper. The report preserves failed trials, unmatched task capabilities, warm-cache ordering and numerical limitations.

The later cost-controller trials compare keeping context, offloading, summarizing and waiting under cache/recovery uncertainty. Their short synthetic comparisons show instrumentation and source recovery; some current-policy arms cost more. They do not establish optimal timing or general production savings.

Historical external references: [OpenAI caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Claude caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). Prices in the reports are dated public-rate valuations, not invoices or a refreshed current price guide.

Project evidence: [dated cost reference](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-02/docs/MODEL_COSTS_2026-10-02.md>), [actual comparison protocol/results](<E:/Coding/converse/converse/docs/archive/2026-10-02/docs/reports/conclave-iteration-2026-10-02.md>), [compaction-cost proposal](<E:/Coding/converse/converse/docs/archive/2026-10-03/compaction-cost-policy.md>), [later bounded trials](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-03/context-cost-controller-v3.md>).

**Citation status:** official sources and local experimental reports are recoverable. Broad cost-saving claims remain unsupported by this evidence.

### 3. Jev, memory selection and automatic reasoning

Jev research covered typed Choice/Score questions, bounded classification, confidence handling and model behavior. The engineering pattern is advisory selection: deterministic code preserves authority, protected content, valid IDs and revisions; the answering model performs semantic rewriting. Jev's confidence is a selection signal, not the factual certainty of the selected text.

The real conversation audits are especially useful negative evidence. The October 5 Pain/Brain review found unsuccessful reranking, sparse automatic capture, repeated retrieval and embedding failures. Subsequent plumbing and passage-selection repairs, native probes and active-memory capture demonstrate corrected paths. They do not establish calibrated recall, general selection benefit or net savings.

A separate Decisions API experiment explored automatic reasoning effort. Small synthetic probes and two completed Context answers establish API access and application wiring. The report keeps the failed low-output-cap trial and states that optimal effort, quality improvement, thresholds and total savings remain unmeasured.

Historical references: [TypeSafe API](https://docs.typesafe.ai/api), [confidence guidance](https://docs.typesafe.ai/confidence), [Jev announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions), [reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning).

Project evidence: [original Jev integration](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-02/docs/JEV_INTEGRATION.md>), [conversation audit](<E:/Coding/converse/converse/docs/archive/2026-10-05/conversation-audit/README.md>), [active Jev evidence](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-05/jev-active-memory.md>), [Auto reasoning evidence](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-06/auto-reasoning.md>).

**Citation status:** explicit official references and local experiments survive. Earlier setup documents describe earlier defaults; their status should not be substituted for the later reports.

### 4. Embeddings and saved-conversation performance

The researched design keeps vectors in Neon/PostgreSQL, combines semantic and lexical retrieval, and binds matches to source/version/chunk/hash provenance. Similarity suggests relevance; it does not decide which instruction or correction is authoritative. Indexing is bounded, and opening a saved chat should not trigger paid embedding calls.

Local profiling showed that a warm row cache still left substantial hydration/view work. This led to direct transcript reads and deferred Workspace loading. The fixtures and local timing results do not measure Neon network latency, production cold starts or a monthly hosting bill.

Historical references: [Neon pgvector](https://neon.com/docs/extensions/pgvector), [pgvector implementation and filtering/index behavior](https://github.com/pgvector/pgvector), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).

Project evidence: [embedding contract and rollout](<E:/Coding/converse/CLA/conclave/docs/EMBEDDINGS.md>), [loading measurements and hosting plan](<E:/Coding/converse/converse/docs/HOSTING_PLAN.md>), [export-performance audit](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-05/export-performance.md>).

**Citation status:** primary documentation is explicitly linked. Claims about production performance require the matching deployed measurements.

### 5. Provider APIs, reasoning, streaming and images

Agents consulted the providers' native contracts for function calls, tool-result continuation, reasoning/thinking, streaming, token counts and images. Much of this research was implementation documentation rather than academic literature.

The key project findings were provider-specific: Claude's signed thinking/continuation must be preserved; effort and thinking settings are separate; native usage buckets need normalization; and image pixels need an immutable recoverable source instead of being silently lost when context is offloaded. Recorded fixtures and live smoke tests establish the particular implemented paths, not general model or vision quality.

Representative references: [OpenAI reasoning](https://developers.openai.com/api/docs/guides/reasoning), [OpenAI streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Claude token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting), [Google usage/API schema](https://ai.google.dev/api/generate-content).

Project evidence: [reasoning integration research](<E:/Coding/converse/converse/docs/archive/2026-10-02/docs/issue-13-reasoning-integration.md>), [controls and token telemetry](<E:/Coding/converse/converse/docs/archive/2026-10-02/docs/reports/control-telemetry-2026-10-02.md>), [native image-upload evidence](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-06/image-uploads.md>).

**Citation status:** supporting API links survive in the reports and the source index; feature-test results are local evidence.

### 6. Web search, full-page retrieval and citation preservation

The first separate-key Brave prototype was superseded after research confirmed OpenAI and Anthropic native search. The native integration records readable findings, returned URLs, query, timestamp, provider/model and limitations in canonical source documents. Native citation annotations are converted to Markdown where spans are available, while opaque provider blocks remain in the inference audit. Working/tool views can truncate the immediate result; the saved source preserves the full returned list.

This answers a second possible meaning of the citation question: **Converse was deliberately built to retain search citations.** The inspected engine still has citation extraction and source-storage code. That does not prove every later final answer cited every relied-on source. The specific native live smoke and fixtures support the storage mechanism; an answer-level citation audit would inspect each conversation's actual searches and final claims.

Historical references: [OpenAI native search](https://developers.openai.com/api/docs/guides/tools-web-search), [Claude native search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

Project evidence: [native search implementation and live smoke](<E:/Coding/converse/converse/docs/archive/2026-10-03/native-web-search.md>), [current citation extraction/storage](<E:/Coding/converse/CLA/conclave/src/web-search.js:53>).

**Citation status:** explicit official sources, returned-source metadata and adapter evidence survive. Search-derived summaries are not independently verified full-page text, and tool charges are not included in token-only cost estimates.

### 7. Neon authentication and Safari

Claude's traces preserve research on Neon Auth's flow, OAuth setup, production configuration and server middleware, followed by searches/fetches on Safari redirect-cookie behavior. Its final Safari response explicitly cites three WebKit bugs and Neon troubleshooting. Codex's later review checks the proposed mechanism against Neon middleware and adds an email-code fallback.

The important distinction is that a related browser bug is a plausible lead, not a diagnosis of the friend's unobserved failure. The later report notes that an earlier iPhone-size test used Chromium, then separately records fixture WebKit coverage and the remaining real-phone/email/deployment checks.

Recovered references: [Neon authentication flow](https://neon.com/docs/auth/authentication-flow), [OAuth setup](https://neon.com/docs/auth/guides/setup-oauth), [Neon middleware](https://github.com/neondatabase/neon-js/blob/main/packages/auth/src/server/middleware/oauth.ts), [WebKit 208049](https://bugs.webkit.org/show_bug.cgi?id=208049), [219650](https://bugs.webkit.org/show_bug.cgi?id=219650), [306194](https://bugs.webkit.org/show_bug.cgi?id=306194).

Project evidence: [plain-language setup](<E:/Coding/converse/converse/docs/HOSTED_CONTEXT.md>), [review of Claude's approach and fallback evidence](<E:/Coding/converse/converse/docs/archive/2026-10-06/safari-sign-in-review.md>). Claude trace `e80d2a1a-8a06-4241-8d86-12118244f6f6`, line 1079, contains the explicit source list; its location is linked in the index.

**Citation status:** Claude's source list and the subsequent cross-check are recoverable. The original Safari cause remains unestablished by those reports.

### 8. MCP, plugins, UI and cross-app handoffs

This is the best-developed consolidated external research trail. The October 7 plan cites protocol architecture, transport/authentication, SDK compatibility, client setup and distribution requirements. It distinguishes a host choosing when to call a tool from guaranteed automatic transcript capture. It also distinguishes Gemini CLI/API support from consumer Gemini chat support.

Later research covers local/hosted configuration, Secure MCP Tunnel, MCP Apps UI and plugin packaging. The plan discusses a newer protocol revision, while the actual initial implementation reports testing `2025-11-25`; those are different evidence statements and should remain dated. Platform docs alone are not compatibility tests.

The hosted account-roundtrip report provides stronger project evidence: four durable ChatGPT/Claude-labeled revisions, consecutive lineage and exact original-constraint preservation, combined with the user's real-app test. Client-supplied app/model labels remain unverified authorship metadata. Broader compatibility, independent revocation and all real UI surfaces remain separate acceptance questions.

Representative references: [MCP architecture](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture), [implemented-revision tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [OpenAI custom MCP](https://developers.openai.com/api/docs/guides/custom-mcp-server), [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/), [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx).

Project evidence: [original research plan](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-07/mcp-connector-plan.md>), [platform UI research](<E:/Coding/converse/CLA/conclave/docs/PLUGIN_UI.md>), [coding integrations](<E:/Coding/converse/CLA/conclave/docs/CODING_INTEGRATIONS.md>), [local ChatGPT evidence](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-07/chatgpt-local-tunnel.md>), [real hosted round trip](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-07/hosted-account-roundtrip.md>).

**Citation status:** extensive explicit primary references and distinct implementation/live-account evidence survive.

### 9. Hosting and independent Conclave deployment

Research examined Vercel's function accounting, connection pooling and request limits, then Railway's persistent-service/MCP/Express hosting. The product direction became an independent Conclave interoperability service with its own Neon identity/database, while preserving the Converse integration.

The resulting release reports distinguish research, fixtures, published source, public health/OAuth checks and actual account tests. A Railway deployment does not itself prove lower total cost than Vercel; no matched monthly-cost comparison was found. Earlier documentation-only auto-deploy observations are superseded by the October 8 successful runtime-push evidence.

Historical references: [Vercel usage/pricing](https://vercel.com/docs/functions/usage-and-pricing), [connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions), [Railway MCP hosting](https://docs.railway.com/guides/mcp-server), [Railway Express hosting](https://docs.railway.com/guides/express).

Project evidence: [hosting efficiency plan](<E:/Coding/converse/converse/docs/HOSTING_PLAN.md>), [independent pilot](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-07/hosted-independent-pilot.md>), [October 8 release/automatic-deployment evidence](<E:/Coding/converse/CLA/conclave/docs/archive/2026-10-08/mobile-consent-return.md>).

**Citation status:** some hosting sources lived mainly in chat answers/tool results; the index now points back to those records as well as the technical guides.

## Papers recovered as leads, rather than established project findings

These titles appeared in the historical caching/cost web results. Except for the CLM paper above, this audit did not find them developed into a cited project conclusion in the saved Markdown. Their presence is useful for recovering the research trail, not for asserting their results.

| Recovered paper | Historical location | Audit status |
|---|---|---|
| [Don't Break the Cache: An Evaluation of Prompt Caching for Long-Horizon Agentic Tasks](https://arxiv.org/abs/2601.06007) | October 3 cost-controller thread, result at line 33 | Search-result lead; paper title/abstract reopened October 8. The abstract studies provider-dependent cache strategies; its reported results are external benchmark evidence. |
| [Cache-Aware Prompt Compression: A Two-Tier Cost Model for LLM API Caching](https://arxiv.org/abs/2607.15516) | Same result batch | Recovered lead; not freshly validated |
| [Keeping the Cache Warm Pays: Keepalive Economics for Agentic Workloads](https://arxiv.org/abs/2607.19214) | Same result batch | Recovered lead; no project adoption of keepalive established |
| [Auditing Prompt Caching in Language Model APIs](https://arxiv.org/abs/2502.07776) | Same result batch | Recovered lead; not freshly validated |
| [ContextCache: Context-Aware Semantic Cache for Multi-Turn Queries in Large Language Models](https://arxiv.org/abs/2506.22791) | October 2 cost/tokenization thread, result at line 141 | Recovered lead; not freshly validated |

The discovery inventory includes other papers and many incidental forum/search results. They were not used to support this synthesis. This is not evidence that the project performed a systematic literature review of MemGPT/Letta, Mem0, Zep or every alternative memory system.

## Research inside application test workloads

The repository also preserves subject-matter research generated or imported during application experiments. For example, the [Multnomah County homelessness research packet](<E:/Coding/converse/converse/docs/archive/2026-10-02/docs/comparisons/baseline-2026-10-02T23-21-32-534Z/reference-artifacts/multnomah_county_homelessness_research_packet.md>) has claim-adjacent source blocks linking county reports, public budgets and Portland resolutions. It is a sourced input/reference artifact for the policy workload.

Those sources are indexed, but their substantive policy claims were not rechecked here. Brain, pain, Neo and propulsion discussions are likewise application workloads; their existence is not external validation of the context engine. A future audit of one such conversation should pair its actual tool results with its final claims rather than infer correctness from a generated report.

## Citation gaps and practical limits

1. **No complete claim-to-source mapping existed.** Recovering a URL is easier than establishing which exact sentence it supports. This synthesis maps the main findings to sources; the inventory is not a blanket endorsement of every historical claim.
2. **Search visibility was sometimes stronger than citation visibility.** Several papers survived only in web-result records. They are now labeled as leads instead of being silently promoted into the bibliography's conclusions.
3. **Historical relative links can be broken by archiving.** The old Markdown was preserved with its original paths. This packet links the currently existing archive locations and exact trace lines.
4. **Reported measurements need their protocol.** Saved characters, locally tokenized requests, provider usage, public-rate valuation, actual billed cost and production latency are different measurements. The experiments' qualifications are part of the findings.
5. **Old status text can be superseded.** Early setup/proposal documents still say work is pending or describe older defaults. Later dated evidence and current project state must be consulted before treating those statements as current.
6. **Coverage is local and bounded.** This pass did not enumerate every historical Git revision, remote-only/deleted session, hosted handoff or ChatGPT conversation, nor comprehensively inspect shell-based URL fetches and every vendor connector lookup. It did not copy private transcripts into the research packet.

On October 8, this audit reopened the CLM abstract, its official repository, the Don't Break the Cache abstract and the Jev announcement page. That spot check confirms access to those selected references; it does not refresh every price, protocol claim or cited result. The remaining external references are recovered historical links.

The useful project-level result is a recoverable evidence trail: architecture and platform decisions have substantial citations; performance and economic benefit are supported by bounded experiments with explicit limits; some broader claims and literature leads still need stronger verification.
