# Interrupting Agent Stop

Stop previously waited for the current browser-driven step and was rejected by the service mutation lock while a call was active. The service now tracks an active run controller, aborts it on Stop, and waits for its stopped checkpoint before returning. Cancelling a streaming Agent HTTP request supplies the same cancellation signal, including through a fresh hosted PostgreSQL service instance.

The signal reaches task and management providers, native-search subcalls, and direct page retrieval. Guards before calls, after responses, and around tool execution prevent later work and keep late/unfinished answers out of the completed transcript. Completed actions and available usage/partial diagnostics stay in the audit. Stopped checkpoints clear pending exchanges and signed continuation state. HTTP Context-mode disconnect behavior is unchanged.

Validation: the full source suite passed 158 tests with one optional replay skipped. Six cancellation checks cover OpenAI/Anthropic active-call Stop, cancellation before a call, late responses and usage retention, interruption during a page-fetch tool batch with earlier writes preserved, and real local/hosted HTTP stream cancellation. No live provider call was made; actual vendor billing for interrupted work was not measured.

Converse's browser layer aborts the active fetch, drops provisional output, prevents more steps, and reconciles Stop after the repository lease is released. It suppresses title generation on cancellation. Its browser verification is recorded in the Converse archive.
