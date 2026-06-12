import * as THREE from 'three'
import gsap from 'gsap'
import { LookControls } from './controls'
import { CARD_ASPECT, type CardArt } from './textures'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export type CardMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

export interface CardHit {
  mesh: CardMesh
  art: CardArt
}

const RADIUS = 15.2
const CARD_WIDTH = 6.05
const ROWS = [
  { lat: -0.68, n: 11 },
  { lat: -0.34, n: 13 },
  { lat: 0.0, n: 14 },
  { lat: 0.34, n: 13 },
  { lat: 0.68, n: 11 },
]
const FOCUS_DOLLY = 2.6
const BASE_FOV = 66

export class SphereGallery {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: LookControls
  cards: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = []

  onCardClick?: (hit: CardHit) => void
  onHover?: (art: CardArt | null, x: number, y: number) => void

  started = false
  focused = false

  private container: HTMLElement
  private raycaster = new THREE.Raycaster()
  private pointerNDC = new THREE.Vector2(2, 2)
  private pointerPx = { x: 0, y: 0 }
  private pointerDirty = false
  private hovered: THREE.Mesh | null = null
  private idleTime = 0
  private particles!: THREE.Points
  private particleMat!: THREE.PointsMaterial
  private lookDir = new THREE.Vector3()
  private lookTarget = new THREE.Vector3()
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0x050506, 1)
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 200)
    this.camera.position.set(0, 0, 0)

    this.controls = new LookControls(container)
    this.controls.onInteract = () => {
      this.idleTime = 0
    }

    this.buildBackdrop()
    this.buildParticles()

    container.addEventListener('pointermove', this.onPointerMove)
    container.addEventListener('pointerup', this.onPointerUp)
    container.addEventListener('pointerleave', () => this.clearHover())
    window.addEventListener('resize', this.resize)
    this.resize()

    gsap.ticker.add(this.tick)
  }

  /** Soft top-lit room: a giant inverted sphere with a vertical gradient. */
  private buildBackdrop(): void {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 512
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#1b1b21')
    g.addColorStop(0.42, '#0c0c0f')
    g.addColorStop(0.78, '#050507')
    g.addColorStop(1, '#020203')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 512)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(52, 48, 32), mat)
    this.scene.add(mesh)
  }

  private buildParticles(): void {
    const N = 260
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = Math.cbrt(Math.pow(7, 3) + (Math.pow(30, 3) - Math.pow(7, 3)) * Math.random())
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pos[i * 3] = r * s * Math.cos(phi)
      pos[i * 3 + 1] = r * u
      pos[i * 3 + 2] = r * s * Math.sin(phi)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.particleMat = new THREE.PointsMaterial({
      size: 0.07,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.particles = new THREE.Points(geo, this.particleMat)
    this.scene.add(this.particles)
  }

  populate(arts: CardArt[]): void {
    if (!arts.length) return
    const geo = new THREE.PlaneGeometry(CARD_WIDTH, CARD_WIDTH / CARD_ASPECT)
    let i = 0
    ROWS.forEach((row, rowIndex) => {
      const slot = (Math.PI * 2) / row.n
      const phase = (rowIndex % 2) * slot * 0.5 + rowIndex * 0.11
      for (let k = 0; k < row.n; k++) {
        const theta = k * slot + phase
        const art = arts[(i + rowIndex * 5) % arts.length]
        const mat = new THREE.MeshBasicMaterial({
          map: art.texture,
          transparent: true,
          opacity: 0,
          toneMapped: false,
          side: THREE.FrontSide,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(
          RADIUS * Math.cos(row.lat) * Math.sin(theta),
          RADIUS * Math.sin(row.lat),
          -RADIUS * Math.cos(row.lat) * Math.cos(theta),
        )
        mesh.lookAt(0, 0, 0)
        mesh.userData.art = art
        mesh.userData.theta = theta
        this.scene.add(mesh)
        this.cards.push(mesh)
        i++
      }
    })
  }

  /** Reveal: camera sweeps to center while cards bloom in around it. */
  intro(onDone?: () => void): void {
    const startYaw = this.reducedMotion ? 0 : 0.85
    const startPitch = this.reducedMotion ? 0.02 : 0.2
    this.controls.setOutAngles(startYaw, startPitch)

    const proxy = { yaw: startYaw, pitch: startPitch, fov: this.reducedMotion ? BASE_FOV : 78 }
    const dur = this.reducedMotion ? 0.8 : 2.4
    this.camera.fov = proxy.fov
    this.camera.updateProjectionMatrix()

    const tl = gsap.timeline({
      onComplete: () => {
        this.controls.enabled = true
        this.started = true
        onDone?.()
      },
    })
    tl.to(
      proxy,
      {
        yaw: 0,
        pitch: 0.02,
        fov: BASE_FOV,
        duration: dur,
        ease: 'power3.inOut',
        onUpdate: () => {
          this.controls.setOutAngles(proxy.yaw, proxy.pitch)
          this.camera.fov = proxy.fov
          this.camera.updateProjectionMatrix()
        },
      },
      0,
    )

    const front = new THREE.Vector3(0, 0, -1)
    const dir = new THREE.Vector3()
    this.cards.forEach((mesh) => {
      dir.copy(mesh.position).normalize()
      const ang = front.angleTo(dir)
      const delay = this.reducedMotion ? 0 : 0.25 + ang * 0.32 + Math.random() * 0.12
      tl.to(mesh.material, { opacity: 1, duration: 0.9, ease: 'power2.out' }, delay)
      if (!this.reducedMotion) {
        mesh.scale.setScalar(0.82)
        tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 1.15, ease: 'back.out(1.3)' }, delay)
      }
    })
    tl.to(this.particleMat, { opacity: 0.32, duration: 1.6, ease: 'power2.out' }, 0.6)
  }

  /** Screen-space bounding rect of a card (px). */
  screenRect(mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>): Rect {
    this.camera.updateMatrixWorld()
    mesh.updateMatrixWorld()
    const { width: gw, height: gh } = mesh.geometry.parameters
    const corners = [
      [-gw / 2, -gh / 2],
      [gw / 2, -gh / 2],
      [gw / 2, gh / 2],
      [-gw / 2, gh / 2],
    ]
    const vw = window.innerWidth
    const vh = window.innerHeight
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const v = new THREE.Vector3()
    for (const [cx, cy] of corners) {
      v.set(cx, cy, 0).applyMatrix4(mesh.matrixWorld).project(this.camera)
      const x = (v.x * 0.5 + 0.5) * vw
      const y = (-v.y * 0.5 + 0.5) * vh
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY }
  }

  /** Aim at the card, dolly toward it, dim everything else. */
  focusCard(mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>): void {
    this.focused = true
    this.controls.enabled = false
    this.clearHover()

    const p = mesh.position
    const fYaw = Math.atan2(p.x, -p.z)
    const fPitch = Math.asin(p.y / p.length())
    const curYaw = this.controls.outYaw
    const curPitch = this.controls.outPitch
    const dy = Math.atan2(Math.sin(fYaw - curYaw), Math.cos(fYaw - curYaw))

    const proxy = { yaw: curYaw, pitch: curPitch }
    gsap.to(proxy, {
      yaw: curYaw + dy,
      pitch: fPitch,
      duration: 0.9,
      ease: 'power3.inOut',
      onUpdate: () => this.controls.setOutAngles(proxy.yaw, proxy.pitch),
    })

    const dir = p.clone().normalize()
    gsap.to(this.camera.position, {
      x: dir.x * FOCUS_DOLLY,
      y: dir.y * FOCUS_DOLLY,
      z: dir.z * FOCUS_DOLLY,
      duration: 0.95,
      ease: 'power3.inOut',
    })

    for (const card of this.cards) {
      if (card === mesh) continue
      gsap.to(card.material, { opacity: 0.07, duration: 0.6, ease: 'power2.out' })
    }
    gsap.to(this.particleMat, { opacity: 0.06, duration: 0.6 })
  }

  unfocus(): void {
    gsap.to(this.camera.position, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.85,
      ease: 'power3.inOut',
      onComplete: () => {
        this.controls.enabled = true
        this.focused = false
        this.idleTime = 0
      },
    })
    for (const card of this.cards) {
      gsap.to(card.material, { opacity: 1, duration: 0.75, ease: 'power2.out', delay: 0.1 })
    }
    gsap.to(this.particleMat, { opacity: 0.32, duration: 0.8, delay: 0.1 })
  }

  resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.controls.sensitivity = THREE.MathUtils.degToRad(this.camera.fov) / h
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.pointerPx = { x: e.clientX, y: e.clientY }
    this.pointerNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    this.pointerDirty = e.pointerType === 'mouse'
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.started || this.focused) return
    if (this.controls.dragDistance > 8) return
    this.pointerNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    const hit = this.raycast()
    if (hit) {
      const art = hit.userData.art as CardArt
      this.onCardClick?.({ mesh: hit, art })
    }
  }

  private raycast(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera)
    const hits = this.raycaster.intersectObjects(this.cards, false)
    return hits.length ? (hits[0].object as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>) : null
  }

  private setHover(mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null): void {
    if (mesh === this.hovered) {
      if (this.hovered) {
        const art = this.hovered.userData.art as CardArt
        this.onHover?.(art, this.pointerPx.x, this.pointerPx.y)
      }
      return
    }
    if (this.hovered) {
      gsap.to(this.hovered.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power3.out' })
    }
    this.hovered = mesh
    this.container.classList.toggle('can-hover', !!mesh)
    if (mesh) {
      gsap.to(mesh.scale, { x: 1.055, y: 1.055, z: 1.055, duration: 0.5, ease: 'power3.out' })
      const art = mesh.userData.art as CardArt
      this.onHover?.(art, this.pointerPx.x, this.pointerPx.y)
    } else {
      this.onHover?.(null, this.pointerPx.x, this.pointerPx.y)
    }
  }

  private clearHover(): void {
    this.setHover(null)
    this.pointerDirty = false
  }

  private tick = (_t: number, deltaMs: number): void => {
    const dt = Math.min(deltaMs / 1000, 0.066)
    this.controls.update(dt)

    // gentle idle drift after a few seconds without input
    if (this.started && !this.focused && !this.reducedMotion && !this.controls.isDragging) {
      this.idleTime += dt
      if (this.idleTime > 5) this.controls.nudgeSilent(dt * 0.016)
    }

    const yaw = this.controls.outYaw
    const pitch = this.controls.outPitch
    this.lookDir.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    )
    this.lookTarget.copy(this.camera.position).add(this.lookDir)
    this.camera.lookAt(this.lookTarget)

    this.particles.rotation.y += dt * 0.006
    this.particles.rotation.x += dt * 0.0022

    if (this.started && !this.focused && this.pointerDirty && !this.controls.isDragging) {
      this.pointerDirty = false
      this.setHover(this.raycast())
    } else if (this.controls.isDragging && this.hovered) {
      this.clearHover()
    }

    this.renderer.render(this.scene, this.camera)
  }
}
