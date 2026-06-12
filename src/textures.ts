import * as THREE from 'three'
import { asset, type Project } from './data'

export interface CardArt {
  project: Project
  cropIndex: number
  indexLabel: string
  texture: THREE.CanvasTexture
}

/** Logical card layout (multiplied by SCALE for the actual canvas). */
const CARD_W = 416
const IMG_H = 260
const CAP_H = 26
const GAP = 9
const CARD_H = CAP_H + GAP + IMG_H + GAP + CAP_H // 330
const SCALE = 2

export const CARD_ASPECT = CARD_W / CARD_H

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  s: number,
): number {
  const padX = 7 * s
  const h = CAP_H * s * 0.86
  ctx.font = `560 ${8.5 * s}px "Inter Variable", "Inter", system-ui, sans-serif`
  setLetterSpacing(ctx, 1.6 * s)
  const w = ctx.measureText(text).width + padX * 2
  ctx.strokeStyle = 'rgba(255,255,255,0.26)'
  ctx.lineWidth = 1 * s
  roundRectPath(ctx, x, y, w, h, 5 * s)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, x + padX, y + h / 2 + 0.5 * s)
  setLetterSpacing(ctx, 0)
  return w
}

/**
 * Compose a phantom.land-style card: caption row, rounded screenshot slice,
 * tag chips + year. Transparent background — the plane itself is invisible.
 */
function composeCard(
  img: HTMLImageElement,
  srcY: number,
  cropH: number,
  project: Project,
  indexLabel: string,
): HTMLCanvasElement {
  const s = SCALE
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W * s
  canvas.height = CARD_H * s
  const ctx = canvas.getContext('2d')!

  const sans = '"Inter Variable", "Inter", system-ui, sans-serif'

  // --- top caption: title left, index right
  ctx.textBaseline = 'middle'
  const topMid = (CAP_H / 2) * s
  ctx.font = `640 ${10.5 * s}px ${sans}`
  setLetterSpacing(ctx, 2.2 * s)
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.textAlign = 'left'
  let title = project.title.toUpperCase()
  const maxTitleW = CARD_W * s * 0.7
  while (ctx.measureText(title).width > maxTitleW && title.length > 4) {
    title = `${title.slice(0, -2).trimEnd()}…`
  }
  ctx.fillText(title, 2 * s, topMid)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `560 ${9.5 * s}px ${sans}`
  ctx.fillText(`— ${indexLabel}`, (CARD_W - 2) * s, topMid)
  setLetterSpacing(ctx, 0)

  // --- screenshot slice, rounded + hairline border
  const imgY = (CAP_H + GAP) * s
  roundRectPath(ctx, 0, imgY, CARD_W * s, IMG_H * s, 10 * s)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#0d0d10'
  ctx.fillRect(0, imgY, CARD_W * s, IMG_H * s)
  ctx.drawImage(img, 0, srcY, img.width, cropH, 0, imgY, CARD_W * s, IMG_H * s)
  ctx.restore()
  roundRectPath(ctx, 0.5 * s, imgY + 0.5 * s, CARD_W * s - s, IMG_H * s - s, 10 * s)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1 * s
  ctx.stroke()

  // --- bottom caption: tag chips left, year right
  const botY = (CAP_H + GAP + IMG_H + GAP) * s
  let cx = 2 * s
  for (const tag of project.tags.slice(0, 3)) {
    const w = drawChip(ctx, cx, botY, tag.toUpperCase(), s)
    cx += w + 6 * s
    if (cx > CARD_W * s * 0.72) break
  }
  ctx.font = `560 ${9.5 * s}px ${sans}`
  setLetterSpacing(ctx, 1.4 * s)
  ctx.fillStyle = 'rgba(255,255,255,0.46)'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(project.year, (CARD_W - 2) * s, botY + (CAP_H * 0.86 * s) / 2)
  setLetterSpacing(ctx, 0)

  return canvas
}

/**
 * Score a candidate slice: prefer detailed, mid-brightness sections and
 * penalize near-black or blank-white stretches (footers, photo voids).
 */
function cropScore(img: HTMLImageElement, srcY: number, cropH: number): number {
  const c = document.createElement('canvas')
  c.width = 48
  c.height = 30
  const cx = c.getContext('2d', { willReadFrequently: true })!
  cx.drawImage(img, 0, srcY, img.width, cropH, 0, 0, 48, 30)
  const d = cx.getImageData(0, 0, 48, 30).data
  const n = d.length / 4
  let sum = 0
  let sum2 = 0
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    sum += l
    sum2 += l * l
  }
  const mean = sum / n
  const variance = Math.max(0, sum2 / n - mean * mean)
  let score = Math.sqrt(variance)
  if (mean < 0.07) score *= 0.12
  else if (mean < 0.16) score *= 0.55
  if (mean > 0.96) score *= 0.4
  return score
}

/** Pick crop offsets: always the hero (top), then the best-scoring sections. */
function pickOffsets(img: HTMLImageElement, cropH: number): number[] {
  const maxN = Math.max(1, Math.min(4, Math.floor(img.height / cropH)))
  if (maxN === 1) return [0]
  const span = img.height - cropH
  const candidates = [0.12, 0.24, 0.36, 0.48, 0.6, 0.72].map((f) => f * span)
  const scored = candidates
    .map((y) => ({ y, s: cropScore(img, y, cropH) }))
    .sort((a, b) => b.s - a.s)
  const picked: number[] = []
  for (const cand of scored) {
    if (picked.length >= maxN - 1) break
    const farFromOthers = picked.every((p) => Math.abs(p - cand.y) > cropH * 0.55)
    if (farFromOthers && cand.y > cropH * 0.55) picked.push(cand.y)
  }
  return [0, ...picked.sort((a, b) => a - b)]
}

/**
 * Load every project screenshot and slice it into 1-4 card crops.
 * Returns the arts interleaved by project so sequential assignment
 * never puts the same project on adjacent cards.
 */
export async function loadCardArts(
  projects: Project[],
  renderer: THREE.WebGLRenderer,
  onProgress: (p: number) => void,
): Promise<CardArt[]> {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const perProject: CardArt[][] = []
  let loaded = 0

  await Promise.all(
    projects.map(async (project, pi) => {
      const indexLabel = String(pi + 1).padStart(2, '0')
      const arts: CardArt[] = []
      try {
        const img = await loadImage(asset(project.image))
        const cropH = img.width / 1.6
        const offsets = pickOffsets(img, cropH)
        for (let i = 0; i < offsets.length; i++) {
          const canvas = composeCard(img, offsets[i], cropH, project, indexLabel)
          const texture = new THREE.CanvasTexture(canvas)
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = aniso
          arts.push({ project, cropIndex: i, indexLabel, texture })
        }
      } catch (err) {
        console.warn(`[gallery] missing screenshot for ${project.id}`, err)
      }
      perProject[pi] = arts
      loaded += 1
      onProgress(loaded / projects.length)
    }),
  )

  // Interleave: p0c0, p1c0 ... p6c0, p0c1, p1c1 ...
  const interleaved: CardArt[] = []
  const maxCrops = Math.max(0, ...perProject.map((a) => a.length))
  for (let c = 0; c < maxCrops; c++) {
    for (const arts of perProject) {
      if (arts[c]) interleaved.push(arts[c])
    }
  }
  return interleaved
}
