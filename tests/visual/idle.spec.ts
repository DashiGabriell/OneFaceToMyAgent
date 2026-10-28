import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/idle.png', import.meta.url))

test('keeps idle motion, aria-live and reduced-motion behavior', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '6')

  const live = page.locator('[data-avatar-live]')
  await expect(live).toHaveAttribute('aria-live', 'polite')

  const head = page.locator('#face [data-part="head"]')
  await page.waitForTimeout(700)
  const first = await head.evaluate((element) => getComputedStyle(element).transform)
  await page.waitForTimeout(900)
  const second = await head.evaluate((element) => getComputedStyle(element).transform)
  expect(second).not.toBe(first)

  const fps = await page.evaluate(async () => {
    const avatar = (
      window as Window & {
        __avatar?: { engine: { snapshot(): { fps: number; frameMs: number } } }
      }
    ).__avatar
    await new Promise((resolve) => setTimeout(resolve, 500))
    return avatar?.engine.snapshot() ?? null
  })
  expect(fps).toBeTruthy()
  expect(fps!.fps).toBeGreaterThan(45)
  expect(fps!.frameMs).toBeLessThan(6)

  await page.screenshot({ path: snapshotPath })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')

  const reduced = await page.evaluate(async () => {
    const avatar = (
      window as Window & {
        __avatar?: {
          idle: {
            update(
              dt: number,
              input: { speaking: boolean; energy: number },
            ): { headYaw?: number; headPitch?: number; breath?: number }
          }
        }
      }
    ).__avatar
    if (!avatar) return null
    let maxYaw = 0
    for (let index = 0; index < 120; index += 1) {
      const delta = avatar.idle.update(1 / 60, { speaking: true, energy: 0.9 })
      maxYaw = Math.max(maxYaw, Math.abs(delta.headYaw ?? 0))
    }
    return maxYaw
  })
  expect(reduced).toBe(0)
  expect(errors).toEqual([])
})
