# Aayam

A career exploration demo for students and early-career learners. It uses deterministic sample career information and browser-local state. It includes an original RIASEC-inspired interest reflection, rule-based career mapping, an optional Supabase client/schema setup, and a deterministic intelligence fallback. It supports Supabase email/password authentication and database sync when configured and after the included migration is applied. It does not provide AI inference or verified labor-market information.

## Run locally

Requirements: Node.js 20 or later and npm.

```sh
npm install
npm run dev
```

Create a production build with `npm run build` and preview it with `npm run preview`.

## Demo journey

Start at `/`, complete the adaptive profile, answer 24 original RIASEC activity statements, review the six-dimension interest profile, explore careers, set a direction, edit the roadmap, and add evidence in the portfolio. Without Supabase configuration, demo state persists in `localStorage` under `aayam-demo`. With Supabase configured, create an account at `/signin` and workspace data is stored in that account. Apply the included migration first.

## Project map

- `src/App.tsx` — routes, shared UI, local demo state, and feature screens.
- `src/styles.css` — responsive visual system and page styles.
- `src/features/assessment/riasec.ts` — original question bank and transparent scoring.
- `src/services/` — recommendation/intelligence boundaries and Supabase client, auth, and repository adapter.
- `supabase/migrations/` — schema, seed reference data, grants, and RLS policies.
- `docs/` — architecture, database, assessment, design, and implementation notes.

Career matching is exploratory, not a suitability score or prediction. Portfolio entries are self-declared and stored only in the current browser. Supabase setup requires configuration and migration application. The project has not yet confirmed table operations against the live schema. See `docs/IMPLEMENTATION_STATUS.md`.
