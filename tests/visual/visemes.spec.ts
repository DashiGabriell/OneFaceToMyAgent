import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/visemes.png', import.meta.url))

test('renders all 12 viseme shapes in one contact sheet', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?visemes=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '3')

  const grid = page.locator('#viseme-grid')
  await expect(grid).toBeVisible()
  await expect(grid.locator('.rig-cell')).toHaveCount(12)

  const names = await grid.locator('.rig-cell').evaluateAll((cells) =>
    cells.map((cell) => (cell as HTMLElement).dataset.viseme),
  )
  expect(new Set(names).size).toBe(12)

  await page.addStyleTag({
    content:
      'body{display:block!important;padding:0!important;background:#f3f1ed!important;} #app{display:none!important;} #viseme-grid{position:static!important;height:auto!important;overflow:visible!important;}',
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: snapshotPath, fullPage: true })

  expect(errors).toEqual([])
})
