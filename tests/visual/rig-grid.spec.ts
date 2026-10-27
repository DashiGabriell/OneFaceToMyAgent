import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const gridPath = fileURLToPath(new URL('../snapshots/rig-grid.png', import.meta.url))

test('renders both extremes of every channel in one contact sheet', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?grid=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '3')

  const grid = page.locator('#rig-grid')
  await expect(grid).toBeVisible()
  await expect(grid.locator('.rig-cell')).toHaveCount(58)

  const channelCount = await grid.locator('.rig-cell').evaluateAll(
    (cells) => new Set(cells.map((cell) => (cell as HTMLElement).dataset.gridChannel)).size,
  )
  expect(channelCount).toBe(29)

  await page.addStyleTag({
    content:
      'body{display:block!important;padding:0!important;background:#f3f1ed!important;} #app{display:none!important;} #rig-grid{position:static!important;height:auto!important;overflow:visible!important;}',
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: gridPath, fullPage: true })

  expect(errors).toEqual([])
})
