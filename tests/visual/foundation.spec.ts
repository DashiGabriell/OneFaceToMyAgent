import { expect, test } from '@playwright/test'

test('demo loads without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')

  await expect(page.locator('#app')).toContainText('Rosto SVG')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  expect(errors).toEqual([])
})
