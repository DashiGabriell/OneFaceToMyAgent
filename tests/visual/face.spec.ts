import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/face-neutral.png', import.meta.url))

test('neutral face renders with all rig parts', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '3')

  const face = page.locator('#face')
  await expect(face).toBeVisible()

  const box = await face.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.width ?? 0).toBeGreaterThan(300)
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(1000 / 1200, 2)

  const parts = await face.locator('[data-part]').count()
  expect(parts).toBeGreaterThanOrEqual(35)

  const transformBox = await face
    .locator('[data-part="jaw"]')
    .evaluate((element) => getComputedStyle(element).transformBox)
  expect(transformBox).toBe('fill-box')

  await page.locator('#face-stage').screenshot({ path: snapshotPath })
  expect(errors).toEqual([])
})
