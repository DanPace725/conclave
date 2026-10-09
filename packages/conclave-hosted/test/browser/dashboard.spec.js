import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Clyp budgets, complete ORMD download and pinned cross-project graph navigation', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/dashboard');
  const legacyID = await page.getByRole('button', { name: /Dashboard planning/ }).getAttribute('data-id');
  await page.goto(`/dashboard#handoff=${legacyID}`);
  await expect(page.getByText(/Clyp · CLAMP 1.0 · \d+ \/ 1500 tokens/)).toBeVisible();
  await expect(page).toHaveURL(/#handoff=dashboard-planning--2$/);
  await page.getByText('Continue in another app', { exact: true }).click();
  await expect(page.getByLabel('Continuation text')).toHaveValue(/retrieve handoff dashboard-planning--2 \(Dashboard planning\), revision 13/);
  await expect(page.locator('#detail').getByRole('button', { name: /depends on · demo-workstream-11--\d+ · revision 1/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ORMD', exact: true }).click();
  const file = await download, text = await readFile(await file.path(), 'utf8');
  expect(file.suggestedFilename()).toMatch(/r13\.ormd$/);
  expect(text).toContain('<!-- ormd:1.0 -->'); expect(text).toContain('Ask before publishing.');
  expect(text).toContain('depends_on');
  await page.getByRole('button', { name: 'Show connections', exact: true }).click();
  await expect(page.getByText(/12 handoffs · 1 explicit links/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Saved handoff graph' })).toBeVisible();
  expect(await page.locator('img').count()).toBe(0);
  await page.locator('.connection-list').getByRole('button', { name: 'Demo workstream 11 (r1)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Demo workstream 11', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('clyp-connections.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('search, paging, full packets, exact changes, older revisions and export', async ({ page }, info) => {
  const methods = []; page.on('request', req => { if (req.url().includes('/dashboard/api/')) methods.push(req.method()); });
  await page.goto('/dashboard');
  await expect(page.getByText('1–10 of 12 · most recently saved first')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('11–12 of 12 · most recently saved first')).toBeVisible();
  await page.getByLabel('Search names, apps, or keywords').fill('Dashboard planning');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('1–1 of 1 · keyword matches')).toBeVisible();
  await page.getByRole('button', { name: /Dashboard planning/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard planning', exact: true })).toBeVisible();
  await page.getByText('Revision history', { exact: true }).click();
  await expect(page.getByText('13 saved revisions · latest at this read: 13')).toBeVisible();
  await page.getByRole('button', { name: 'Older revisions', exact: true }).click();
  await page.getByRole('button', { name: 'Compare 1 with latest', exact: true }).click();
  await expect(page.getByText('Removed constraints', { exact: true })).toBeVisible();
  await expect(page.getByText('Removed open questions', { exact: true })).toBeVisible();
  await expect(page.locator('#comparison').getByText('Keep source labels visible.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Read revision 1', exact: true }).click();
  await expect(page.getByText('EARLIER SAVED REVISION', { exact: true })).toBeVisible();
  await expect(page.getByText('Which default view?', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('EARLIER SAVED REVISION', { exact: true })).toBeVisible();
  await page.getByText('Full context', { exact: true }).click();
  await expect(page.getByText('This is synthetic demo context.', { exact: false })).toBeVisible();
  await page.screenshot({ path: `.conclave/dashboard-${info.project.name}.png`, fullPage: true });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export revision', exact: true }).click();
  const file = await download;
  const exported = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(exported.revision).toBe(1); expect(exported.packet.constraints).toContain('Keep source labels visible.');
  expect(exported.selection.complete).toBe(true); expect(exported.sha256).toHaveLength(64);
  await page.getByRole('button', { name: 'Check latest', exact: true }).click();
  await expect(page.getByText('LATEST SAVED REVISION', { exact: true })).toBeVisible();
  expect(methods.every(method => method === 'GET')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('project chips filter the list by the exact reported name', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Demo project · 5', exact: true }).click();
  await expect(page.getByText('1–5 of 5 · project Demo project · most recently saved first')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo project · 5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#handoffs button[data-id]')).toHaveCount(5);
  await page.getByLabel('Search names, apps, or keywords').fill('Dashboard planning');
  await page.getByLabel('Search names, apps, or keywords').press('Enter');
  await expect(page.getByText('No matches. Try another name, app, or keyword.')).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: /Dashboard planning/ }).click();
  await expect(page.locator('#detail .meta')).toContainText('Conclave dashboard');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('empty results, inert packet text and clipboard fallback', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByLabel('Search names, apps, or keywords').fill('no-such-packet');
  await page.getByLabel('Search names, apps, or keywords').press('Enter');
  await expect(page.getByText('No matches. Try another name, app, or keyword.')).toBeVisible();
  await page.getByLabel('Search names, apps, or keywords').fill('Literal');
  await page.getByLabel('Search names, apps, or keywords').press('Enter');
  await page.getByRole('button', { name: /Literal <img/ }).click();
  await expect(page.getByRole('heading', { name: /Literal <img/ })).toBeVisible();
  expect(await page.evaluate(() => window.xss)).toBeUndefined();
  expect(await page.locator('img').count()).toBe(0);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw Error('blocked'); } } }));
  await page.getByRole('button', { name: 'Copy continuation', exact: true }).click();
  await expect(page.getByLabel('Continuation text')).toBeVisible();
  await expect(page.getByLabel('Continuation text')).toBeFocused();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('expired access, recoverable network failure and late responses do not replace the selection', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: /Dashboard planning/ })).toBeVisible();
  const firstID = await page.getByRole('button', { name: /Dashboard planning/ }).getAttribute('data-reference');
  let release, started;
  const gate = new Promise(done => { release = done; }), pending = new Promise(done => { started = done; });
  await page.route('**/dashboard/api/get?**', async route => {
    if (new URL(route.request().url()).searchParams.get('handoff_id') === firstID) { started(); await gate; }
    await route.continue();
  });
  await page.getByRole('button', { name: /Dashboard planning/ }).click();
  await pending;
  await page.getByRole('button', { name: /Demo workstream 11/ }).click();
  await expect(page.getByRole('heading', { name: 'Demo workstream 11', exact: true })).toBeVisible();
  const late = page.waitForResponse(response => new URL(response.url()).searchParams.get('handoff_id') === firstID);
  release(); await late;
  await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
  await expect(page.getByRole('heading', { name: 'Demo workstream 11', exact: true })).toBeVisible();
  await page.unroute('**/dashboard/api/get?**');
  await page.route('**/dashboard/api/get?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
  await page.getByRole('button', { name: /Dashboard planning/ }).click();
  await expect(page.getByText('Could not load this information. Try again shortly.', { exact: true })).toBeVisible();
  await page.unroute('**/dashboard/api/get?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard planning', exact: true })).toBeVisible();
  // Toggle events are queued. Closing this packet immediately must discard its
  // queued history read instead of looking up a detached detail panel.
  await page.evaluate(() => {
    [...document.querySelectorAll('#detail summary')].find(node => node.textContent === 'Revision history').click();
    document.querySelector('#handoffs button[data-id]').click();
  });
  await expect(page.getByRole('heading', { name: 'Dashboard planning', exact: true })).toBeVisible();
  await page.route('**/dashboard/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"sign_in_required"}' }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('#list-status')).toHaveText('Your sign-in expired. Sign in from Account, then refresh.');
  await expect(page.getByRole('heading', { name: 'Could not open this handoff', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
