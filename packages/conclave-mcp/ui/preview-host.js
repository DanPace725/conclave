import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

const frame = document.querySelector('iframe'), messages = document.getElementById('messages');
const params = new URLSearchParams(location.search), initialId = params.get('handoff');
const bridge = new AppBridge(null, { name: 'Local Conclave UI test host', version: '1' }, {
  ...(params.get('tools') === '0' ? {} : { serverTools: {} }),
  ...(params.get('messages') === '0' ? {} : { message: { text: {} } }),
});
window.fixtureCalls = []; window.fixtureMessages = [];
bridge.oncalltool = async args => {
  window.fixtureCalls.push(args);
  const result = await fetch('/tool', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
  if (!result.ok) throw Error('Demo request failed');
  return result.json();
};
bridge.onmessage = async data => { window.fixtureMessages.push(data); messages.textContent = data.content[0]?.text || ''; return {}; };
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: initialId ? { handoff_id: initialId } : {} });
  const result = await fetch('/tool', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'open_handoff_library', arguments: initialId ? { handoff_id: initialId } : {} }) });
  await bridge.sendToolResult(await result.json());
};
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
bridge.setHostContext({ theme, displayMode: params.get('inline') === '1' ? 'inline' : 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] });
bridge.onrequestdisplaymode = async ({ mode }) => {
  bridge.setHostContext({ theme, displayMode: mode, availableDisplayModes: ['inline', 'fullscreen'] });
  return { mode };
};
document.documentElement.style.colorScheme = theme;
window.fixtureBridge = bridge;
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
frame.srcdoc = await (await fetch('/view')).text();
