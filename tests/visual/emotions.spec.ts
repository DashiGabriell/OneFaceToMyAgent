import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/emotions.png', import.meta.url))

test('renders five emotions across three visemes in one contact sheet', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?emotions=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '6')

  const grid = page.locator('#emotion-grid')
  await expect(grid).toBeVisible()
  await expect(grid.locator('.rig-cell')).toHaveCount(15)

  const cells = await grid.locator('.rig-cell').evaluateAll((items) =>
    items.map((item) => {
      const element = item as HTMLElement
      return { emotion: element.dataset.emotion, viseme: element.dataset.viseme }
    }),
  )
  expect(Array.from(new Set(cells.map((cell) => cell.emotion))).sort()).toEqual([
    'happy',
    'neutral',
    'sad',
    'surprised',
    'thinking',
  ])
  expect(Array.from(new Set(cells.map((cell) => cell.viseme))).sort()).toEqual(['a', 'mbp', 'o'])

  await page.addStyleTag({
    content:
      'body{display:block!important;padding:0!important;background:#f3f1ed!important;} #app{display:none!important;} #emotion-grid{position:static!important;height:auto!important;overflow:visible!important;}',
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: snapshotPath, fullPage: true })

  expect(errors).toEqual([])
})

test('switches three emotions live during speech without resetting the mouth', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?debug=1')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '6')

  const panel = page.locator('#debug-panel')
  const playbackStatus = panel.locator('[data-lipsync-status]')
  const emotionStatus = panel.locator('[data-emotion-status]')
  const mouth = page.locator('#face [data-part="mouth"]')
  const brow = page.locator('#face [data-part="browL"]')

  await panel
    .locator('[data-lipsync-tagged-input]')
    .fill(
      '[EMO:happy] Olá! Eu falo português com muita naturalidade e continuo falando por bastante tempo para testar a troca de emoção ao vivo.',
    )
  await panel.locator('[data-lipsync-tagged]').click()
  await expect(playbackStatus).toHaveText('tocando')

  await page.waitForTimeout(1100)
  await expect(emotionStatus).toHaveAttribute('data-layer', 'mood')
  await expect(emotionStatus).toContainText('mood: happy')
  const happyBrow = await brow.evaluate((element) => getComputedStyle(element).transform)

  await panel.locator('[data-emotion="sad"]').click()
  await page.waitForTimeout(700)
  await expect(emotionStatus).toContainText('mood: sad')
  await expect(playbackStatus).toHaveText('tocando')
  const sadBrow = await brow.evaluate((element) => getComputedStyle(element).transform)
  expect(sadBrow).not.toBe(happyBrow)

  await panel.locator('[data-emotion="surprised"]').click()
  await page.waitForTimeout(700)
  await expect(emotionStatus).toContainText('mood: surprised')
  await expect(playbackStatus).toHaveText('tocando')

  const firstMouth = await mouth.evaluate((element) => getComputedStyle(element).transform)
  await page.waitForTimeout(220)
  const secondMouth = await mouth.evaluate((element) => getComputedStyle(element).transform)
  expect(secondMouth).not.toBe(firstMouth)

  await panel.locator('[data-emotion="happy"]').click()
  await page.waitForTimeout(700)
  await expect(emotionStatus).toContainText('mood: happy')

  await panel.locator('[data-emotion-react]').click()
  await expect(emotionStatus).toHaveAttribute('data-layer', 'reaction')
  await expect
    .poll(async () => Number(await emotionStatus.getAttribute('data-ttl')), { timeout: 8_000 })
    .toBe(0)
  await expect(emotionStatus).toHaveAttribute('data-layer', 'mood')

  await panel.locator('[data-lipsync-stop]').click()
  await expect(playbackStatus).toHaveText('parado')

  expect(errors).toEqual([])
})
