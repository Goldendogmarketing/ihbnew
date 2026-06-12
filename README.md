# ihb Spatial Gallery

An immersive 3D portfolio for **iHelpBuild**, inspired by phantom.land. You stand
inside a sphere of project cards — drag to look around, click a card to open its
case page. Built with **Three.js + GSAP + Vite (TypeScript)**.

## Run

```bash
npm install
npm run dev      # http://localhost:5181
npm run build    # production bundle -> dist/
```

## Controls

- **Desktop** — click & drag to look (eased, with momentum fling), scroll wheel
  rotates, arrow keys nudge, hover shows a project tooltip, click opens detail.
- **Mobile** — swipe to look, tap to open. "Enable motion" toggles
  device-orientation look-around (iOS asks permission; requires HTTPS).
- **Detail page** — Esc, browser back, or the Back button returns to the sphere.

## Content

- `src/data.ts` — the 7 projects: titles, tags, years, blurbs, URLs. Edit freely.
- `public/sites/*.jpg` — full-page screenshots; each is auto-sliced into up to 4
  card crops (top-biased). Drop in a new screenshot + a `data.ts` entry to add a
  project.
- `public/brand/loading.mp4` — the Higgsfield-generated loading film (dark room,
  laptop opens, red loading bar, ihb logo). If the file is missing the loader
  falls back to a pulsing ihb mark with a real progress bar.

## Structure

| File | Role |
| --- | --- |
| `src/gallery.ts` | Sphere scene: card rings, backdrop, particles, hover/click raycast, focus dolly |
| `src/controls.ts` | Lenis-style eased look controls: drag, momentum, wheel, gyro |
| `src/textures.ts` | Slices screenshots and composes phantom-style card canvases (caption, chips, year) |
| `src/detail.ts` | FLIP transition into the case page and back |
| `src/loader.ts` | Cinematic loading screen (video + fallback + real progress) |
| `src/main.ts` | Boot + UI wiring (tooltip, hint, gyro button, keyboard) |

Dev utilities: `capture-lake.mjs` (site screenshot capture), `snap.mjs`
(headless flow test — saves screenshots to `shots/`).
