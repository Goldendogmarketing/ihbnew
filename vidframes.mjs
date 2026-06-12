// Extract frames from the loading video to verify the sequence.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.setContent(
  `<body style="margin:0;background:#000"><video id="v" src="http://localhost:5181/brand/loading.mp4" style="width:100%;height:100%" muted></video></body>`,
)
await page.waitForFunction(() => document.getElementById('v').readyState >= 2, null, { timeout: 20000 })
for (const t of [0.2, 2.5, 5, 7.5, 9.6]) {
  await page.evaluate(async (time) => {
    const v = document.getElementById('v')
    v.currentTime = time
    await new Promise((r) => {
      v.onseeked = r
    })
  }, t)
  await page.waitForTimeout(250)
  await page.screenshot({ path: `shots/vid-${String(t).replace('.', '_')}.png` })
}
await browser.close()
console.log('frames extracted')
