import { careerMapping, dimensions, type Dimension } from '../features/assessment/riasec';

export type CareerReference = { id: string; name: string; interests: string[] };
export type CareerSuggestion = { careerId: string; reasons: Dimension[] };

/** Deterministic exploratory mapping. This is not a suitability or employment prediction. */
export function suggestCareers(leadingDimensions: Dimension[], catalog: CareerReference[]): CareerSuggestion[] {
  const reasons = new Map<string, Dimension[]>();
  for (const dimension of leadingDimensions) {
    for (const careerId of careerMapping[dimension]) {
      const list = reasons.get(careerId) ?? [];
      list.push(dimension);
      reasons.set(careerId, list);
    }
  }
  return catalog
    .filter(career => reasons.has(career.id))
    .map(career => ({careerId: career.id, reasons: (reasons.get(career.id) ?? []).filter((dimension,index,all)=>all.indexOf(dimension)===index)}));
}

export function explainCareerSuggestion(reasons: Dimension[]): string {
  if (!reasons.length) return 'This career is included as an option to explore.';
  return `Your leading themes include ${reasons.map(dimension=>dimensions[dimension].name).join(' and ')}.`;
}
