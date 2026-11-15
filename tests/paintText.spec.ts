import { expect, test } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures';

test.beforeEach(async ({ page }) => {
  await installArchiveFixtures(page);
});

test('text and space symbols edit, undo, follow the sky and share both panes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.locator('spherex-paint').locator('summary').first().click();
  await page.getByRole('button', { name: 'T + Texto / símbolos' }).click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('Centauri\nλ = 2 μm');
  await page.getByRole('button', { name: 'Insertar símbolo α', exact: true }).click();
  await page.getByRole('slider', { name: 'Tamaño del texto', exact: true }).fill('36');
  await page.getByRole('button', { name: 'Guardar texto', exact: true }).click();
  const text = page.locator('.study-annotations text[data-item]');
  await expect(text).toHaveCount(1);
  await expect(text).toContainText('λ = 2 μmα');
  await page.getByRole('button', { name: 'Editar texto seleccionado' }).click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('α Centauri\nΔ = ±5°');
  await page.getByRole('button', { name: 'Guardar texto', exact: true }).click();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(text).toContainText('λ = 2 μmα');
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect(text).toContainText('Δ = ±5°');
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').check();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await text.dblclick();
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await expect(page.getByRole('textbox', { name: 'Texto', exact: true })).toHaveValue(
    'α Centauri\nΔ = ±5°',
  );
  await page.getByRole('button', { name: 'Cancelar texto' }).click();
  await page.getByRole('slider', { name: 'Transparencia', exact: true }).fill('35');
  await expect(text).toHaveAttribute('opacity', '0.65');
  await page.getByRole('button', { name: 'Pantalla dividida', exact: true }).click();
  await expect(text).toHaveCount(2);
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').uncheck();
  const before = await text.first().locator('tspan').first().getAttribute('x');
  await page.getByTitle('Cielo SPHEREx').first().contentFrame().locator('#sky').press('ArrowRight');
  await expect.poll(() => text.first().locator('tspan').first().getAttribute('x')).not.toBe(before);
});
