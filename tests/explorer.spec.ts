import { expect, test } from '@playwright/test';

test('renders a real WebGL checkerboard and supports drag, zoom, reset and layers', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  const canvas = page.getByRole('application', { name: 'Esfera celeste interactiva' });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('control-fov')).toHaveText('75°');
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.getByTestId('longitude')).not.toHaveText('180.0°');
  await page.mouse.wheel(0, -300);
  await expect(page.getByTestId('control-fov')).not.toHaveText('75°');
  await page.getByRole('button', { name: 'Reset View' }).click();
  await expect(page.getByTestId('longitude')).toHaveText('180.0°');
  await expect(page.getByTestId('latitude')).toHaveText('+12.0°');
  await expect(page.getByTestId('control-fov')).toHaveText('75°');
  const slider = page.getByRole('slider', { name: 'Zoom', exact: true });
  await slider.focus();
  await slider.press('End');
  await expect(page.getByTestId('control-fov')).toHaveText('25°');
  await slider.press('Home');
  await expect(page.getByTestId('control-fov')).toHaveText('100°');
  await page.getByRole('checkbox', { name: 'Cuadrícula', exact: true }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Cuadrícula', exact: true })).not.toBeChecked();
  await canvas.focus();
  await canvas.press('ArrowRight');
  await expect(page.getByTestId('longitude')).toHaveText('183.0°');
  await canvas.press('Home');
  await expect(page.getByTestId('longitude')).toHaveText('180.0°');
  await page.getByRole('checkbox', { name: 'Cuadrícula', exact: true }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/explorer-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('fits mobile screens and accepts touch drag and pinch', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto('/');
  const canvas = page.getByRole('application', { name: 'Esfera celeste interactiva' });
  await expect(canvas).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const bounds = (await canvas.boundingBox())!;
  const client = await context.newCDPSession(page);
  const x = Math.round(bounds.x + bounds.width / 2);
  const y = Math.round(bounds.y + bounds.height / 2);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 40, y: y + 30, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('longitude')).not.toHaveText('180.0°');
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: x - 60, y, id: 1 },
      { x: x + 60, y, id: 2 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('control-fov')).not.toHaveText('75°');
  await page.getByRole('button', { name: 'Reset View' }).click();
  await expect(page.getByTestId('control-fov')).toHaveText('75°');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/explorer-mobile.png', fullPage: true });
  await context.close();
});
