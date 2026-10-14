import { expect, test, type Page } from './fixtures'

type AudioProbe = { contexts: number; oscillators: number }

/** Counts AudioContexts and oscillator starts, so the spec can hear the music loop without a speaker. */
const probe = `(() => {
  const audio = { contexts: 0, oscillators: 0 }
  window.__audio = audio
  const Base = window.AudioContext
  window.AudioContext = class extends Base {
    constructor(...args) {
      super(...args)
      audio.contexts++
    }
  }
  const start = OscillatorNode.prototype.start
  OscillatorNode.prototype.start = function (...args) {
    audio.oscillators++
    return start.apply(this, args)
  }
})()`

const read = (page: Page) => page.evaluate<AudioProbe>('window.__audio')

/** Oscillators started over a second of idle lobby, where only the music loop makes sound. */
async function loopNotes(page: Page) {
  await page.waitForTimeout(300)
  const before = (await read(page)).oscillators
  await page.waitForTimeout(1000)
  return (await read(page)).oscillators - before
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(probe)
})

test('the music loop starts on the first tap and follows the Music toggle, mute, and a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-title')).toBeVisible()
  await page.waitForTimeout(500)
  expect(await read(page)).toEqual({ contexts: 0, oscillators: 0 })

  await page.getByTestId('app-title').click()
  await expect.poll(async () => (await read(page)).contexts).toBe(1)
  expect(await loopNotes(page)).toBeGreaterThan(5)

  await page.getByTestId('hud-settings').click()
  await page.getByTestId('setting-music-off').click()
  expect(await loopNotes(page)).toBe(0)
  await page.getByTestId('settings-close').click()

  await page.reload()
  await page.getByTestId('app-title').click()
  await expect.poll(async () => (await read(page)).contexts).toBe(1)
  expect(await loopNotes(page)).toBe(0)

  await page.getByTestId('hud-settings').click()
  await page.getByTestId('setting-music-on').click()
  await page.getByTestId('settings-close').click()
  expect(await loopNotes(page)).toBeGreaterThan(5)

  await page.getByTestId('hud-sound').click()
  expect(await loopNotes(page)).toBe(0)
  await page.getByTestId('hud-sound').click()
  expect(await loopNotes(page)).toBeGreaterThan(5)
})
