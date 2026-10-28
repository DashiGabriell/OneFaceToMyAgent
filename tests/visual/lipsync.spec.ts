import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/lipsync.png', import.meta.url))

test('debug lip-sync loop drives the mouth and stops cleanly', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?debug=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '6')

  const panel = page.locator('#debug-panel')
  await expect(panel).toBeVisible()
  const status = panel.locator('[data-lipsync-status]')
  await expect(status).toHaveText('parado')

  const mouth = page.locator('#face [data-part="mouth"]')
  const neutral = await mouth.evaluate((element) => getComputedStyle(element).transform)

  await panel.locator('[data-lipsync-loop]').click()
  await expect(status).toHaveText('tocando')
  await page.waitForTimeout(1000)
  const first = await mouth.evaluate((element) => getComputedStyle(element).transform)
  await page.waitForTimeout(700)
  const second = await mouth.evaluate((element) => getComputedStyle(element).transform)
  expect(first).not.toBe(neutral)
  expect(second).not.toBe(first)

  await page.screenshot({ path: snapshotPath })

  await panel.locator('[data-lipsync-stop]').click()
  await expect(status).toHaveText('parado')
  await page.waitForTimeout(350)

  await panel.locator('[data-lipsync-phrase]').click()
  await expect(status).toHaveText('tocando')
  await page.waitForTimeout(350)
  await panel.locator('[data-lipsync-stop]').click()
  await expect(status).toHaveText('parado')

  expect(errors).toEqual([])
})
