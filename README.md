# Alarm Generator

React + Vite app for building sequence-based timers/alarms with loops, waits, and sounds. Supports multiple color themes and a fully customizable in-app alarm editor. 

## Quick start

```bash
npm install
npm run dev      # start dev server
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

## Sound assets

- Default sound path: `/sounds/alarm.wav`. Place your alarm file at `public/sounds/alarm.wav` (and add any others under `public/sounds/`).
- Play Sound blocks can also use custom URLs or uploaded files.

## Project structure

- `src/` – React components, hooks, styles (`index.css`), and types
- `public/` – static assets served as-is (place sounds/icons here)
- `index.html` – Vite entry HTML
- Config: `vite.config.ts`, `tailwind.config.cjs`, `postcss.config.cjs`, `tsconfig*.json`

## Scripts

- `npm run dev` – dev server (with HMR)
- `npm run build` – production build
- `npm run preview` – preview built assets
- `npm run lint` – run ESLint (TS/React)

## Deployment

Any static host works. For GitHub Pages, set `base` in `vite.config.ts` if deploying to a subpath, then build and publish `dist/`.
