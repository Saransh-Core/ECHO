export type Dimension = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
export const dimensions: Record<Dimension, { name: string; description: string; activity: string }> = {
  R: { name: 'Realistic', description: 'Practical, hands-on, technical, and tangible activities.', activity: 'Try a practical build, repair, or making activity.' },
  I: { name: 'Investigative', description: 'Research, analysis, scientific exploration, and problem-solving.', activity: 'Explore a question by gathering evidence and testing an idea.' },
  A: { name: 'Artistic', description: 'Creative expression, design, writing, and original ideas.', activity: 'Create an original visual, written, or digital piece.' },
  S: { name: 'Social', description: 'Helping, teaching, supporting, and collaborating with people.', activity: 'Help someone learn a skill or contribute to a shared activity.' },
  E: { name: 'Enterprising', description: 'Leadership, persuasion, entrepreneurship, and organizing initiatives.', activity: 'Organize a small initiative or explain an idea to an audience.' },
  C: { name: 'Conventional', description: 'Organizing information, following structured processes, and working with detail.', activity: 'Plan, organize, or carefully check information in a useful way.' },
};
export const scale = [
  { value: 1, label: 'Strongly dislike' }, { value: 2, label: 'Dislike' }, { value: 3, label: 'Unsure' },
  { value: 4, label: 'Like' }, { value: 5, label: 'Strongly like' },
];
// Original, non-proprietary activity statements. Each statement contributes one equally weighted response to one dimension.
export const questions: { id: string; dimension: Dimension; statement: string }[] = [
  {id:'r1',dimension:'R',statement:'Build or assemble something using tools or materials.'},
  {id:'r2',dimension:'R',statement:'Find out how a device works by taking it apart or examining its parts.'},
  {id:'r3',dimension:'R',statement:'Grow plants, care for animals, or work outdoors.'},
  {id:'r4',dimension:'R',statement:'Practice operating or maintaining equipment.'},
  {id:'i1',dimension:'I',statement:'Investigate why something happens by collecting evidence.'},
  {id:'i2',dimension:'I',statement:'Use numbers or information to find a pattern.'},
  {id:'i3',dimension:'I',statement:'Explore a science or technology question in depth.'},
  {id:'i4',dimension:'I',statement:'Compare possible explanations before reaching a conclusion.'},
  {id:'a1',dimension:'A',statement:'Design an image, object, or digital experience.'},
  {id:'a2',dimension:'A',statement:'Write a story, create music, or express an idea creatively.'},
  {id:'a3',dimension:'A',statement:'Experiment with color, form, or different ways to communicate.'},
  {id:'a4',dimension:'A',statement:'Invent an original approach when a task has no set instructions.'},
  {id:'s1',dimension:'S',statement:'Help someone understand a difficult idea.'},
  {id:'s2',dimension:'S',statement:'Listen to someone and help them think through a challenge.'},
  {id:'s3',dimension:'S',statement:'Work with a group to support a shared goal.'},
  {id:'s4',dimension:'S',statement:'Teach or guide someone through a new activity.'},
  {id:'e1',dimension:'E',statement:'Present an idea and encourage others to consider it.'},
  {id:'e2',dimension:'E',statement:'Lead a team activity or coordinate people toward a goal.'},
  {id:'e3',dimension:'E',statement:'Start a small project and find ways to bring it to life.'},
  {id:'e4',dimension:'E',statement:'Negotiate a plan when people have different priorities.'},
  {id:'c1',dimension:'C',statement:'Organize information so it is easy to find and use.'},
  {id:'c2',dimension:'C',statement:'Follow a clear process and make sure each step is complete.'},
  {id:'c3',dimension:'C',statement:'Check details in a document, schedule, or set of records.'},
  {id:'c4',dimension:'C',statement:'Create a practical plan to manage tasks and deadlines.'},
];
export type Responses = Record<string, number>;
export const careerMapping: Record<Dimension, string[]> = {
  R: ['software','data'], I: ['data','research'], A: ['designer'],
  S: ['designer','research'], E: ['designer','software'], C: ['data','research'],
};
export function selectBalancedQuestionIds(attemptNumber = 1): string[] {
  const attempt = Math.max(1, Math.floor(attemptNumber));
  const selected = (Object.keys(dimensions) as Dimension[]).flatMap(dimension => {
    const group = questions.filter(question => question.dimension === dimension);
    const omittedIndex = (attempt - 1) % group.length;
    return group.filter((_, index) => index !== omittedIndex).map(question => question.id);
  });
  const rotateBy = (attempt - 1) % selected.length;
  return [...selected.slice(rotateBy), ...selected.slice(0, rotateBy)];
}

export type Result = { scores: Record<Dimension, number | null>; counts: Record<Dimension, number>; top: Dimension[]; complete: boolean };
export function scoreAssessment(responses: Responses, selectedQuestionIds: string[] = questions.map(question => question.id)): Result {
  const selectedIds = new Set(selectedQuestionIds);
  const scores = {} as Result['scores']; const counts = {} as Result['counts'];
  (Object.keys(dimensions) as Dimension[]).forEach(d => {
    const applicable = questions.filter(q => q.dimension === d && selectedIds.has(q.id));
    const answered = applicable.map(q => responses[q.id]).filter((v): v is number => Number.isInteger(v) && v >= 1 && v <= 5);
    counts[d] = answered.length;
    // Normalized as mean relative to the 1–5 response range; missing answers remain null, never scored as dislikes.
    scores[d] = answered.length ? Math.round((answered.reduce((a,b)=>a+b,0) / answered.length - 1) / 4 * 100) : null;
  });
  const ranked = (Object.keys(dimensions) as Dimension[]).filter(d=>scores[d]!==null).sort((a,b)=>(scores[b]??0)-(scores[a]??0));
  const topScore = ranked.length ? scores[ranked[0]] : null;
  const top = topScore===null ? [] : ranked.filter(d=>(topScore-(scores[d]??0))<=8).slice(0,3);
  return {scores,counts,top,complete:selectedQuestionIds.length>0&&selectedQuestionIds.every(id=>responses[id]!==undefined)};
}
