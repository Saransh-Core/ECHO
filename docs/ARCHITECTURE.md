# Architecture

## Current application
- Vite + React + TypeScript single-page app, with React Router routes in `src/App.tsx`.
- Typed product state is shared by routed screens and persisted to `localStorage` under `aayam-demo` when no Supabase client is configured.
- `src/features/assessment/riasec.ts` owns the activity question bank, response scale, dimension descriptions, balanced attempt selection, and deterministic scoring. `src/services/aayamRepository.ts` handles profile, assessment, saved-career, legacy-roadmap, and portfolio persistence.
- `src/services/careerRepository.ts` loads published career and skill catalogs. `src/features/careers/matching.ts` provides deterministic explainable matching with missing factors omitted and available weights renormalized. `src/features/roadmaps/generator.ts` provides catalog-informed roadmap templates.
- `src/services/roadmapRepository.ts` and `src/services/skillEvidenceRepository.ts` handle user-scoped roadmap and skill-evidence operations. No LLM provider is configured or called.

## Data and security boundaries
The current `State` type and local demo adapter remain in `src/App.tsx`. The product keeps the legacy editable roadmap and adds separate goal-based generated roadmaps. Generated roadmaps are deterministic planning suggestions, not AI output or official qualification paths. Demo data is stored locally and is not account-synced.

Private cloud records are protected by Supabase RLS. The new RPC functions use `security invoker` and `auth.uid()`; they do not elevate privileges or bypass table policies. Only the public/publishable key is intended for Vite browser configuration. No service-role key is used.

## Supabase setup status
1. The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `.env.local` is ignored by Git.
2. The original schema is `supabase/migrations/202610290001_initial_schema.sql`. The additive career-intelligence upgrade is `supabase/migrations/202610290002_career_intelligence.sql`.
3. The new migration has not been applied or tested against the live project. It adds assessment attempt snapshots, multiple goal-based roadmap fields, atomic roadmap creation/progress RPCs, and idempotent skill-evidence writes. Apply it only after reviewing it in the intended Supabase project; do not rerun the initial migration.
4. No authenticated live database operations were performed for this implementation. The local build and deterministic unit tests do not verify Supabase behavior.
