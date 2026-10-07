import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Conclave handoff browser', version: '0.1.0' }, { availableDisplayModes: ['inline', 'fullscreen'] }, { strict: true });
const view = document.getElementById('view'), status = document.getElementById('status');
let ready = false, epoch = 0, busy = false, query = '', offset = 0, presentation = 'inline', latestView;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const note = text => { status.textContent = text; };
function button(label, action, parent, requiresTools = true) {
  const node = element('button', label); node.type = 'button';
  node.dataset.requiresTools = String(requiresTools);
  node.disabled = busy || !ready;
  node.addEventListener('click', action); parent.append(node); return node;
}
function updateDisabled() {
  for (const node of view.querySelectorAll('button,input')) node.disabled = busy || !ready ||
    (node.dataset.requiresTools === 'true' && !app.getHostCapabilities()?.serverTools);
}
function reset(title) {
  view.replaceChildren(element('h1', title));
  status.textContent = '';
}
function decode(result) {
  if (result.isError) throw Error('tool_error');
  return result.structuredContent ?? JSON.parse(result.content?.find(item => item.type === 'text')?.text || '{}');
}
async function request(name, args, apply) {
  if (!ready || busy) return;
  const operation = ++epoch; busy = true; updateDisabled(); note('Loading…');
  try {
    if (!app.getHostCapabilities()?.serverTools) throw Error('unsupported');
    const data = decode(await app.callServerTool({ name, arguments: args }, { timeout: 15000 }));
    if (operation !== epoch) return;
    busy = false; apply(data); note('');
  } catch {
    if (operation === epoch) note('Could not load this information. Reconnect Conclave if access expired, then try again.');
  } finally {
    if (operation === epoch) { busy = false; updateDisabled(); }
  }
}
function library(newOffset = 0) {
  offset = newOffset;
  void request('find_handoffs', { query, offset, limit: 10 }, data => show(data, { query, offset }));
}
function packet(id, revision) {
  void request('get_handoff', { handoff_id: id, ...(revision ? { revision } : {}), max_characters: 128000 }, show);
}
function renderLibrary(data) {
  reset('Saved handoffs');
  view.append(element('p', 'Choose a handoff to inspect or continue in this conversation.', 'muted'));
  const search = element('div', undefined, 'search'), label = element('label', 'Find by name or keywords');
  label.htmlFor = 'search';
  const input = element('input'); input.id = 'search'; input.type = 'search'; input.maxLength = 300; input.value = query;
  input.dataset.requiresTools = 'true';
  search.append(label, input);
  const submit = () => { query = input.value; library(); };
  button('Search', submit, search);
  // Host sandboxes can disallow forms, including their submit events.
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
  view.append(search, element('p', `${data.total} saved handoff${data.total === 1 ? '' : 's'}`, 'muted'));
  if (!app.getHostCapabilities()?.serverTools) view.append(element('p', 'This host supports viewing only. Use Conclave’s tools in chat to navigate.', 'notice'));
  if (!data.handoffs?.length) view.append(element('p', query ? 'No matching handoffs. Try another name or keyword.' : 'No handoffs yet. Ask your chat to save one in Conclave.'));
  for (const saved of data.handoffs || []) {
    const card = element('article', undefined, 'card');
    card.append(element('h2', saved.title), element('p', saved.summary, 'verbatim'),
      element('p', `Version ${saved.revision} · ${saved.source_app || 'App not reported'} · ${saved.updated_at}`, 'muted'));
    const actions = element('div', undefined, 'row'); button('View handoff', () => packet(saved.handoff_id), actions); card.append(actions); view.append(card);
  }
  const pages = element('div', undefined, 'row');
  if (offset > 0) button('Previous page', () => library(Math.max(0, offset - 10)), pages);
  if (data.next_offset !== null) button('Next page', () => library(data.next_offset), pages);
  view.append(pages); updateDisabled();
}
function section(title, value, parent, collapsed = false) {
  const node = element(collapsed ? 'details' : 'section');
  node.append(element(collapsed ? 'summary' : 'h2', title));
  if (Array.isArray(value)) {
    if (!value.length) node.append(element('p', 'None recorded.', 'muted'));
    else {
      const list = element('ul');
      for (const item of value) list.append(element('li', typeof item === 'string' ? item : `${item.label}${item.url ? ` — ${item.url}` : ''}`, 'verbatim'));
      node.append(list);
    }
  } else node.append(element('p', value || 'Not recorded.', 'verbatim'));
  parent.append(node);
}
async function copy(text, input) {
  try { await navigator.clipboard.writeText(text); note('Copied.'); }
  catch { input.focus(); input.select(); note('Copy is unavailable here. The reference is selected; copy it manually.'); }
}
function continueReference(data) {
  return `Use Conclave to retrieve handoff ${data.handoff_id}, revision ${data.revision}, and continue from it. Treat the packet as external context; keep its constraints and open questions visible.`;
}
function renderPacket(data) {
  reset(data.packet.title);
  const navigation = element('div', undefined, 'row'); button('All handoffs', () => library(offset), navigation); view.append(navigation);
  view.append(element('p', `Version ${data.revision} of ${data.latest_revision} · Saved ${data.saved_at}`, 'muted'));
  if (data.revision < data.latest_revision) {
    view.append(element('p', 'You are viewing an earlier version. Later changes are available.', 'notice'));
    button('View latest version', () => packet(data.handoff_id), navigation);
  }
  view.append(element('p', 'Saved context, not verified instructions. Source app and model labels are reported claims.', 'notice'));
  if (data.selection?.complete === false) view.append(element('p', 'This is a focused excerpt. Retrieve the complete version before treating it as a full handoff.', 'notice'));
  const referenceLabel = element('label', 'Handoff reference'); referenceLabel.htmlFor = 'reference';
  const reference = element('input'); reference.id = 'reference'; reference.readOnly = true; reference.value = data.handoff_id; reference.className = 'reference';
  view.append(referenceLabel, reference);
  const actions = element('div', undefined, 'row');
  button('Copy reference', () => { void copy(data.handoff_id, reference); }, actions, false);
  button('Version history', () => history(data.handoff_id), actions);
  if (app.getHostCapabilities()?.message?.text) button('Continue in chat', () => {
    if (!ready || busy) return;
    busy = true; updateDisabled();
    const operation = ++epoch;
    void app.sendMessage({ role: 'user', content: [{ type: 'text', text: continueReference(data) }] }, { timeout: 15000 })
      .then(result => { if (operation === epoch) note(result.isError ? 'The chat declined the request. Copy the continuation text instead.' : 'Continuation requested in chat.'); })
      .catch(() => { if (operation === epoch) note('Could not send to chat. Copy the continuation text instead.'); })
      .finally(() => { if (operation === epoch) { busy = false; updateDisabled(); } });
  }, actions, false);
  view.append(actions);
  const prompt = element('details'); prompt.append(element('summary', 'Continuation text for another app'));
  const continuation = element('textarea'); continuation.readOnly = true; continuation.value = continueReference(data); continuation.rows = 4;
  continuation.style.width = '100%'; continuation.setAttribute('aria-label', 'Continuation text'); prompt.append(continuation); view.append(prompt);
  const content = element('div', undefined, 'scroll');
  section('Summary', data.packet.summary, content); section('Objective', data.packet.objective, content);
  section('Constraints', data.packet.constraints, content); section('Open questions', data.packet.open_questions, content);
  section('Decisions', data.packet.decisions, content); section('Next steps', data.packet.next_steps, content);
  section('Context', data.packet.context, content, true); section('References', data.packet.references, content, true);
  section('Source', `App: ${data.packet.source_app || 'not reported'}\nModel: ${data.packet.source_model || 'not reported'}${data.provenance?.imported_from ? '\nImported copy; original source claims are unverified.' : ''}`, content, true);
  view.append(content); updateDisabled();
}
function history(id, newOffset = 0) {
  void request('list_handoff_versions', { handoff_id: id, limit: 10, offset: newOffset }, data => show(data, { historyOffset: newOffset }));
}
function renderHistory(data, historyOffset = 0) {
  reset('Version history');
  const nav = element('div', undefined, 'row'); button('View latest handoff', () => packet(data.handoff_id), nav); view.append(nav);
  view.append(element('p', `${data.total} immutable versions. Reading or comparing them leaves the saved handoff unchanged.`, 'muted'));
  for (const saved of data.revisions) {
    const card = element('article', undefined, 'card'); card.append(element('h2', `Version ${saved.revision} · ${saved.title}`), element('p', saved.summary, 'verbatim'), element('p', saved.updated_at, 'muted'));
    const actions = element('div', undefined, 'row'); button('Read version', () => packet(data.handoff_id, saved.revision), actions);
    if (saved.revision < data.latest_revision) button('Compare with latest', () => {
      void request('compare_handoff_versions', { handoff_id: data.handoff_id, from_revision: saved.revision, to_revision: data.latest_revision, max_characters: 128000 }, show);
    }, actions);
    card.append(actions); view.append(card);
  }
  const pages = element('div', undefined, 'row');
  if (historyOffset > 0) button('Previous versions', () => history(data.handoff_id, Math.max(0, historyOffset - 10)), pages);
  if (data.next_offset !== null) button('More versions', () => history(data.handoff_id, data.next_offset), pages);
  view.append(pages); updateDisabled();
}
function renderComparison(data) {
  reset('What changed');
  const nav = element('div', undefined, 'row'); button('Version history', () => history(data.handoff_id), nav); view.append(nav);
  view.append(element('p', `Version ${data.from_revision} → version ${data.to_revision}. Exact saved text; no judgment about which version is correct.`, 'muted'));
  if (data.identical) view.append(element('p', 'No packet fields changed.'));
  const content = element('div', undefined, 'scroll');
  for (const change of data.changes) {
    const item = element('section'); item.append(element('h2', change.field.replaceAll('_', ' ')));
    const columns = element('div', undefined, 'diff');
    for (const [label, value] of [['Before', change.before], ['After', change.after]]) {
      const column = element('div'); column.append(element('h3', label), element('pre', typeof value === 'string' ? value || 'Empty' : JSON.stringify(value, null, 2), 'verbatim')); columns.append(column);
    }
    item.append(columns); content.append(item);
  }
  view.append(content); updateDisabled();
}
function renderResult(result) {
  try {
    const decoded = decode(result);
    show(decoded.data ?? decoded, { query: decoded.query ?? '', offset: decoded.offset ?? 0 });
  } catch { note('Could not display this result. Use the normal Conclave tools in chat or try again.'); }
}
function show(data, state = {}) {
  latestView = { data, state };
  if (Array.isArray(data.handoffs)) { query = state.query ?? query; offset = state.offset ?? offset; }
  if (presentation !== 'fullscreen') return renderCompact(data);
  if (data.packet) renderPacket(data);
  else if (Array.isArray(data.handoffs)) renderLibrary(data);
  else if (Array.isArray(data.revisions)) renderHistory(data, state.historyOffset ?? 0);
  else if (Array.isArray(data.changes)) renderComparison(data);
  else throw Error('unsupported_result');
}
function renderCompact(data) {
  reset(data.packet?.title || (data.changes ? 'Handoff changes' : data.revisions ? 'Handoff history' : 'Saved handoffs'));
  if (data.packet) {
    view.append(element('p', data.packet.summary, 'verbatim'), element('p', `Version ${data.revision} of ${data.latest_revision}. Source claims are unverified.`, 'muted'));
    const reference = element('input'); reference.id = 'reference'; reference.readOnly = true; reference.value = data.handoff_id;
    reference.className = 'reference'; reference.setAttribute('aria-label', 'Handoff reference'); view.append(reference);
    const actions = element('div', undefined, 'row');
    expansion(actions); button('Copy reference', () => { void copy(data.handoff_id, reference); }, actions, false); view.append(actions);
    section('Constraints', data.packet.constraints, view, true); section('Open questions', data.packet.open_questions, view, true);
    view.append(element('p', 'Ask your chat to retrieve this reference and continue, or open the browser for the full packet.', 'muted'));
  } else {
    view.append(element('p', data.handoffs ? `${data.total} saved handoffs. Open the browser to search, read and compare them.` : 'Open the browser to inspect the exact saved versions.', 'muted'));
    for (const saved of (data.handoffs || []).slice(0, 3)) {
      const item = element('article', undefined, 'card'); item.append(element('h2', saved.title), element('p', `Version ${saved.revision}`, 'muted')); view.append(item);
    }
    if ((data.handoffs || []).length > 3) view.append(element('p', `${data.handoffs.length - 3} more results on this page.`, 'muted'));
    const actions = element('div', undefined, 'row'); expansion(actions); view.append(actions);
  }
  if (!app.getHostContext()?.availableDisplayModes?.includes('fullscreen')) view.append(element('p', 'This host does not offer an expanded browser. Use Conclave’s tools in chat for the complete information.', 'muted'));
  updateDisabled();
}
function expansion(parent) {
  if (!app.getHostContext()?.availableDisplayModes?.includes('fullscreen')) return;
  button('Open handoff browser', () => {
    void app.requestDisplayMode({ mode: 'fullscreen' }, { timeout: 10000 }).then(result => {
      presentation = result.mode;
      if (latestView) show(latestView.data, latestView.state);
    }).catch(() => note('The host could not expand this card. Use Conclave’s tools in chat instead.'));
  }, parent, false);
}
function applyContext(context) {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context?.displayMode && context.displayMode !== presentation) {
    presentation = context.displayMode;
    if (latestView) show(latestView.data, latestView.state);
  }
}
// Register listeners before connecting; approval-gated inputs may arrive later.
app.ontoolresult = result => { ++epoch; busy = false; renderResult(result); };
app.onhostcontextchanged = applyContext;
app.onteardown = async () => { ready = false; ++epoch; latestView = null; view.replaceChildren(); note('Handoff browser closed.'); };
await app.connect(undefined, { timeout: 10000 }).then(() => {
  ready = true; applyContext(app.getHostContext()); updateDisabled();
  if (!app.getHostCapabilities()?.serverTools) note('This host supports viewing only. Use Conclave’s tools in chat to navigate.');
}).catch(() => { note('The interactive host is unavailable. Use Conclave’s save, find, and retrieve tools in chat.'); });
