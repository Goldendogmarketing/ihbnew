import gsap from 'gsap'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Set this to your Formspree endpoint (https://formspree.io/f/XXXXXXXX).
// While it's a placeholder the form simulates success locally so the flow
// can be previewed end-to-end.
const FORM_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'

/** Smooth-scroll helper that respects the fixed gallery hero. */
function scrollTo(selector: string): void {
  if (selector === '#top') {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    return
  }
  const el = document.querySelector(selector)
  el?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

// ---------------------------------------------------------------------------
// 3D tilt — cards lean toward the cursor with a moving glare highlight
// ---------------------------------------------------------------------------
function setupTilt(): void {
  if (reducedMotion) return
  const fine = window.matchMedia('(pointer: fine)').matches
  if (!fine) return

  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const inner = card.querySelector<HTMLElement>('.tilt-inner')
    if (!inner) return
    const rx = gsap.quickTo(inner, 'rotationX', { duration: 0.55, ease: 'power3.out' })
    const ry = gsap.quickTo(inner, 'rotationY', { duration: 0.55, ease: 'power3.out' })
    gsap.set(inner, { transformPerspective: 900 })

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width - 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5
      ry(nx * 10)
      rx(-ny * 10)
      card.style.setProperty('--gx', `${(nx + 0.5) * 100}%`)
      card.style.setProperty('--gy', `${(ny + 0.5) * 100}%`)
    })
    card.addEventListener('pointerleave', () => {
      rx(0)
      ry(0)
    })
  })
}

// ---------------------------------------------------------------------------
// Scroll-driven entrances — elements rise out of depth as sections arrive
// ---------------------------------------------------------------------------
function setupScrollAnimations(): void {
  const sections = document.querySelectorAll<HTMLElement>('.s-section')
  sections.forEach((section) => {
    const targets = section.querySelectorAll<HTMLElement>('.animate-in')
    if (!targets.length) return
    if (reducedMotion) return

    gsap.set(targets, { opacity: 0, y: 56, rotationX: 8, transformPerspective: 700, transformOrigin: '50% 100%' })
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          io.disconnect()
          gsap.to(targets, {
            opacity: 1,
            y: 0,
            rotationX: 0,
            duration: 0.95,
            ease: 'power3.out',
            stagger: 0.09,
            onStart: () => startCounters(section),
          })
        }
      },
      { threshold: 0.18 },
    )
    io.observe(section)
  })
  if (reducedMotion) {
    document.querySelectorAll<HTMLElement>('.stat-num[data-count]').forEach((el) => {
      el.textContent = `${el.dataset.count}${el.dataset.suffix ?? ''}`
    })
    document.querySelectorAll<HTMLElement>('.stat-num[data-text]').forEach((el) => {
      el.innerHTML = el.dataset.text ?? ''
    })
  }
}

// Continuous parallax: cards drift at slightly different speeds while scrolling,
// so nothing inside a section ever feels static.
function setupParallax(): void {
  if (reducedMotion) return
  const items: Array<{ el: HTMLElement; speed: number }> = []
  document.querySelectorAll<HTMLElement>('.svc-card, .proc-step, .quote, .h-cap').forEach((el, i) => {
    items.push({ el, speed: 14 + (i % 3) * 12 })
  })
  let latest = window.scrollY
  let current = latest
  window.addEventListener('scroll', () => (latest = window.scrollY), { passive: true })
  gsap.ticker.add(() => {
    current += (latest - current) * 0.12
    const vh = window.innerHeight
    for (const { el, speed } of items) {
      const r = el.getBoundingClientRect()
      const center = r.top + r.height / 2
      const offset = ((center - vh / 2) / vh) * speed
      el.style.translate = `0 ${(-offset).toFixed(2)}px`
    }
  })
}

function startCounters(section: HTMLElement): void {
  section.querySelectorAll<HTMLElement>('.stat-num[data-count]').forEach((el) => {
    const end = Number(el.dataset.count)
    const suffix = el.dataset.suffix ?? ''
    const proxy = { v: 0 }
    gsap.to(proxy, {
      v: end,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = `${Math.round(proxy.v)}${suffix}`
      },
    })
  })
  section.querySelectorAll<HTMLElement>('.stat-num[data-text]').forEach((el) => {
    el.innerHTML = el.dataset.text ?? ''
  })
}

// ---------------------------------------------------------------------------
// Hermes overlay page
// ---------------------------------------------------------------------------
class HermesPage {
  isOpen = false
  private el = document.getElementById('hermes-page') as HTMLElement
  private bg = this.el.querySelector('.hermes-bg') as HTMLElement
  private scroller = this.el.querySelector('.hermes-scroll') as HTMLElement
  private titleEl = this.el.querySelector('.h-title') as HTMLElement
  private backBtn = document.getElementById('hermes-back') as HTMLButtonElement

