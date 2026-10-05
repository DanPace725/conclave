// Public-rate valuation of the live conversation from its export.
import { readFileSync } from 'node:fs';
import { conversationCosts } from '../../src/costs.js';
const snapshot = JSON.parse(readFileSync(new URL('../../src/resources/model-costs-2026-10-02.json', import.meta.url), 'utf8'));
const c = conversationCosts(JSON.parse(readFileSync(process.argv[2], 'utf8')), snapshot);
console.log(JSON.stringify({ calls: c.calls.length, priced: c.priced_calls, unpriced: c.unpriced_calls, usd_min: c.known_usd_min, usd_max: c.known_usd_max, purpose: c.purpose,
  unpriced_purposes: c.calls.filter(x => x.usd_min == null).map(x => x.purpose + ':' + x.requested_model), reasons: [...new Set(c.calls.flatMap(x => x.reasons))] }, null, 1));
