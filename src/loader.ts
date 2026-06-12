import gsap from 'gsap'

/**
 * Cinematic loading screen. Plays the Higgsfield-generated laptop film
 * while textures preload behind it; a real progress line runs along the
 * bottom. Falls back to a pulsing ihb mark if the video is missing.
 */
export class Loader {
  onEnter?: () => void

  private el = document.getElementById('loader') as HTMLElement
  private video = document.getElementById('loader-video') as HTMLVideoElement
  private fallbackEl = this.el.querySelector('.loader-fallback') as HTMLElement
  private bar = this.el.querySelector('.loader-progress .bar i') as HTMLElement
  private pct = this.el.querySelector('.loader-progress .pct') as HTMLElement
  private label = this.el.querySelector('.pct-label') as HTMLElement
  private skipBtn = document.getElementById('skip') as HTMLButtonElement

  private assetsOk = false
  private videoDone = false
  private fallback = false
  private entered = false
  private videoStarted = false

  start(): void {
    this.skipBtn.addEventListener('click', () => {
      this.videoDone = true
      this.maybeEnter()
    })

    this.video.addEventListener('error', () => this.useFallback())
    this.video.addEventListener('ended', () => {
      this.videoDone = true
      this.skipBtn.hidden = true
      this.maybeEnter()
    })
    this.video.addEventListener('playing', () => {
      this.videoStarted = true
      gsap.to(this.video, { opacity: 1, duration: 1.1, ease: 'power2.out' })
      setTimeout(() => {
        if (!this.videoDone && !this.entered) this.skipBtn.hidden = false
      }, 1500)
    })

    this.video.src = `${import.meta.env.BASE_URL}brand/loading.mp4`
    this.video.play().catch(() => {
      if (!this.videoStarted) this.useFallback()
    })

    // safety: if the video never starts, fall back
    setTimeout(() => {
      if (!this.videoStarted && !this.fallback) this.useFallback()
    }, 5000)
  }

  private useFallback(): void {
    if (this.fallback || this.videoStarted) return
    this.fallback = true
    this.video.style.display = 'none'
    this.fallbackEl.hidden = false
    gsap.from(this.fallbackEl, { opacity: 0, scale: 0.94, duration: 0.8, ease: 'power2.out' })
    setTimeout(() => {
      this.videoDone = true
      this.maybeEnter()
    }, 2000)
  }

  setProgress(p: number): void {
    const clamped = Math.max(0, Math.min(1, p))
    this.bar.style.width = `${(clamped * 100).toFixed(0)}%`
    this.pct.textContent = `${(clamped * 100).toFixed(0)}%`
    if (clamped >= 1) this.label.textContent = 'READY'
  }

  assetsReady(): void {
    this.assetsOk = true
    this.setProgress(1)
    this.maybeEnter()
  }

  private maybeEnter(): void {
    if (this.entered || !this.assetsOk || !this.videoDone) return
    this.entered = true
    const tl = gsap.timeline({
      onComplete: () => {
        this.video.pause()
        this.video.removeAttribute('src')
        this.el.style.display = 'none'
        this.onEnter?.()
      },
    })
    tl.to(this.el.querySelector('.loader-progress'), { opacity: 0, duration: 0.4 }, 0)
    tl.to(this.skipBtn, { opacity: 0, duration: 0.3 }, 0)
    if (!this.fallback) {
      tl.to(this.video, { scale: 1.14, opacity: 0, duration: 1.0, ease: 'power2.inOut' }, 0.1)
    } else {
      tl.to(this.fallbackEl, { scale: 1.08, opacity: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1)
    }
    tl.to(this.el, { opacity: 0, duration: 0.55, ease: 'power2.inOut' }, '-=0.45')
  }
}
