# Aayam

A frontend-only career exploration demo for students and early-career learners. It uses deterministic sample career information and browser-local state; it does not provide authentication, AI recommendations, verified labor-market information, or secure data storage.

## Run locally

Requirements: Node.js 20 or later and npm.

```sh
npm install
npm run dev
```

Create a production build with `npm run build` and preview it with `npm run preview`.

## Demo journey

Start at `/`, complete the adaptive profile, reflect through the informal assessment, explore careers, set a direction, inspect skill suggestions and roadmap steps, and add evidence in the portfolio. State persists in `localStorage` under `aayam-demo`. Use **Reset demo data** in the workspace navigation to clear it.

## Project map

- `src/App.tsx` — routes, shared UI, demo state, services-in-component boundary, and feature screens.
- `src/styles.css` — responsive visual system and page styles.
- `docs/` — product, design, architecture, data, and implementation notes.

Career matching is intentionally presented as exploration context, not a scored or validated recommendation. Portfolio entries are self-declared and stored only in the current browser.
