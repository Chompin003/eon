import type { Page } from '@playwright/test';

/** Existing module scenarios need their controls visible; use actual disclosures. */
export async function openControls(page: Page) {
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  for (const menu of await page.locator('[data-control-menu]').all()) {
    if ((await menu.getAttribute('open')) === null) await menu.locator(':scope > summary').click();
  }
}