  constructor() {
    this.backBtn.addEventListener('click', () => this.close())
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close()
    })
    // split the title into word spans once, same treatment as the detail page
    this.titleEl.innerHTML = (this.titleEl.textContent ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `<span class="w"><span>${w}</span></span>`)
      .join('')
  }

  open(): void {
    if (this.isOpen) return
    this.isOpen = true
    this.el.hidden = false
    this.el.setAttribute('aria-hidden', 'false')
    this.scroller.scrollTop = 0

    const words = this.titleEl.querySelectorAll('.w > span')
    const blocks = this.el.querySelectorAll('.d-meta, .h-sub, .h-cap, .h-setup, .h-cta')
    gsap.set(this.bg, { opacity: 0 })
    gsap.set(this.backBtn, { opacity: 0, y: -10 })
    gsap.set(words, { yPercent: 118 })
    gsap.set(blocks, { opacity: 0, y: 30, rotationX: 6, transformPerspective: 700, transformOrigin: '50% 100%' })

    const tl = gsap.timeline()
    tl.to(this.bg, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0)
    tl.to(words, { yPercent: 0, duration: 0.85, ease: 'power4.out', stagger: 0.06 }, 0.25)
    tl.to(blocks, { opacity: 1, y: 0, rotationX: 0, duration: 0.75, ease: 'power3.out', stagger: 0.06 }, 0.4)
    tl.to(this.backBtn, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.55)
  }

  close(onClosed?: () => void): void {
    if (!this.isOpen) return
    const words = this.titleEl.querySelectorAll('.w > span')
    const blocks = this.el.querySelectorAll('.d-meta, .h-sub, .h-cap, .h-setup, .h-cta')
    const tl = gsap.timeline({
      onComplete: () => {
        this.el.hidden = true
        this.el.setAttribute('aria-hidden', 'true')
        this.isOpen = false
        onClosed?.()
      },
    })
    tl.to(this.backBtn, { opacity: 0, y: -10, duration: 0.25, ease: 'power2.in' }, 0)
    tl.to(blocks, { opacity: 0, y: 20, duration: 0.3, ease: 'power2.in' }, 0)
    tl.to(words, { yPercent: -115, duration: 0.35, ease: 'power3.in', stagger: 0.02 }, 0)
    tl.to(this.bg, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.2)
  }
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------
function setupContactForm(): void {
  const form = document.getElementById('contact-form') as HTMLFormElement
  const success = document.getElementById('form-success') as HTMLElement

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    if (!name || !email || !email.includes('@')) {
      gsap.fromTo(form, { x: -7 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.35)' })
      return
    }

    const btn = form.querySelector('.c-submit') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = 'Sending…'

    let ok = false
    if (FORM_ENDPOINT.includes('YOUR_FORM_ID')) {
      // demo mode until a real endpoint is configured
      await new Promise((r) => setTimeout(r, 600))
      ok = true
    } else {
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        })
        ok = res.ok
      } catch {
        ok = false
      }
    }

    if (!ok) {
      btn.disabled = false
      btn.textContent = 'Try again →'
      return
    }
    gsap.to(form, {
      opacity: 0,
      y: -16,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        form.hidden = true
        success.hidden = false
        gsap.fromTo(success, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      },
    })
  })
}

function preselectService(service: string): void {
  const select = document.querySelector<HTMLSelectElement>('#contact-form select[name="service"]')
  if (!select) return
  for (const opt of Array.from(select.options)) {
    if (opt.text === service) {
      select.value = opt.value || opt.text
      opt.selected = true
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
export interface SalesHooks {
  /** Close the project detail view if it's open (returns true if it was). */
  closeDetail?: () => boolean
}

export function initSalesPage(hooks: SalesHooks = {}): { hermes: HermesPage } {
  const hermes = new HermesPage()
  const cue = document.getElementById('scroll-cue') as HTMLButtonElement

  // smooth scroll for every [data-scroll] trigger
  document.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      const target = el.dataset.scroll!
      const service = el.dataset.service
      if (service) preselectService(service)
      const go = (): void => scrollTo(target)
      if (el.hasAttribute('data-close-hermes') && hermes.isOpen) hermes.close(go)
      else if (hooks.closeDetail?.()) setTimeout(go, 650)
      else go()
    })
  })

  // hermes triggers (nav link + service card)
  document.querySelectorAll<HTMLElement>('[data-hermes]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      hermes.open()
    })
  })

  // scroll cue: dive into services, hide once the user has scrolled
  cue.addEventListener('click', () => scrollTo('#services'))
  window.addEventListener(
    'scroll',
    () => {
      cue.classList.toggle('is-hidden', window.scrollY > window.innerHeight * 0.25)
    },
    { passive: true },
  )

  setupTilt()
  setupScrollAnimations()
  setupParallax()
  setupContactForm()

  return { hermes }
}
