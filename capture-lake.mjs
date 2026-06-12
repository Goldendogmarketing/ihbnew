// Capture lakeregionpropertyresource.com full-page, matching the other
// screenshots' 2434px width (1217 CSS px @ 2x).
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1217, height: 760 },
    deviceScaleFactor: 2,
  })
  await page.goto('https://www.lakeregionpropertyresource.com', {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  // nudge lazy-loaded sections
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0
      const step = () => {
        y += 900
        window.scrollTo(0, y)
        if (y < document.body.scrollHeight) setTimeout(step, 120)
        else {
          window.scrollTo(0, 0)
          setTimeout(resolve, 600)
        }
      }
      step()
    })
  })
  await page.waitForTimeout(1200)
  await page.screenshot({
    path: 'public/sites/lakeregion.jpg',
    fullPage: true,
    type: 'jpeg',
    quality: 80,
  })
  console.log('captured lakeregion.jpg')
} finally {
  await browser.close()
}
