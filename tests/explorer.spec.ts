import { expect, test } from '@playwright/test';

test('full-window canvas, deep zoom, pan and reset without page chrome', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  const canvas = page.getByRole('application', { name: 'Esfera celeste interactiva' });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(1);
  const viewport = page.viewportSize()!;
  expect(await canvas.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  });
  await page.screenshot({ path: 'test-results/viewer-collapsed.png' });
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const slider = page.getByRole('slider', { name: 'Zoom', exact: true });
  await expect(page.getByTestId('control-fov')).toHaveText('75.00°');
  await slider.focus();
  await slider.press('End');
  await expect(page.getByTestId('control-fov')).toHaveText('1.00″');
  // At extreme zoom, keyboard navigation still moves by a fraction of the view.
  await canvas.focus();
  await canvas.press('ArrowRight');
  await canvas.press('+');
  await expect(page.getByTestId('control-fov')).toHaveText('1.00″');
  await slider.focus();
  await slider.press('Home');
  await expect(page.getByTestId('control-fov')).toHaveText('100.00°');
  await page.getByRole('button', { name: 'Restablecer vista' }).click();
  await page.mouse.move(900, 400);
  await page.mouse.down();
  await page.mouse.move(1050, 450, { steps: 12 });
  await page.mouse.up();
  const panned = await canvas.screenshot();
  await page.getByRole('button', { name: 'Restablecer vista' }).click();
  const reset = await canvas.screenshot();
  expect(panned.equals(reset)).toBe(false);
  await page.screenshot({ path: 'test-results/viewer-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mostrar controles' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('tool window moves, resizes, retains its rect and stays reachable after viewport shrink', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const panel = page.getByRole('dialog', { name: 'Controles del visor' });
  const original = (await panel.boundingBox())!;
  const handle = page.getByRole('button', { name: 'Mover panel', exact: true });
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(handleBox.x + 100, handleBox.y + 18);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 240, handleBox.y + 98, { steps: 12 });
  await page.mouse.up();
  const moved = (await panel.boundingBox())!;
  expect(moved.x).toBeGreaterThan(original.x + 100);
  expect(moved.y).toBeGreaterThan(original.y + 50);
  const grip = page.getByRole('button', { name: 'Cambiar tamaño del panel' });
  const gripBox = (await grip.boundingBox())!;
  await page.mouse.move(gripBox.x + 8, gripBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 90, gripBox.y + 58, { steps: 12 });
  await page.mouse.up();
  const resized = (await panel.boundingBox())!;
  expect(resized.width).toBeGreaterThan(moved.width + 50);
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  expect((await panel.boundingBox())!.width).toBeCloseTo(resized.width, 0);
  await page.setViewportSize({ width: 390, height: 640 });
  await expect
    .poll(async () => {
      const r = (await panel.boundingBox())!;
      return r.x + r.width;
    })
    .toBeLessThanOrEqual(378);
  const small = (await panel.boundingBox())!;
  expect(small.y + small.height).toBeLessThanOrEqual(628);
  await page.getByRole('button', { name: 'Mover panel', exact: true }).press('ArrowRight');
  await grip.press('ArrowLeft');
  await page.screenshot({ path: 'test-results/viewer-mobile.png' });
});

test('date and interval controls animate demo dates while the checkerboard stays unchanged', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const canvas = page.getByRole('application', { name: 'Esfera celeste interactiva' });
  await expect(page.getByTestId('epoch-date')).toHaveText('2025-07-01');
  const controls = [
    page.getByRole('dialog'),
    page.getByRole('button', { name: 'Ocultar controles' }),
  ];
  const before = await canvas.screenshot({ mask: controls });
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(page.getByTestId('epoch-date')).toHaveText('2027-01-01');
  await page.getByRole('slider', { name: 'Intervalo entre fechas', exact: true }).press('Home');
  await expect(page.getByTestId('interval')).toHaveText('100 ms');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await page.clock.runFor(150);
  await expect(page.getByTestId('epoch-date')).not.toHaveText('2027-01-01');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const pausedDate = await page.getByTestId('epoch-date').textContent();
  await page.clock.runFor(500);
  await expect(page.getByTestId('epoch-date')).toHaveText(pausedDate!);
  expect((await canvas.screenshot({ mask: controls })).equals(before)).toBe(true);
});

test('mobile canvas accepts touch pan and pinch with the panel closed', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto('/');
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 140, y: 400, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 180, y: 430, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 120, y: 400, id: 1 },
      { x: 180, y: 400, id: 2 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 90, y: 400, id: 1 },
      { x: 210, y: 400, id: 2 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await expect(page.getByTestId('control-fov')).not.toHaveText('75.00°');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth === innerWidth &&
        document.documentElement.scrollHeight === innerHeight,
    ),
  ).toBe(true);
  await context.close();
});
