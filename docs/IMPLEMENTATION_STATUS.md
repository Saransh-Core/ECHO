# Implementation status

## Implemented

- Existing React/Vite app and Supabase authentication flow retained. Local demo persistence remains available when Supabase configuration is absent.
- Career Intelligence is a separate route with deterministic weighted matching, filter/sort, explanations, data coverage, linked skills, gaps, save, comparison, and roadmap actions.
- Career Explorer has search, category, RIASEC-theme, skill filters, details, and 2–4 career comparison. Unavailable cost and qualification data is called out.
- Roadmap Generator supports multiple goal roadmaps, catalog-informed task sequences, goal/task editing, completion, pause/resume, archive, delete, and local demo storage. Portfolio entries can link to canonical catalog skills and roadmap tasks.
- Assessment attempts save their selected question IDs, index, answers, and results; the question set remains stable on refresh and prior attempts are listed.
- Skill evidence distinguishes self-reported, portfolio-supported, and independently assessed provenance in the data model and repository. Portfolio-linked skill IDs are checked against the catalog before creating evidence.
- Dashboard removes the former fake workspace progress and shows empty states and actual loaded records.
- Additive migration `202610290002_career_intelligence.sql` supports these schema additions without changing the original migration.

## Known limitations and incomplete work

- Work-values/preferences, readiness, and constraint assessment modules are not implemented. Matching currently uses RIASEC, textual profile interests, and catalog-linked evidence. Education compatibility is not scored.
- The current career catalog is small and its starter descriptions and mappings are illustrative. Reliable qualifications, education filters, learning-resource sources, costs, and advantages/disadvantages are not sufficiently structured; the UI identifies unavailable data.
- Roadmap generation is deterministic and catalog-informed when skill requirements exist, with a clearly labeled basic template otherwise. It does not yet implement accept/reject adaptation proposals for changing goals, prerequisites already demonstrated, or overdue tasks.
- New roadmap task progress is stored atomically with its progress row. The older legacy roadmap snapshot and portfolio-to-skill evidence synchronization still involve multiple requests and can partially complete if the network fails.
- The additive migration has not been applied, and authenticated Supabase reads/writes, refresh persistence, and account isolation have not been tested against the live project.

## Verification

- `npm run build`: passes. Vite reports the generated JavaScript chunk is above 500 kB.
- `npm test`: 6 deterministic unit tests pass (RIASEC scoring, missing matching factors, normalized matching, ranking, assessment question selection, and roadmap prerequisites).
- Browser inspection confirmed the configured app routes signed-out users to Supabase sign-in. Authenticated workflows were not tested because no disposable account was created. Browser workflows remain available in local demo mode when Supabase env configuration is removed or omitted.

See `docs/DATABASE_SCHEMA.md` for migration and security details. No live AI provider is integrated.
