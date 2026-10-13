import { test, expect } from '@playwright/test';
import { startDashboardPreview } from '../../src/dashboard-preview.js';

// Synthetic in-memory saves stand in for the AI. Browser reads use the real
// dashboard adapter; this does not establish real provider/OAuth acceptance.
test('setup resumes and verifies the exact saved Clyp before offering a second AI', async ({ page }, info) => {
  const preview = await startDashboardPreview({ port: 0 });
  const errors = [], methods = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (req.url().includes('/dashboard/api/')) methods.push(req.method()); });
  try {
    await page.goto(preview.url);
    await page.getByRole('button', { name: 'Connect an AI', exact: true }).click();
    await page.getByRole('button', { name: 'ChatGPT', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('#setup-account')).toContainText('demo@example.test');
    await expect(page.getByRole('link', { name: 'Open ChatGPT settings' })).toHaveAttribute('href', 'https://chatgpt.com/plugins');
    await expect(page.getByLabel('Server address')).toHaveValue(preview.url.replace('/dashboard', '/mcp'));
    await page.screenshot({ path: info.outputPath('setup-connect.png'), fullPage: true });
    await page.getByRole('button', { name: 'Finish later' }).click();
    await page.reload();
    await expect(page.locator('#setup-body')).toBeHidden();
    await page.getByRole('button', { name: 'Resume AI setup' }).click();
    await expect(page.getByRole('heading', { name: 'Connect ChatGPT', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to test', exact: true }).click();
    const prompt = await page.getByLabel('Test prompt', { exact: true }).inputValue();
    const title = prompt.match(/exact title: "([^"]+)"/)[1], summary = prompt.match(/Summary: "([^"]+)"/)[1];
    await page.getByRole('button', { name: 'Check my test Clyp' }).click();
    await expect(page.locator('#setup-status')).toContainText('No matching test is saved');
    const saved = preview.service.save({ packet: { title, summary }, request_id: 'onboarding-legacy' });
    await page.getByRole('button', { name: 'Check my test Clyp' }).click();
    await expect(page.locator('#setup-status')).toContainText('does not contain this exact test Clyp');
    preview.service.save({ handoff_id: saved.handoff_id, expected_revision: 1, request_id: 'onboarding-clyp',
      packet: { title, summary, objective: 'Plan a short walk.', constraints: ['Keep it under 30 minutes.'],
        next_steps: ['Suggest one simple route idea.'], clamp: { version: '1.0', kind: 'clyp', links: [] } } });
    await page.reload();
    await expect(page.getByLabel('Test prompt', { exact: true })).toHaveValue(prompt);
    await page.getByRole('button', { name: 'Check my test Clyp' }).click();
    await expect(page.getByRole('heading', { name: 'Your first Clyp is saved.' })).toBeVisible();
    await expect(page.locator('.setup-result')).toContainText('revision 2');
    await page.getByRole('button', { name: 'Continue this in another AI' }).click();
    await page.getByRole('button', { name: 'Gemini', exact: true }).click();
    await expect(page.locator('#setup-content')).toContainText('Work and school accounts are unsupported');
    await expect(page.getByLabel('Continuation prompt', { exact: true })).toHaveValue(new RegExp(`${saved.readable_id}, revision 2`));
    await page.getByRole('button', { name: 'I retrieved it in the other AI' }).click();
    await expect(page.locator('#setup-status')).toContainText('has not been independently verified');
    expect(await page.evaluate(() => Object.values(localStorage).join(''))).not.toContain('demo@example.test');
    expect(methods.every(method => method === 'GET')).toBe(true);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('setup-continuation.png'), fullPage: true });
  } finally { await preview.close(); }
});

test('setup handles blocked storage, clipboard failure and changed or expired accounts honestly', async ({ page }, info) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw Error('blocked'); };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw Error('blocked'); } } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Connect an AI', exact: true }).click();
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await page.getByRole('button', { name: 'Already connected? Go to test' }).click();
  await page.getByRole('button', { name: 'Copy test prompt' }).click();
  await expect(page.getByLabel('Test prompt', { exact: true })).toBeFocused();
  await expect(page.locator('#setup-status')).toContainText('copy the text manually');
  await page.route('**/dashboard/api/find?query=*', route => route.fulfill({ status: 409, json: { error: 'account_changed' } }));
  await page.getByRole('button', { name: 'Check my test Clyp' }).click();
  await expect(page.locator('#setup-status')).toContainText('account changed');
  await expect(page.getByRole('heading', { name: 'Your first Clyp is saved.' })).toHaveCount(0);
  await page.unroute('**/dashboard/api/find?query=*');
  await page.route('**/dashboard/api/find?query=*', route => route.fulfill({ status: 401, json: { error: 'sign_in_required' } }));
  await page.getByRole('button', { name: 'Check my test Clyp' }).click();
  await expect(page.locator('#setup-status')).toContainText('sign-in expired');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('setup-expired.png'), fullPage: true });
});

test('an empty library opens setup even when the account profile loads first', async ({ page }, info) => {
  let release;
  const gate = new Promise(done => { release = done; });
  await page.route('**/dashboard/api/find?**', async route => {
    await gate;
    await route.fulfill({ json: { total: 0, handoffs: [], projects: [], next_offset: null } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Connect an AI', exact: true })).toBeEnabled();
  await expect(page.locator('#setup-body')).toBeHidden();
  release();
  await expect(page.getByRole('heading', { name: 'Which AI would you like to start with?' })).toBeVisible();
  await page.getByRole('button', { name: 'Gemini', exact: true }).click();
  await expect(page.locator('#setup-content')).toContainText('personal account');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('setup-choose.png'), fullPage: true });
});
