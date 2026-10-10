import { test, expect } from '@playwright/test';

async function search(page, query = 'connector') {
  const ui = page.frameLocator('iframe');
  await expect(ui.getByRole('heading', { name: 'Saved handoffs', exact: true })).toBeVisible();
  await ui.getByRole('searchbox').fill(query); await ui.getByRole('button', { name: 'Search', exact: true }).click();
  return ui;
}
async function openPacket(page) {
  const ui = await search(page);
  await expect(ui.getByText('1 saved handoff', { exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'View handoff', exact: true }).click();
  await expect(ui.getByRole('heading', { name: 'Constraints', exact: true })).toBeVisible();
  return ui;
}

test('search, paging, exact packet reads, earlier versions and comparisons use the real SDK bridge', async ({ page }, testInfo) => {
  await page.goto('/'); const ui = page.frameLocator('iframe');
  await expect(ui.getByText('12 saved handoffs', { exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Next page' }).click();
  await expect(ui.getByRole('heading', { name: 'Conclave connector work', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Previous page' }).click();
  await openPacket(page);
  await expect(ui.getByText('Ask before publishing.', { exact: true })).toBeVisible();
  await expect(ui.getByText('Which hosting option should we choose?', { exact: true })).toBeVisible();
  await expect(ui.getByText('Keep source labels visible.', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `.conclave/handoff-ui-${testInfo.project.name}.png`, fullPage: true });
  await ui.getByRole('button', { name: 'Version history', exact: true }).click();
  await expect(ui.getByText('2 immutable versions.', { exact: false })).toBeVisible();
  await ui.getByRole('button', { name: 'Compare with latest', exact: true }).click();
  await expect(ui.getByRole('heading', { name: 'What changed' })).toBeVisible();
  await expect(ui.getByText('Keep source labels visible.', { exact: false })).toBeVisible();
  await ui.getByRole('button', { name: 'Version history', exact: true }).click();
  await ui.getByRole('button', { name: 'Read version', exact: true }).last().click();
  await expect(ui.getByText('You are viewing an earlier version.', { exact: false })).toBeVisible();
  await expect(ui.getByText('Keep source labels visible.', { exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Continue in chat' }).click();
  await expect.poll(() => page.evaluate(() => window.fixtureMessages.length)).toBe(1);
  const messages = await page.evaluate(() => window.fixtureMessages);
  expect(messages[0].content[0].text).toContain('revision 1');
  const calls = await page.evaluate(() => window.fixtureCalls.map(call => call.name));
  expect(calls).toContain('compare_handoff_versions'); expect(calls).not.toContain('save_handoff');
});

test('theme updates, keyboard controls, clipboard fallback and hosts without messages are usable', async ({ page }) => {
  await page.goto('/?messages=0&theme=dark'); const ui = await openPacket(page);
  await expect(ui.getByRole('button', { name: 'Continue in chat' })).toHaveCount(0);
  const frame = page.frames().find(frame => frame.parentFrame());
  expect(await frame.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.evaluate(() => window.fixtureBridge.setHostContext({ theme: 'light' }));
  await expect.poll(() => frame.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await frame.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(Error('fixture denied')) }, configurable: true }));
  await ui.getByRole('button', { name: 'Copy reference' }).focus();
  await ui.getByRole('button', { name: 'Copy reference' }).press('Enter');
  await expect(ui.getByRole('status')).toContainText('selected; copy it manually');
  expect(await frame.evaluate(() => document.activeElement.id)).toBe('reference');
  await ui.getByText('Continuation text for another app', { exact: true }).click();
  await expect(ui.getByRole('textbox', { name: 'Continuation text', exact: true })).toBeVisible();
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('packet titles render as inert text and failed requests keep the current view recoverable', async ({ page }) => {
  await page.goto('/'); const ui = await search(page, 'Literal');
  await expect(ui.getByRole('heading', { name: 'Literal <img src=x onerror="window.parent.xss=true">', exact: true })).toBeVisible();
  await expect(ui.locator('img, script[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.xss)).toBeUndefined();
  await page.route('**/tool', async route => {
    if (route.request().postDataJSON().name === 'get_handoff') await route.fulfill({ status: 401, body: '{}' });
    else await route.continue();
  });
  await ui.getByRole('button', { name: 'View handoff', exact: true }).click();
  await expect(ui.getByRole('status')).toContainText('Could not load');
  await expect(ui.getByRole('button', { name: 'Search', exact: true })).toBeEnabled();
  await page.unroute('**/tool'); await ui.getByRole('button', { name: 'View handoff', exact: true }).click();
  await expect(ui.getByRole('heading', { name: 'Constraints', exact: true })).toBeVisible();
});

test('compact cards expand on request and search works with Enter inside a form-blocked sandbox', async ({ page }, testInfo) => {
  await page.goto('/?inline=1'); const ui = page.frameLocator('iframe');
  await expect(ui.getByText('12 saved handoffs. Open the browser to search, read and compare them.', { exact: true })).toBeVisible();
  await expect(ui.getByRole('searchbox')).toHaveCount(0);
  await expect(ui.getByRole('button')).toHaveCount(2);
  await page.screenshot({ path: `.conclave/handoff-ui-inline-${testInfo.project.name}.png`, fullPage: true });
  await ui.getByRole('button', { name: 'Open handoff browser' }).click();
  await expect(ui.getByRole('searchbox')).toBeVisible();
  await ui.getByRole('searchbox').fill('connector'); await ui.getByRole('searchbox').press('Enter');
  await expect(ui.getByText('1 saved handoff', { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => window.fixtureCalls);
  expect(calls.at(-1)).toMatchObject({ name: 'find_handoffs', arguments: { query: 'connector' } });
});

test('view-only hosts keep a useful card and disable unavailable navigation', async ({ page }) => {
  await page.goto('/?tools=0'); const ui = page.frameLocator('iframe');
  await expect(ui.getByText('12 saved handoffs', { exact: true })).toBeVisible();
  await expect(ui.getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
  await expect(ui.getByRole('searchbox')).toBeDisabled();
  await expect(ui.getByText('This host supports viewing only. Use Conclave’s tools in chat to navigate.', { exact: true })).toBeVisible();
  await expect(ui.getByRole('button', { name: 'View handoff', exact: true }).first()).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureCalls)).toHaveLength(0);
});

test('inline graph expands, filters by project and opens pinned revisions; view-only hosts can inspect it', async ({ page }, testInfo) => {
  await page.goto('/?inline=1&view=graph'); const ui = page.frameLocator('iframe');
  await expect(ui.getByRole('group', { name: 'Saved handoff graph' })).toBeVisible();
  await expect(ui.getByText('12 handoffs · 1 explicit links · All projects', { exact: true })).toBeVisible();
  await expect(ui.getByText('10 handoffs without links', { exact: true })).toBeVisible();
  await page.screenshot({ path: `.conclave/handoff-graph-inline-${testInfo.project.name}.png`, fullPage: true });
  await ui.getByRole('button', { name: 'Open connections graph' }).click();
  await ui.getByLabel('Exact project name (leave empty for all)').fill('Conclave');
  await ui.getByRole('button', { name: 'Filter connections', exact: true }).click();
  await expect(ui.getByText('2 handoffs · 1 explicit links · Conclave', { exact: true })).toBeVisible();
  await ui.getByText('Linked revisions', { exact: true }).click();
  await ui.getByRole('button', { name: 'Dashboard graph (r1)', exact: true }).click();
  await expect(ui.getByText('Version 1 of 2', { exact: false })).toBeVisible();
  await expect(ui.getByRole('textbox', { name: 'Handoff reference', exact: true })).toHaveValue(/^dashboard-graph--\d+$/);
  const calls = await page.evaluate(() => window.fixtureCalls);
  expect(calls.find(call => call.name === 'get_handoff_graph').arguments).toEqual({ project: 'Conclave' });
  expect(calls.at(-1).arguments).toMatchObject({ handoff_id: expect.stringMatching(/^dashboard-graph--\d+$/), revision: 1 });
  expect(await page.evaluate(() => window.fixtureMessages)).toHaveLength(0);
  await page.goto('/?view=graph&tools=0&expand=0&theme=dark');
  await expect(ui.getByRole('group', { name: 'Saved handoff graph' })).toBeVisible();
  await expect(ui.getByRole('button', { name: 'Open connections graph' })).toHaveCount(0);
  await expect(ui.locator('.graph-node[aria-disabled=true]')).toHaveCount(2);
  await ui.getByText('Linked revisions', { exact: true }).click();
  await expect(ui.getByRole('button', { name: 'Dashboard graph (r1)', exact: true })).toBeDisabled();
  const frame = page.frames().find(frame => frame.parentFrame());
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
