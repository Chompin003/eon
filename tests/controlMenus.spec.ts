import { test, expect } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures';

test('menus start compact, work with keyboard and preserve coordinate drafts', async ({ page }) => {
  await installArchiveFixtures(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const menus = page.locator('[data-control-menu]');
  await expect(menus).toHaveCount(8);
  await expect(page.locator('[data-control-menu][open]')).toHaveCount(0);
  const coordinates = menus.filter({
    has: page.locator(':scope > summary', { hasText: 'Coordenadas' }),
  });
  await coordinates.locator(':scope > summary').press('Enter');
  const ra = page.getByLabel('Ascensión recta · H M S');
  await ra.fill('12 30 15');
  await coordinates.locator(':scope > summary').click();
  await expect(ra).not.toBeVisible();
  await coordinates.locator(':scope > summary').press('Enter');
  await expect(ra).toHaveValue('12 30 15');
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await expect(ra).toHaveValue('12 30 15');
});
