export type ReflectionRequest = {
  stage: string;
  leadingInterests: string[];
  careerName?: string;
  skillsToExplore?: string[];
};
export type Reflection = { summary: string; nextSteps: string[]; source: 'rule-based-demo' | 'configured-provider' };

/** Provider-independent boundary for a future protected server-side model call. */
export interface CareerIntelligenceProvider {
  explainCareer(request: ReflectionRequest): Promise<Reflection>;
}

/** Safe deterministic fallback. It makes no claims of live AI or model inference. */
export class RuleBasedIntelligence implements CareerIntelligenceProvider {
  async explainCareer(request: ReflectionRequest): Promise<Reflection> {
    const interests = request.leadingInterests.length ? request.leadingInterests.join(', ') : 'your emerging interests';
    const career = request.careerName ? ` and ${request.careerName}` : '';
    return {
      summary: `Your ${request.stage.toLowerCase()} exploration points to ${interests}${career}. Treat this as a prompt for further exploration.`,
      nextSteps: [
        'Choose one related activity and notice whether you enjoy the process.',
        `Explore one skill in this area: ${request.skillsToExplore?.[0] || 'a beginner skill'}.`,
        'Compare at least one alternative before settling on a direction.',
      ],
      source: 'rule-based-demo',
    };
  }
}

export const intelligenceProvider: CareerIntelligenceProvider = new RuleBasedIntelligence();
