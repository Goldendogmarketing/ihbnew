import * as THREE from 'three'

const PITCH_LIMIT = 1.05
const SMOOTHING = 6.5 // higher = snappier follow of the eased target
const FRICTION = 2.7 // momentum decay rate
const MAX_FLING = 3.2 // rad/s

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const Q_HALF_X = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
const DEG2RAD = Math.PI / 180

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))
const wrapDelta = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Inside-the-sphere look controls with Lenis-style eased follow:
 * drag writes to target angles, the rendered angles exponentially
 * chase them, and releases carry momentum that decays smoothly.
 * Optional device-orientation (gyro) offsets stack on top.
 */
export class LookControls {
  enabled = false
  isDragging = false
  dragDistance = 0
  gyroActive = false
  /** radians per pixel — kept in sync with fov/viewport by the gallery */
  sensitivity = 0.0024
  onInteract?: () => void

  private yaw = 0
  private pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private velYaw = 0
  private velPitch = 0

  private px = 0
  private py = 0
  private samples: Array<{ t: number; dy: number; dp: number }> = []

  private gyroYaw = 0
  private gyroPitch = 0
  private gyroTargetYaw = 0
  private gyroTargetPitch = 0
  private gyroBase: { yaw: number; pitch: number } | null = null
  private tmpEuler = new THREE.Euler()
  private tmpQuat = new THREE.Quaternion()
  private tmpQuat2 = new THREE.Quaternion()

  private el: HTMLElement

  constructor(el: HTMLElement) {
    this.el = el
    el.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('blur', this.cancelDrag)
  }

  get outYaw(): number {
    return this.yaw + this.gyroYaw
  }

  get outPitch(): number {
    return clamp(this.pitch + this.gyroPitch, -PITCH_LIMIT * 1.1, PITCH_LIMIT * 1.1)
  }

  /** Set the rendered + target angles so `out*` equals exactly (y, p). */
  setOutAngles(y: number, p: number): void {
    this.yaw = y - this.gyroYaw
    this.pitch = p - this.gyroPitch
    this.targetYaw = this.yaw
    this.targetPitch = this.pitch
    this.velYaw = 0
    this.velPitch = 0
  }

  nudge(dYaw: number, dPitch: number): void {
    if (!this.enabled) return
    this.targetYaw += dYaw
    this.targetPitch = clamp(this.targetPitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.onInteract?.()
  }

  /** Idle auto-drift: moves the target without registering as interaction. */
  nudgeSilent(dYaw: number): void {
    if (!this.enabled) return
    this.targetYaw += dYaw
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.066)

    if (this.enabled && !this.isDragging) {
      // momentum fling
      this.targetYaw += this.velYaw * dt
      this.targetPitch = clamp(this.targetPitch + this.velPitch * dt, -PITCH_LIMIT, PITCH_LIMIT)
      const decay = Math.exp(-dt * FRICTION)
      this.velYaw *= decay
      this.velPitch *= decay
      if (Math.abs(this.velYaw) < 0.0004) this.velYaw = 0
      if (Math.abs(this.velPitch) < 0.0004) this.velPitch = 0
    }

    // eased follow (the "Lenis" feel)
    const k = 1 - Math.exp(-dt * SMOOTHING)
    this.yaw += (this.targetYaw - this.yaw) * k
    this.pitch += (this.targetPitch - this.pitch) * k

    if (this.gyroActive && this.enabled) {
      const gk = 1 - Math.exp(-dt * 8)
      this.gyroYaw += wrapDelta(this.gyroTargetYaw - this.gyroYaw) * gk
      this.gyroPitch += (this.gyroTargetPitch - this.gyroPitch) * gk
    }
  }

