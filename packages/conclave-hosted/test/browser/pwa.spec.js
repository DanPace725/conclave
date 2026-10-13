import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';

test('cross-site top-level dashboard launches work before and after service worker activation', async ({ page, context, baseURL }) => {
  const launcher = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<a href="${baseURL}/dashboard/">Open Conclave</a>`);
  });
  await new Promise(done => launcher.listen(0, '127.0.0.1', done));
  try {
    for (let launch = 0; launch < 2; launch++) {
      // localhost and the dashboard's 127.0.0.1 are different sites.
      await page.goto(`http://localhost:${launcher.address().port}/`);
      const response = page.waitForResponse(response => response.request().isNavigationRequest() && response.url() === `${baseURL}/dashboard/`);
      await page.getByRole('link', { name: 'Open Conclave' }).click();
      expect((await response).status(), `launch ${launch + 1}`).toBe(200);
      await expect(page.getByRole('button', { name: /Dashboard planning/ })).toBeVisible();
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    }
    const blocked = await context.request.get('/dashboard/api/find', { headers: {
      'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } });
    expect(blocked.status()).toBe(403);
  } finally {
    launcher.closeAllConnections();
    await new Promise(done => launcher.close(done));
  }
});

test('dashboard PWA loads fresh data, caches only public offline resources and recovers after reconnecting', async ({ page, context }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard/');
  await expect(page.getByRole('button', { name: /Dashboard planning/ })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cdp = await context.newCDPSession(page);
  const { data } = await cdp.send('Page.getAppManifest');
  expect(JSON.parse(data)).toMatchObject({ name: 'Conclave', start_url: '/dashboard/', scope: '/', display: 'standalone' });
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  // Playwright's isolated contexts are private windows, where browsers disable
  // native installation. All application-related installability checks must pass.
  expect(installabilityErrors.filter(error => error.errorId !== 'in-incognito')).toEqual([]);
  await page.getByRole('button', { name: /Dashboard planning/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard planning', exact: true })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const entries = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) entries.push(new URL(request.url).pathname);
    return entries.sort();
  });
  expect(cached).toEqual(['/dashboard/apple-touch-icon.png', '/dashboard/icon-192.png', '/dashboard/icon-512.png',
    '/dashboard/icon-maskable-512.png', '/dashboard/offline.css', '/dashboard/offline.html'].sort());
  await context.setOffline(true);
  // API traffic must fail offline, never return an earlier account's response.
  expect(await page.evaluate(() => fetch('/dashboard/api/find').then(() => 'response', () => 'offline'))).toBe('offline');
  await page.goto('/dashboard/?view=graph');
  await expect(page.getByRole('heading', { name: "You're offline." })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dashboard planning/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('pwa-offline.png'), fullPage: true });
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: /Dashboard planning/ })).toBeVisible();
  const origin = new URL(page.url()).origin;
  await context.addCookies([{ name: 'preview_expired', value: '1', url: origin }]);
  const response = await page.request.get('/dashboard/api/find');
  expect(response.status()).toBe(401);
  await context.clearCookies();
  await page.reload();
  await expect(page.getByRole('button', { name: /Dashboard planning/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('install control follows browser prompt availability and hides when installed', async ({ page }, info) => {
  await page.goto('/dashboard/');
  const install = page.getByRole('button', { name: 'Install Conclave', exact: true });
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.promptRequested = true; };
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dispatchEvent(event);
  });
  await expect(install).toBeVisible();
  await page.screenshot({ path: info.outputPath('pwa-install.png'), fullPage: true });
  await install.click();
  expect(await page.evaluate(() => window.promptRequested)).toBe(true);
  await expect(install).toBeHidden();
  await page.getByText('Use Conclave as an app', { exact: true }).click();
  await expect(page.getByText(/On iPhone or iPad/)).toBeVisible();
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('#install-help')).toBeHidden();
});
