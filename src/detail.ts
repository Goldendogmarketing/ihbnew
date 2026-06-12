import gsap from 'gsap'
import { asset, type Project } from './data'
import type { Rect } from './gallery'

interface OpenOpts {
  /** Recompute the card's current screen rect (camera may have dollied). */
  rectNow: () => Rect
  /** Called when the floating image has landed back on the card. */
  onClose: () => void
}

/**
 * The detail page. Opens with a FLIP-style transition: the clicked card's
 * image lifts off the sphere and expands into the hero slot while the page
 * fades in beneath it.
 */
export class DetailView {
  isOpen = false

  private el = document.getElementById('detail') as HTMLElement
  private bg = this.el.querySelector('.detail-bg') as HTMLElement
  private scroller = this.el.querySelector('.detail-scroll') as HTMLElement
  private titleEl = this.el.querySelector('.d-title') as HTMLElement
  private clientEl = this.el.querySelector('.d-client') as HTMLElement
  private yearEl = this.el.querySelector('.d-year') as HTMLElement
  private tagsEl = this.el.querySelector('.d-tags') as HTMLElement
  private blurbEl = this.el.querySelector('.d-blurb') as HTMLElement
  private linkEl = this.el.querySelector('.d-link') as HTMLAnchorElement
  private heroEl = this.el.querySelector('.detail-hero') as HTMLElement
  private imgEl = this.el.querySelector('.d-img') as HTMLImageElement
  private backBtn = document.getElementById('back') as HTMLButtonElement

  private floating: HTMLImageElement | null = null
  private opts: OpenOpts | null = null
  private closing = false
  private suppressPop = false

  constructor() {
    this.backBtn.addEventListener('click', () => this.close())
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close()
    })
    window.addEventListener('popstate', () => {
      if (this.isOpen && !this.suppressPop) this.close(true)
      this.suppressPop = false
    })
  }

  open(project: Project, fromRect: Rect, opts: OpenOpts): void {
    if (this.isOpen) return
    this.isOpen = true
    this.closing = false
    this.opts = opts

    // populate
    this.clientEl.textContent = project.client
    this.yearEl.textContent = project.year
    this.titleEl.innerHTML = project.title
      .split(/\s+/)
      .map((w) => `<span class="w"><span>${w}</span></span>`)
      .join('')
    this.tagsEl.innerHTML = project.tags.map((t) => `<span class="d-tag">${t}</span>`).join('')
    this.blurbEl.textContent = project.blurb
    this.linkEl.href = project.url
    this.imgEl.src = asset(project.image)
    this.heroEl.classList.remove('ready')
    this.scroller.scrollTop = 0

    this.el.hidden = false
    this.el.setAttribute('aria-hidden', 'false')
    history.pushState({ detail: project.id }, '', `#${project.id}`)

    // floating FLIP image
    const fl = document.createElement('img')
    fl.className = 'floating-img'
    fl.src = asset(project.image)
    fl.draggable = false
    this.placeRect(fl, fromRect)
    document.body.appendChild(fl)
    this.floating = fl

    const heroRect = this.heroEl.getBoundingClientRect()

    gsap.set(this.bg, { opacity: 0 })
    gsap.set(this.backBtn, { opacity: 0, y: -10 })
    const textTargets = [this.clientEl.parentElement, this.tagsEl, this.blurbEl, this.linkEl]
    gsap.set(textTargets, { opacity: 0, y: 24 })
    const words = this.titleEl.querySelectorAll('.w > span')
    gsap.set(words, { yPercent: 118 })

    const tl = gsap.timeline()
    tl.to(this.bg, { opacity: 1, duration: 0.65, ease: 'power2.out' }, 0)
    tl.to(
      fl,
      {
        left: heroRect.left,
        top: heroRect.top,
        width: heroRect.width,
        height: heroRect.height,
        borderRadius: 16,
        duration: 0.95,
        ease: 'expo.inOut',
        onComplete: () => {
          this.heroEl.classList.add('ready')
          fl.remove()
          if (this.floating === fl) this.floating = null
        },
      },
      0.05,
    )
    tl.to(words, { yPercent: 0, duration: 0.85, ease: 'power4.out', stagger: 0.05 }, 0.45)
    tl.to(textTargets, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07 }, 0.6)
    tl.to(this.backBtn, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.7)
  }

  close(fromPop = false): void {
    if (!this.isOpen || this.closing || !this.opts) return
    this.closing = true

    if (!fromPop && location.hash) {
      this.suppressPop = true
      history.back()
    }

    const opts = this.opts
    const heroRect = this.heroEl.getBoundingClientRect()
    const target = opts.rectNow()

    // swap the in-flow hero for a floating clone that flies home
    this.floating?.remove()
    const fl = document.createElement('img')
    fl.className = 'floating-img'
    fl.src = this.imgEl.src
    fl.draggable = false
    this.placeRect(fl, {
      left: heroRect.left,
      top: heroRect.top,
      width: heroRect.width,
      height: heroRect.height,
    })
    fl.style.borderRadius = '16px'
    document.body.appendChild(fl)
    this.floating = fl
    this.heroEl.classList.remove('ready')

    const words = this.titleEl.querySelectorAll('.w > span')
    const textTargets = [this.clientEl.parentElement, this.tagsEl, this.blurbEl, this.linkEl]

    const tl = gsap.timeline({
      onComplete: () => {
        this.el.hidden = true
        this.el.setAttribute('aria-hidden', 'true')
        this.isOpen = false
        this.closing = false
        this.opts = null
      },
    })
    tl.to(this.backBtn, { opacity: 0, y: -10, duration: 0.3, ease: 'power2.in' }, 0)
    tl.to(textTargets, { opacity: 0, y: 16, duration: 0.3, ease: 'power2.in' }, 0)
    tl.to(words, { yPercent: -115, duration: 0.4, ease: 'power3.in', stagger: 0.02 }, 0)
    tl.to(
      fl,
      {
        left: target.left,
        top: target.top,
        width: target.width,
        height: target.height,
        borderRadius: 12,
        duration: 0.8,
        ease: 'expo.inOut',
        onComplete: () => {
          opts.onClose()
          fl.remove()
          if (this.floating === fl) this.floating = null
        },
      },
      0.12,
    )
    tl.to(this.bg, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 0.45)
  }

  private placeRect(el: HTMLElement, r: Rect): void {
    el.style.left = `${r.left}px`
    el.style.top = `${r.top}px`
    el.style.width = `${r.width}px`
    el.style.height = `${r.height}px`
  }
}