  async enableGyro(): Promise<boolean> {
    interface DOEStatic {
      requestPermission?: () => Promise<string>
    }
    const DOE = (window as Window & { DeviceOrientationEvent?: DOEStatic }).DeviceOrientationEvent
    if (!DOE) return false
    try {
      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission()
        if (res !== 'granted') return false
      }
    } catch {
      return false
    }
    this.gyroBase = null
    window.addEventListener('deviceorientation', this.onOrientation)
    this.gyroActive = true
    return true
  }

  disableGyro(): void {
    window.removeEventListener('deviceorientation', this.onOrientation)
    // fold the gyro offset into the drag angles so the view doesn't jump
    this.yaw += this.gyroYaw
    this.targetYaw += this.gyroYaw
    this.pitch = clamp(this.pitch + this.gyroPitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.targetPitch = clamp(this.targetPitch + this.gyroPitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.gyroYaw = this.gyroPitch = this.gyroTargetYaw = this.gyroTargetPitch = 0
    this.gyroBase = null
    this.gyroActive = false
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    window.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('blur', this.cancelDrag)
    window.removeEventListener('deviceorientation', this.onOrientation)
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || !e.isPrimary) return
    this.isDragging = true
    this.dragDistance = 0
    this.px = e.clientX
    this.py = e.clientY
    this.samples = []
    this.velYaw = 0
    this.velPitch = 0
    this.el.classList.add('dragging')
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* no-op */
    }
    this.onInteract?.()
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.isDragging || !e.isPrimary) return
    const dx = e.clientX - this.px
    const dy = e.clientY - this.py
    this.px = e.clientX
    this.py = e.clientY
    this.dragDistance += Math.abs(dx) + Math.abs(dy)

    const dYaw = -dx * this.sensitivity
    const dPitch = dy * this.sensitivity
    this.targetYaw += dYaw
    this.targetPitch = clamp(this.targetPitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT)

    const t = performance.now()
    this.samples.push({ t, dy: dYaw, dp: dPitch })
    while (this.samples.length && t - this.samples[0].t > 110) this.samples.shift()
  }

  private onUp = (e: PointerEvent): void => {
    if (!this.isDragging || !e.isPrimary) return
    this.isDragging = false
    this.el.classList.remove('dragging')

    const now = performance.now()
    const recent = this.samples.filter((s) => now - s.t <= 90)
    if (recent.length >= 2) {
      const span = (now - recent[0].t) / 1000
      if (span > 0.012) {
        let sy = 0
        let sp = 0
        for (const s of recent) {
          sy += s.dy
          sp += s.dp
        }
        this.velYaw = clamp(sy / span, -MAX_FLING, MAX_FLING)
        this.velPitch = clamp(sp / span, -MAX_FLING, MAX_FLING)
      }
    }
    this.samples = []
  }

  private cancelDrag = (): void => {
    this.isDragging = false
    this.el.classList.remove('dragging')
    this.samples = []
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled) return
    e.preventDefault()
    const norm = e.deltaMode === 1 ? 18 : 1
    const d = (e.deltaY + e.deltaX) * norm
    this.targetYaw += d * 0.00052
    this.onInteract?.()
  }

  private onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return
    const alpha = e.alpha * DEG2RAD
    const beta = e.beta * DEG2RAD
    const gamma = e.gamma * DEG2RAD
    const screenAngle =
      (typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0) * DEG2RAD

    this.tmpEuler.set(beta, alpha, -gamma, 'YXZ')
    this.tmpQuat.setFromEuler(this.tmpEuler)
    this.tmpQuat.multiply(Q_HALF_X) // look out the back of the device
    this.tmpQuat.multiply(this.tmpQuat2.setFromAxisAngle(Z_AXIS, -screenAngle))
    this.tmpEuler.setFromQuaternion(this.tmpQuat, 'YXZ')

    const rawYaw = -this.tmpEuler.y
    const rawPitch = this.tmpEuler.x
    if (!this.gyroBase) this.gyroBase = { yaw: rawYaw, pitch: rawPitch }
    this.gyroTargetYaw = wrapDelta(rawYaw - this.gyroBase.yaw)
    this.gyroTargetPitch = clamp(rawPitch - this.gyroBase.pitch, -1.2, 1.2)
  }
}
