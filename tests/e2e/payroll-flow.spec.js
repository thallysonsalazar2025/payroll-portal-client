import { test, expect } from '@playwright/test';

test('fluxo completo da tela de payroll', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'abc' }) });
  });
  await page.route('**/api/payroll/generate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requestId: 'REQ-1' }) });
  });
  await page.route('**/api/payroll/status?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'COMPLETED' }) });
  });
  await page.route('**/api/payroll/events?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ step: 'PUBLISHED' }, { step: 'DONE' }]) });
  });
  await page.route('**/api/payroll/download?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: 'pdf-content' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Autenticar' }).click();
  await expect(page.locator('#log-panel')).toContainText('Autenticação realizada com sucesso');

  await page.getByRole('button', { name: 'Gerar' }).click();
  await expect(page.locator('#request-id')).toContainText('REQ-1');

  await page.getByRole('button', { name: 'Consultar status' }).click();
  await expect(page.locator('#status-output')).toContainText('COMPLETED');

  await page.getByRole('button', { name: 'Consultar eventos' }).click();
  await expect(page.locator('#status-output')).toContainText('PUBLISHED');
});
