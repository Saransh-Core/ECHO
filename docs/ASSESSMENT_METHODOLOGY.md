# Assessment methodology

## Framework
The interest profile is inspired by John Holland’s RIASEC vocational-interest framework: Realistic, Investigative, Artistic, Social, Enterprising, and Conventional. The framework organizes vocational interests; it is not a diagnosis, complete personality measure, aptitude measure, or standalone career decision.

## Question bank and use
`src/features/assessment/riasec.ts` contains 24 original activity statements, four mapped to each dimension. Each new attempt selects 18 questions (three per dimension) using a deterministic rotation. Selected IDs are saved on an attempt and must be reused on refresh/resume. Statements are not copied from the O*NET Interest Profiler or another proprietary instrument. Answer on a five-point enjoyment scale from Strongly dislike (1) to Strongly like (5). “Unsure” is the neutral midpoint. No answer is inherently better.

## Scoring
For each dimension, average only answered items and linearly normalize the mean from 1–5 to 0–100: `(mean - 1) / 4 × 100`, rounded to an integer. An unanswered dimension is `null`; missing items are never scored as dislikes. An attempt is complete only when every selected question has an answer. Results may be viewed earlier but are labeled provisional. Leading dimensions are the top score plus any dimensions within 8 normalized points, capped at three, to communicate close/overlapping interests without forcing a unique type. This descriptive range is not a probability or a validated norm.

## Career exploration mapping
For this demo, the original dimension-to-career associations are explicit in `src/features/assessment/riasec.ts`. Career Intelligence separately evaluates catalog RIASEC dimensions, profile interest terms, and portfolio-linked or independently assessed skill evidence. Self-reported skill records do not count as demonstrated skill evidence. Available factor weights are 65%, 15%, and 20%, respectively, with unavailable factors omitted and remaining weights renormalized. These are prompts for exploration, not suitability ratings. Study stage and user preferences are not currently included in the score.

## Research and limitations
The named framework is based on Holland’s RIASEC model and is widely used in vocational-interest research. This questionnaire has no validation study, reliability estimate, norm group, or official instrument license; do not describe it as scientifically validated. For more formal use, select an appropriately licensed official instrument and follow its administration, scoring, and interpretation requirements. The demo does not integrate O*NET questions or data.
