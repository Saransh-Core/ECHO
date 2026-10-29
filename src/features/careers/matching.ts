import type { Dimension } from '../assessment/riasec.ts';

export type MatchingCareer = {
  id: string;
  name: string;
  riasecDimensions: string[];
  interests?: string[];
  skillRequirements: { id: string; name: string; notes: string; relevance: string }[];
};

export type MatchInputs = {
  riasecScores?: Partial<Record<Dimension, number | null>>;
  profileInterests?: string[];
  evidencedSkillIds?: string[];
  skillEvidenceLoaded?: boolean;
};

export type CareerMatch = {
  careerId: string;
  score: number | null;
  factors: { interest: number | null; statedInterests: number | null; evidencedSkills: number | null };
  missingDimensions: string[];
  relevantEvidence: { id: string; name: string }[];
  notYetEvidenced: { id: string; name: string }[];
  reasons: string[];
  dataCoverage: number;
};

/**
 * Transparent deterministic weights. Only factors with actual user and catalog data
 * participate; available weights are renormalized. A blank profile/evidence set is
 * never scored as a negative.
 */
export const CAREER_MATCH_WEIGHTS = {
  riasecInterest: 0.65,
  statedProfileInterests: 0.15,
  portfolioSkillEvidence: 0.2,
} as const;

export function matchCareer(career: MatchingCareer, inputs: MatchInputs): CareerMatch {
  const scores = inputs.riasecScores || {};
  const availableRiasec = career.riasecDimensions
    .map(key => scores[key as Dimension])
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  const interest = availableRiasec.length
    ? Math.round(availableRiasec.reduce((sum, score) => sum + score, 0) / availableRiasec.length)
    : null;

  const profile = (inputs.profileInterests || []).map(value => value.trim().toLocaleLowerCase()).filter(Boolean);
  const catalogInterests = (career.interests || []).map(value => value.toLocaleLowerCase());
  const statedInterests = profile.length
    ? Math.round(profile.filter(value => catalogInterests.some(interestValue => interestValue.includes(value) || value.includes(interestValue))).length / profile.length * 100)
    : null;

  const evidence = new Set(inputs.evidencedSkillIds || []);
  const requirements = career.skillRequirements;
  const relevantEvidence = requirements.filter(skill => evidence.has(skill.id));
  const notYetEvidenced = requirements.filter(skill => !evidence.has(skill.id));
  const evidencedSkills = inputs.skillEvidenceLoaded && evidence.size && requirements.length
    ? Math.round(relevantEvidence.length / requirements.length * 100)
    : null;

  const factors = { interest, statedInterests, evidencedSkills };
  const available: { value: number; weight: number }[] = [];
  if (interest !== null) available.push({ value: interest, weight: CAREER_MATCH_WEIGHTS.riasecInterest });
  if (statedInterests !== null) available.push({ value: statedInterests, weight: CAREER_MATCH_WEIGHTS.statedProfileInterests });
  if (evidencedSkills !== null) available.push({ value: evidencedSkills, weight: CAREER_MATCH_WEIGHTS.portfolioSkillEvidence });
  const weightTotal = available.reduce((sum, factor) => sum + factor.weight, 0);
  const score = weightTotal ? Math.round(available.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / weightTotal) : null;
  const reasons: string[] = [];
  if (interest !== null) reasons.push(`Interest alignment uses ${career.riasecDimensions.filter(key => scores[key as Dimension] !== null && scores[key as Dimension] !== undefined).join(', ')} assessment dimensions.`);
  if (relevantEvidence.length) reasons.push(`${relevantEvidence.length} relevant skill${relevantEvidence.length === 1 ? '' : 's'} have linked evidence.`);
  if (score === null) reasons.push('Add assessment answers or profile preferences to calculate a comparison score.');
  return {
    careerId: career.id,
    score,
    factors,
    missingDimensions: career.riasecDimensions.filter(key => scores[key as Dimension] === null || scores[key as Dimension] === undefined),
    relevantEvidence,
    notYetEvidenced,
    reasons,
    dataCoverage: Math.round(available.length / 3 * 100),
  };
}

export function rankCareers<T extends MatchingCareer>(careers: T[], inputs: MatchInputs): { career: T; match: CareerMatch }[] {
  return careers.map(career => ({ career, match: matchCareer(career, inputs) }))
    .sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
}
