import { test, expect } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures';

for (const mobile of [false, true])
  test(`compact menus preserve drafts when folded (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 740 });
    await installArchiveFixtures(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    const menus = page.locator('[data-control-menu]');
    await expect(menus).toHaveCount(7);
    await expect(page.locator('[data-control-menu][open]')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Copiar enlace', exact: true }),
    ).not.toBeVisible();
    for (const summary of await menus.locator(':scope > summary').all()) {
      await expect(summary).toBeInViewport();
    }
    await page.screenshot({
      path: `test-results/compact-controls-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    const coordinates = menus.filter({
      has: page.locator(':scope > summary', { hasText: 'Ubicación y zoom' }),
    });
    await coordinates.locator(':scope > summary').press('Enter');
    const ra = page.getByLabel('Ascensión recta · H M S');
    await ra.fill('12 30 15');
    await coordinates.locator(':scope > summary').click();
    await expect(ra).not.toBeVisible();
    await coordinates.locator(':scope > summary').press('Enter');
    await expect(ra).toHaveValue('12 30 15');
    const downloads = menus.filter({
      has: page.locator(':scope > summary', { hasText: 'Descargar y compartir' }),
    });
    await downloads.locator(':scope > summary').click();
    await expect(page.getByRole('button', { name: 'Copiar enlace', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click();
    await expect(page.locator('[data-control-menu][open]')).toHaveCount(0);
    await coordinates.locator(':scope > summary').press('Enter');
    await expect(ra).toHaveValue('12 30 15');
    await page.getByRole('button', { name: 'Cerrar controles' }).click();
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    await expect(ra).toHaveValue('12 30 15');
    const paint = menus.filter({
      has: page.locator(':scope > summary', { hasText: 'Paint' }),
    });
    await paint.locator(':scope > summary').click();
    await expect(page.getByRole('button', { name: 'Lápiz', exact: true })).toBeVisible();
    await page.getByLabel('Mostrar anotaciones', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click();
    await paint.locator(':scope > summary').press('Enter');
    await expect(page.getByLabel('Mostrar anotaciones', { exact: true })).not.toBeChecked();
  });
