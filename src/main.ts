import './styles.css'
import '@fontsource-variable/inter'
import '@fontsource/instrument-serif'
import gsap from 'gsap'
import { PROJECTS } from './data'
import { SphereGallery } from './gallery'
import { loadCardArts, type CardArt } from './textures'
import { DetailView } from './detail'
import { Loader } from './loader'

const app = document.getElementById('app') as HTMLElement
const hint = document.getElementById('hint') as HTMLElement
const hintText = document.getElementById('hint-text') as HTMLElement
const gyroBtn = document.getElementById('gyro') as HTMLButtonElement
const tooltip = document.getElementById('tooltip') as HTMLElement
const ttTitle = tooltip.querySelector('.tt-title') as HTMLElement
const ttTags = tooltip.querySelector('.tt-tags') as HTMLElement
const statusCount = document.getElementById('status-count') as HTMLElement

const isCoarse = window.matchMedia('(pointer: coarse)').matches

statusCount.textContent = String(PROJECTS.length).padStart(2, '0')
if (isCoarse) hintText.textContent = 'Swipe to look around'
app.addEventListener('contextmenu', (e) => e.preventDefault())

const loader = new Loader()
loader.start()

const gallery = new SphereGallery(app)
const detail = new DetailView()

// ---- tooltip follows the cursor (desktop hover) -------------------------
const ttToX = gsap.quickTo(tooltip, 'left', { duration: 0.4, ease: 'power3' })
const ttToY = gsap.quickTo(tooltip, 'top', { duration: 0.4, ease: 'power3' })
let ttSeeded = false
gallery.onHover = (art: CardArt | null, x: number, y: number) => {
  if (!art) {
    tooltip.classList.remove('on')
    return
  }
  ttTitle.textContent = art.project.title
  ttTags.textContent = `${art.project.tags.join(' · ')} — ${art.project.year}`
  tooltip.hidden = false
  if (!ttSeeded) {
    gsap.set(tooltip, { left: x, top: y })
    ttSeeded = true
  }
  tooltip.classList.add('on')
  ttToX(x)
  ttToY(y)
}

// ---- card click -> focus + detail page ----------------------------------
gallery.onCardClick = (hit) => {
  if (detail.isOpen) return
  tooltip.classList.remove('on')
  const fromRect = gallery.screenRect(hit.mesh)
  gallery.focusCard(hit.mesh)
  detail.open(hit.art.project, fromRect, {
    rectNow: () => gallery.screenRect(hit.mesh),
    onClose: () => gallery.unfocus(),
  })
}

// ---- load assets behind the loading film ---------------------------------
;(async () => {
  try {
    await document.fonts.ready
  } catch {
    /* fonts are best-effort */
  }
  const arts = await loadCardArts(PROJECTS, gallery.renderer, (p) => loader.setProgress(p * 0.96))
  gallery.populate(arts)
  loader.assetsReady()
})().catch((err) => {
  console.error('[boot]', err)
})

// ---- enter the sphere -----------------------------------------------------
loader.onEnter = () => {
  gallery.intro(() => {
    gsap.to(['#chrome-top', '#chrome-bottom'], { opacity: 1, duration: 1.1, ease: 'power2.out' })
  })
}

// hide the hint after the first real look-around
let hintHidden = false
const hideHint = (): void => {
  if (hintHidden || !gallery.started) return
  hintHidden = true
  setTimeout(() => hint.classList.add('is-hidden'), 1200)
}
app.addEventListener('pointerdown', hideHint)
window.addEventListener('wheel', hideHint, { passive: true })

// ---- keyboard support -----------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (detail.isOpen) return
  const step = 0.42
  if (e.key === 'ArrowLeft') gallery.controls.nudge(-step, 0)
  else if (e.key === 'ArrowRight') gallery.controls.nudge(step, 0)
  else if (e.key === 'ArrowUp') gallery.controls.nudge(0, step * 0.55)
  else if (e.key === 'ArrowDown') gallery.controls.nudge(0, -step * 0.55)
})

// ---- gyro toggle (touch devices) ------------------------------------------
const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
if (isCoarse && hasTouch && 'DeviceOrientationEvent' in window) {
  gyroBtn.hidden = false
  gyroBtn.addEventListener('click', async () => {
    if (gallery.controls.gyroActive) {
      gallery.controls.disableGyro()
      gyroBtn.textContent = 'Enable motion'
      gyroBtn.classList.remove('active')
      return
    }
    const ok = await gallery.controls.enableGyro()
    if (ok) {
      gyroBtn.textContent = 'Motion on';
      gyroBtn.classList.add('active')
      hideHint()
    } else {
      gyroBtn.textContent = 'Motion unavailable'
      gyroBtn.disabled = true
      setTimeout(() => {
        gyroBtn.hidden = true
      }, 1800)
    }
  })
}
