# Future data model

Suggested entities: `profiles` (user id, stage, study context, interests, goal, learning availability), `assessment_responses` (profile id, prompt version, selected options), `career_selections` (profile id, career id, selected timestamp), `roadmap_milestones` (profile id, career id, milestone key, status, updated timestamp), and `portfolio_entries` (profile id, type, title, description, related skills, evidence reference, self-declared/reviewed status).

The current app has no database. Demo records are serialized in browser `localStorage`; this is convenience persistence and is not suitable for sensitive information or multi-device use.
