# Database schema

## Migrations

- `supabase/migrations/202610290001_initial_schema.sql` defines the existing normalized schema, catalog seeds, constraints, indexes, and RLS policies.
- `supabase/migrations/202610290002_career_intelligence.sql` is a new additive migration. It extends assessment sessions with immutable question-set snapshots and attempt position; expands roadmaps to multiple owner-scoped goals; adds roadmap task metadata; and defines atomic roadmap and skill-evidence RPCs.
- The new migration has not been applied to Supabase. Do not rerun the initial migration.

## Tables and relationships

- `profiles.id` references `auth.users.id` and stores profile context.
- `assessment_sessions` belongs to a user and stores instrument/version status plus the new attempt question IDs, progress, and attempt number. `assessment_responses` has one 1–5 response per question in a session. `assessment_results` stores the score snapshot for that session.
- `careers`, `skill_definitions`, and `career_skill_requirements` are global catalogs. `saved_careers` links user accounts to career records.
- `roadmaps` belongs to a user and optionally to a career. The upgrade removes the former one-roadmap-per-career uniqueness and adds goal, pace, target date, format, status, and idempotency-key fields. `roadmap_nodes`, `roadmap_edges`, and `roadmap_progress` hold task dependencies and progress.
- `portfolio_entries` belongs to a user and can reference a catalog skill through `related_skill_ids`, a career, and a roadmap node. Lowercase entry types are `project`, `certificate`, `assessment`, `skill`, `competition`, and `mentor_feedback`.
- `user_skill_evidence` references a catalog skill and optionally a portfolio entry, with provenance types `self_reported`, `portfolio_supported`, and `independently_assessed`.

## Access control

RLS is enabled by the initial migration on private tables. Policies constrain rows to `auth.uid()` directly or through the owning roadmap. Catalogs are read-only to anon/authenticated roles (published-career filter applies). The new RPCs are `security invoker`, derive ownership from `auth.uid()`, and use existing RLS; they do not bypass policies. Live RLS behavior has not been integration-tested for this implementation.

## Application operations

`aayamRepository.ts` handles profile, assessment, saved-career, portfolio, and legacy roadmap synchronization. `roadmapRepository.ts` handles multiple goal-based roadmaps and atomic task progress. `skillEvidenceRepository.ts` reads/deletes owner-scoped evidence and records it through the migration RPC. Multi-record portfolio synchronization is still a sequence of operations rather than a single transaction; an error can leave partial progress and should be retried after inspecting the displayed error.

No authenticated database reads/writes, cross-account isolation tests, or live migration execution were performed. See `docs/IMPLEMENTATION_STATUS.md` for the current implementation boundaries.
