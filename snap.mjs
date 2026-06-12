// Headless test driver: loads the gallery, exercises drag / hover / click /
// back / mobile tap, and saves screenshots to shots/.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('shots', { recursive: true })
const URL = 'http://localhost:5181'

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

const errors = []
const consoleMsgs = []

async function desktopFlow() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } })
  page.on('pageerror', (e) => errors.push(`[desktop pageerror] ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`[desktop ${m.type()}] ${m.text()}`)
  })

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'shots/01-loader.png' })

  // wait until the loader is gone (fallback min-time + assets + enter anim)
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('loader')).display === 'none',
    null,
    { timeout: 25000 },
  )
  await page.waitForTimeout(2800) // intro settles
  await page.screenshot({ path: 'shots/02-gallery.png' })

  // drag look-around (left, with fling)
  await page.mouse.move(720, 405)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(720 - i * 38, 405 + i * 6, { steps: 2 })
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  await page.waitForTimeout(350)
  await page.screenshot({ path: 'shots/03-mid-drag.png' })
  await page.waitForTimeout(1600) // momentum settles
  await page.screenshot({ path: 'shots/04-after-drag.png' })

  // hover a card near center for tooltip
  await page.mouse.move(720, 380, { steps: 6 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'shots/05-hover.png' })

  // click to open detail
  await page.mouse.click(720, 380)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'shots/06-detail-mid.png' })
  await page.waitForTimeout(1300)
  await page.screenshot({ path: 'shots/07-detail.png' })

  const detailVisible = await page.evaluate(() => !document.getElementById('detail').hidden)
  console.log('detail open:', detailVisible)

  // back
  await page.click('#back')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'shots/08-back-mid.png' })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: 'shots/09-back-gallery.png' })

  const detailHidden = await page.evaluate(() => document.getElementById('detail').hidden)
  console.log('detail closed:', detailHidden)
  await page.close()
}

async function mobileFlow() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  page.on('pageerror', (e) => errors.push(`[mobile pageerror] ${e.message}`))

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('loader')).display === 'none',
    null,
    { timeout: 25000 },
  )
  await page.waitForTimeout(2800)
  await page.screenshot({ path: 'shots/10-mobile-gallery.png' })

  const gyroVisible = await page.evaluate(() => {
    const b = document.getElementById('gyro')
    return b && !b.hidden
  })
  console.log('gyro button visible on mobile:', gyroVisible)

  // swipe to look around
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 300, y: 420 }],
  })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 300 - i * 22, y: 420 }],
    })
    await new Promise((r) => setTimeout(r, 16))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'shots/11-mobile-swiped.png' })

  // tap a card to open detail
  await page.touchscreen.tap(195, 400)
  await page.waitForTimeout(1700)
  await page.screenshot({ path: 'shots/12-mobile-detail.png' })
  const detailOpen = await page.evaluate(() => !document.getElementById('detail').hidden)
  console.log('mobile detail open:', detailOpen)

  // back to gallery
  await page.tap('#back')
  await page.waitForTimeout(1600)
  await page.screenshot({ path: 'shots/13-mobile-back.png' })
  await page.close()
}

try {
  await desktopFlow()
  await mobileFlow()
} finally {
  await browser.close()
}

console.log('--- console msgs ---')
for (const m of consoleMsgs.slice(0, 20)) console.log(m)
console.log('--- errors ---')
for (const e of errors) console.log(e)
console.log(errors.length === 0 ? 'NO PAGE ERRORS' : `${errors.length} PAGE ERRORS`)
