const install = document.getElementById('install-app');
const help = document.getElementById('install-help');
const standalone = matchMedia('(display-mode: standalone)');
let pending;
function installed() {
  pending = undefined;
  install.hidden = true;
  help.hidden = true;
}
if (standalone.matches || navigator.standalone) installed();
standalone.addEventListener('change', event => { if (event.matches) installed(); });
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (standalone.matches || navigator.standalone) return;
  pending = event;
  install.hidden = false;
});
install.addEventListener('click', async () => {
  if (!pending) return;
  const prompt = pending;
  pending = undefined;
  install.hidden = true;
  try { await prompt.prompt(); await prompt.userChoice; }
  catch { help.open = true; }
});
window.addEventListener('appinstalled', installed);
if ('serviceWorker' in navigator && window.isSecureContext) {
  // Do not reload an open handoff when an update activates. The next navigation
  // gets fresh network HTML; the worker stores only the public offline screen.
  navigator.serviceWorker.register('/dashboard/sw.js', { scope: '/dashboard/', updateViaCache: 'none' })
    .catch(() => { /* Installation can still be offered without offline support. */ });
}
