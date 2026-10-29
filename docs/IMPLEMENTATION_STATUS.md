# Implementation status

## Implemented

- Existing React/Vite app and Supabase authentication flow retained. Local demo persistence remains available when Supabase configuration is absent.
- Career Intelligence is a separate route with deterministic weighted matching, filter/sort, explanations, data coverage, linked skills, gaps, save, comparison, and roadmap actions.
- Career Explorer has search, category, RIASEC-theme, skill filters, details, and 2–4 career comparison. Unavailable cost and qualification data is called out.
- Roadmap Generator offers distinct Fast Track, Balanced, and Project-Based plans for comparison before saving. Their task order, scope, and project timing differ; task estimates are labeled as estimates and prerequisites remain ordered. Saved roadmaps recover the strategy from their persisted task keys without a schema change. Goal/task editing, completion, pause/resume, archive, delete, and local demo storage remain supported. Portfolio entries can link to canonical catalog skills and roadmap tasks.
- Assessment attempts save their selected question IDs, index, answers, and results; the question set remains stable on refresh and prior attempts are listed.
- Skill evidence distinguishes self-reported, portfolio-supported, and independently assessed provenance in the data model and repository. Portfolio-linked skill IDs are checked against the catalog before creating evidence.
- Dashboard removes the former fake workspace progress and shows empty states and actual loaded records.
- Landing hero now uses an original, procedural WebGL truss made from connected rods and spherical joints instead of a fictional student dashboard preview. It is drag-, pointer-, and arrow-key interactive, with reduced-motion handling, visibility-aware rendering, cleanup, and a labeled static fallback when WebGL is unavailable.
- Sign-in now uses a scoped two-column responsive layout, explicit label associations, consistent field geometry, accessible password visibility, validation, and the existing Supabase auth/email-confirmation behavior.
- A dedicated career path workspace connects published career-to-skill requirements and saved roadmap tasks/dependencies, with search, category filters, selection details, saved-roadmap switching, rotation/zoom controls, and an accessible list view. The map currently uses CSS 3D perspective transforms rather than a WebGL graph renderer; skill evidence is identified as unknown in this view.
- Additive migration `202610290002_career_intelligence.sql` supports these schema additions without changing the original migration.

## Known limitations and incomplete work

- Work-values/preferences, readiness, and constraint assessment modules are not implemented. Matching currently uses RIASEC, textual profile interests, and catalog-linked evidence. Education compatibility is not scored.
- The current career catalog is small and its starter descriptions and mappings are illustrative. Reliable qualifications, education filters, learning-resource sources, costs, and advantages/disadvantages are not sufficiently structured; the UI identifies unavailable data.
- Roadmap generation is deterministic and catalog-informed when skill requirements exist, with a clearly labeled basic template otherwise. It personalizes task effort notes to the user's weekly time and includes starting level/goal/learning format, but it does not use RIASEC scores, recorded skill evidence, or target dates to produce calendar schedules. It does not yet implement accept/reject adaptation proposals for changing goals, prerequisites already demonstrated, or overdue tasks.
- New roadmap task progress is stored atomically with its progress row. The older legacy roadmap snapshot and portfolio-to-skill evidence synchronization still involve multiple requests and can partially complete if the network fails.
- The additive migration has not been applied, and authenticated Supabase reads/writes, refresh persistence, and account isolation have not been tested against the live project.
- The sign-in form and landing hero were checked in a narrow local browser viewport. The canvas rendered the mechanical truss; a pointer drag was exercised. Sign-in at desktop widths, authentication with test credentials, keyboard rotation, reduced-motion behavior, and forced WebGL fallback have not been manually verified across browsers/devices.
- Authentication was not exercised with test credentials. Password visibility is available; password-reset is not implemented because the app has no recovery route for accepting a replacement password.

## Verification

- `npm run build`: passes. Vite reports the generated JavaScript chunk is above 500 kB.
- `npm test`: 9 deterministic unit tests pass (RIASEC scoring, missing matching factors, normalized matching, ranking, assessment question selection, roadmap prerequisites, strategy differences, and strategy restoration).
- Local browser inspection confirmed the landing route and accessible interactive canvas are present. Authenticated workflows were not tested because no disposable account was created. Browser workflows remain available in local demo mode when Supabase env configuration is removed or omitted.

See `docs/DATABASE_SCHEMA.md` for migration and security details. No live AI provider is integrated.
