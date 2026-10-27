import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/debug-panel.png', import.meta.url))

test('debug panel exposes every channel and drives the rig', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?debug=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '3')

  const panel = page.locator('#debug-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.debug-row')).toHaveCount(29)
  await expect(panel.locator('.debug-group')).toHaveCount(6)

  const bounds = await page.evaluate(() => {
    const avatar = (window as Window & { __avatar?: { engine: { getBounds(): { width: number; height: number } } } }).__avatar
    return avatar?.engine.getBounds()
  })
  expect(bounds?.width ?? 0).toBeGreaterThan(0)
  expect(bounds?.height ?? 0).toBeGreaterThan(0)

  const jaw = page.locator('#face [data-part="jaw"]')
  const head = page.locator('#face [data-part="head"]')
  const neutralJaw = await jaw.evaluate((element) => getComputedStyle(element).transform)
  const neutralHead = await head.evaluate((element) => getComputedStyle(element).transform)

  const jawInput = panel.locator('.debug-row[data-channel="jawOpen"] input')
  await jawInput.evaluate((input: HTMLInputElement) => {
    input.value = '1'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForTimeout(450)
  const openJaw = await jaw.evaluate((element) => getComputedStyle(element).transform)
  expect(openJaw).not.toBe(neutralJaw)

  const headInput = panel.locator('.debug-row[data-channel="headYaw"] input')
  await headInput.evaluate((input: HTMLInputElement) => {
    input.value = '8'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForTimeout(450)
  const turnedHead = await head.evaluate((element) => getComputedStyle(element).transform)
  expect(turnedHead).not.toBe(neutralHead)

  await panel.locator('[data-debug-reset]').click()
  await page.waitForTimeout(120)
  const resetJaw = await jaw.evaluate((element) => getComputedStyle(element).transform)
  const resetHead = await head.evaluate((element) => getComputedStyle(element).transform)
  expect(resetJaw).toBe(neutralJaw)
  expect(resetHead).toBe(neutralHead)

  await panel.locator('[data-debug-extremes]').click()
  await page.waitForTimeout(120)
  await expect(jawInput).toHaveValue('1')

  await page.waitForTimeout(700)
  const frameMs = Number(await panel.locator('[data-debug-stats]').getAttribute('data-frame-ms'))
  expect(frameMs).toBeLessThan(6)

  await page.screenshot({ path: snapshotPath })
  expect(errors).toEqual([])
})
