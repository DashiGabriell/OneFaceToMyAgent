import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const snapshotPath = fileURLToPath(new URL('../snapshots/speech.png', import.meta.url))

test('speaks with the audio clock and repeats the phrase from cache', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-phase', '6')

  const gate = page.locator('[data-audio-gate]')
  await expect(gate).toBeVisible()
  await gate.click()
  await expect(gate).toHaveCount(0)

  const status = page.locator('[data-speech-status]')
  await page.locator('[data-speech-text]').fill('Olá, eu falo português com naturalidade.')
  await page.locator('[data-speech-emotion]').selectOption('happy')
  await page.locator('[data-speak]').click()

  await expect(status).toHaveAttribute('data-state', 'speaking', { timeout: 15_000 })
  await expect(status).toContainText('falando')

  const mouth = page.locator('#face [data-part="jaw"]')
  await page.waitForTimeout(500)
  const first = await mouth.evaluate((element) => getComputedStyle(element).transform)
  await page.waitForTimeout(300)
  const second = await mouth.evaluate((element) => getComputedStyle(element).transform)
  expect(second).not.toBe(first)

  const viseme = await page.locator('html').getAttribute('data-viseme')
  expect(viseme).toBeTruthy()

  const mood = await page.evaluate(() => {
    const avatar = (
      window as Window & {
        __avatar?: {
          emotions: { mixer: { getState(): { mood: Array<{ emotion: string }> } } }
        }
      }
    ).__avatar
    return avatar?.emotions.mixer.getState().mood[0]?.emotion ?? null
  })
  expect(mood).toBe('happy')

  await page.screenshot({ path: snapshotPath })
  await expect(status).toHaveAttribute('data-state', 'idle', { timeout: 15_000 })
  await expect(status).toHaveText('pronto')

  await page.locator('[data-speak]').click()
  await expect(status).toContainText('cache', { timeout: 15_000 })
  await expect(status).toHaveAttribute('data-state', 'idle', { timeout: 15_000 })

  expect(errors).toEqual([])
})

test('shows voice unavailable when the TTS API fails', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.route('**/api/tts', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'voice_unavailable', message: 'voz indisponível' }),
    }),
  )

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
  await page.locator('[data-audio-gate]').click()

  const status = page.locator('[data-speech-status]')
  await page.locator('[data-speak]').click()

  await expect(status).toHaveAttribute('data-state', 'error', { timeout: 10_000 })
  await expect(status).toHaveText('voz indisponível')
  expect(errors).toEqual([])
})
