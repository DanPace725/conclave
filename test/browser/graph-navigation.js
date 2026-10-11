import { expect } from '@playwright/test';

// Exercise the same renderer through the dashboard and the sandboxed MCP App.
export async function checkGraphNavigation(page, root, mobile) {
  const canvas = root.locator('.graph-canvas'), svg = canvas.locator('svg');
  const zoom = root.getByLabel('Zoom relative to fit');
  const fit = root.getByRole('button', { name: 'Fit graph to screen' });
  const view = () => svg.getAttribute('viewBox');
  const contained = () => canvas.evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    return [...canvas.querySelectorAll('.graph-node')].every(node => {
      const box = node.getBoundingClientRect();
      return box.left >= rect.left && box.right <= rect.right && box.top >= rect.top && box.bottom <= rect.bottom;
    });
  });
  await expect(zoom).toHaveText('100%');
  await expect.poll(contained).toBe(true);
  await canvas.focus();
  for (let i = 0; i < 20; i++) await canvas.press('+');
  await expect(zoom).toHaveText('800%');
  await expect(root.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  for (let i = 0; i < 20; i++) await canvas.press('-');
  await expect(zoom).toHaveText('50%');
  await expect(root.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  await fit.click();
  await root.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(zoom).toHaveText('125%');
  await canvas.focus(); await canvas.press('+');
  await expect(zoom).toHaveText('156%');
  const beforePan = await view();
  await canvas.press('ArrowRight'); expect(await view()).not.toBe(beforePan);
  await fit.click(); await expect(zoom).toHaveText('100%');
  await expect.poll(contained).toBe(true);
  await canvas.scrollIntoViewIfNeeded();
  if (mobile) {
    const session = await page.context().newCDPSession(page), rect = await canvas.boundingBox();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const touches = (distance, shift = 0) => [
      { x: x - distance + shift, y, id: 1 }, { x: x + distance + shift, y, id: 2 },
    ];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(30) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(70) });
    await expect.poll(async () => parseInt(await zoom.textContent())).toBeGreaterThan(150);
    const before = await view(), amount = await zoom.textContent();
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(70, 20) });
    await expect.poll(view).not.toBe(before); await expect(zoom).toHaveText(amount);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    // An ordinary wheel zooms around the pointer, without a modifier key.
    const rect = await svg.boundingBox();
    const x = Math.round(rect.x + rect.width * .7), y = Math.round(rect.y + rect.height * .4);
    const anchor = () => svg.evaluate((svg, offset) => {
      const rect = svg.getBoundingClientRect(), point = svg.createSVGPoint();
      point.x = rect.left + offset.x; point.y = rect.top + offset.y;
      const world = point.matrixTransform(svg.getScreenCTM().inverse());
      return { x: world.x, y: world.y };
    }, { x: x - rect.x, y: y - rect.y });
    const before = await anchor();
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -120);
    await expect(zoom).toHaveText('127%');
    const after = await anchor();
    expect(after.x).toBeCloseTo(before.x, 2); expect(after.y).toBeCloseTo(before.y, 2);
    await page.mouse.wheel(0, 120); await expect(zoom).toHaveText('100%');
    for (const deltaMode of [1, 2]) {
      await canvas.dispatchEvent('wheel', { deltaY: -3, deltaMode, cancelable: true });
      await expect.poll(async () => parseInt(await zoom.textContent())).toBeGreaterThan(100);
      await fit.click();
    }
    // Outside the canvas, the browser retains its ordinary scrolling behavior.
    expect(await root.locator('.graph-hint').evaluate(node => node.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }),
    ))).toBe(true);
    await expect(zoom).toHaveText('100%');
    // Begin a real drag on a node; releasing must not activate it.
    const box = await canvas.locator('.graph-node').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
  }
  await expect(svg).toBeVisible(); await fit.click();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect.poll(contained).toBe(true);
  await expect(zoom).toHaveText('100%');
  // Focus reveals a node even if a keyboard pan moved the network offscreen.
  await canvas.focus();
  for (let i = 0; i < 12; i++) await canvas.press('ArrowRight');
  await canvas.locator('.graph-node').first().focus();
  await expect(canvas.locator('.graph-node').first()).toBeInViewport();
  await fit.click(); await expect.poll(contained).toBe(true);
}
