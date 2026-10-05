// Observation-only preload for the scoring runs (node --import). It changes no engine or
// scoring code: it wraps the selector calls and appends what they returned to CAPTURE_OUT,
// because the scoring report keeps scores but not per-paragraph decisions.
import { appendFileSync } from 'node:fs';
import { JevDecisionAdapter } from '../src/jev.js';
import { OpenAIProvider, AnthropicProvider, responseText } from '../src/provider.js';
const out = process.env.CAPTURE_OUT;
if (out) {
  const line = record => appendFileSync(out, JSON.stringify(record) + '\n');
  const selectMemory = JevDecisionAdapter.prototype.selectMemory;
  let index = 0;
  JevDecisionAdapter.prototype.selectMemory = async function (passages, context, invoke) {
    const item_index = index++;
    try {
      const result = await selectMemory.call(this, passages, context, invoke);
      line({ selector: 'jev', item_index, passages: passages.length, threshold: result.threshold, records: result.records, decisions: result.decisions, oversized: result.oversized, calls: result.calls });
      return result;
    } catch (error) { line({ selector: 'jev', item_index, passages: passages.length, failed: true }); throw error; }
  };
  for (const Provider of [OpenAIProvider, AnthropicProvider]) {
    const respond = Provider.prototype.respond;
    Provider.prototype.respond = async function (payload, options) {
      const started = Date.now();
      let event_id = null;
      try { event_id = JSON.parse(payload.input[0].content).event_id; } catch {}
      try {
        const response = await respond.call(this, payload, options);
        line({ selector: 'llm', provider: this.name, model: payload.model, event_id, status: response.status, text: responseText(response), usage: response.usage || null, elapsed_ms: Date.now() - started });
        return response;
      } catch (error) { line({ selector: 'llm', provider: this.name, model: payload.model, event_id, failed: true, elapsed_ms: Date.now() - started }); throw error; }
    };
  }
}
