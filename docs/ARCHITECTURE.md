# Architecture

The current demo keeps typed domain records and feature UI in `src/App.tsx` for a small, dependency-light initial implementation. `useStore` is the UI state boundary and persists the demo state locally. The natural next split is `types/`, `data/`, `services/`, and `features/`; career selection, recommendation context, and milestone toggling already have deterministic behavior suitable for extraction.

For a backend phase, replace the local persistence adapter with authenticated service functions for profiles, assessment answers/results, selected careers, milestones, and portfolio evidence. Keep recommendation and roadmap generation behind a server-side service if an LLM is introduced. No client secret or fake API endpoint is present.
