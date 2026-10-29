import type { Career } from '../../services/careerRepository';

export type RoadmapStrategy = 'fast_track' | 'balanced' | 'project_based';
export const roadmapStrategies: { id: RoadmapStrategy; name: string; intensity: string; tradeoff: string }[] = [
  { id: 'fast_track', name: 'Fast Track', intensity: 'Focused and intensive', tradeoff: 'Prioritizes essential skills; optional topics wait.' },
  { id: 'balanced', name: 'Balanced Path', intensity: 'Steady progression', tradeoff: 'Builds foundations, practices each catalog skill, then completes a project.' },
  { id: 'project_based', name: 'Project-Based', intensity: 'Practice from the start', tradeoff: 'Starts with an early artifact; deeper foundations and polish come later.' },
];

export type RoadmapInput = {
  title: string;
  goalDescription: string;
  startingLevel: string;
  weeklyTime: string;
  targetDate?: string;
  preferredFormat: string;
};

export type GeneratedRoadmapTask = {
  client_key: string;
  title: string;
  description: string;
  effort_note: string;
  position: number;
  task_type: 'foundation' | 'skill_practice' | 'project' | 'reflection';
  resource_url: string;
  completion_criteria: string;
  estimated_time: string;
  skill_id: string;
  depends_on: string[];
};

export function inferRoadmapStrategy(tasks: Pick<GeneratedRoadmapTask, 'client_key'>[]): RoadmapStrategy {
  if (tasks.some(task => ['early-project', 'prototype'].includes(task.client_key))) return 'project_based';
  if (tasks.some(task => ['goal', 'sprint-brief', 'sprint-project'].includes(task.client_key))) return 'fast_track';
  return 'balanced';
}

function createTask(
  client_key: string,
  title: string,
  description: string,
  task_type: GeneratedRoadmapTask['task_type'],
  estimated_time: string,
  skill_id = '',
  depends_on: string[] = [],
  completion_criteria = 'Record the work you completed and one thing you learned.',
  effort_note = 'Choose a pace that fits your schedule',
): GeneratedRoadmapTask {
  return { client_key, title, description, task_type, estimated_time, skill_id, depends_on, completion_criteria, effort_note, position: 0, resource_url: '' };
}

function order(tasks: GeneratedRoadmapTask[], weeklyTime: string) {
  const effort = weeklyTime ? `Plan around ${weeklyTime} per week` : 'Choose a pace that fits your schedule';
  return tasks.map((task, position) => ({ ...task, position, effort_note: effort }));
}

function genericPath(input: RoadmapInput, strategy: RoadmapStrategy): GeneratedRoadmapTask[] {
  const goal = input.goalDescription || `Explore ${input.title.toLowerCase()} through small, practical steps.`;
  if (strategy === 'fast_track') return order([
    createTask('goal', 'Define one clear outcome', `Set a focused goal for your ${input.title} plan. Starting point: ${input.startingLevel}. ${goal}`, 'foundation', '1 session', '', [], 'Write one outcome you want to demonstrate and one question to investigate.'),
    createTask('practice', 'Try one focused practice activity', 'Choose a short beginner activity and keep a note of where you got stuck.', 'skill_practice', '1–2 sessions', '', ['goal'], 'Complete one activity and note a question to resolve.'),
    createTask('proof', 'Make a small proof-of-learning project', 'Create a narrowly scoped artifact that applies the practice activity.', 'project', '2–4 sessions', '', ['practice'], 'Save the artifact with a brief explanation of your decisions.'),
  ], input.weeklyTime);
  if (strategy === 'project_based') return order([
    createTask('prototype', 'Start a small first version', `Build a quick draft related to ${input.title}. Keep it intentionally small so it reveals what you need to learn.`, 'project', '1–2 sessions', '', [], 'Save a first draft and list two questions it raises.'),
    createTask('research', 'Learn what the draft requires', 'Investigate the questions from your draft using a reliable introductory source.', 'foundation', '1–2 sessions', '', ['prototype'], 'Record the source and summarize one useful concept.'),
    createTask('improve', 'Revise and explain your work', 'Use what you learned to improve the first version and describe the changes.', 'reflection', '2–3 sessions', '', ['research'], 'Save the revised version and a short before/after reflection.'),
  ], input.weeklyTime);
  return order([
    createTask('orientation', 'Understand the learning goal', `Clarify what progress on ${input.title} means to you. Starting point: ${input.startingLevel}. ${goal}`, 'foundation', '1 session'),
    createTask('explore', 'Find a reliable starting point', 'Choose an introductory source and write down three questions to explore.', 'foundation', '1–2 sessions', '', ['orientation']),
    createTask('practice', 'Complete a beginner activity', 'Try a focused practice task related to your goal and note what you learned.', 'skill_practice', '1–3 sessions', '', ['explore']),
    createTask('project', 'Create a small project', 'Apply your practice to a small artifact that you can explain to someone else.', 'project', 'Several sessions', '', ['practice']),
    createTask('reflect', 'Reflect and choose a next step', 'Review your work and decide what you want to deepen next.', 'reflection', '1 session', '', ['project']),
  ], input.weeklyTime);
}

/** Catalog-driven deterministic plans. They are planning suggestions, not AI or qualification advice. */
export function generateCareerRoadmap(career: Career | undefined, input: RoadmapInput, strategy: RoadmapStrategy = 'balanced'): GeneratedRoadmapTask[] {
  if (!career?.skillRequirements.length) return genericPath(input, strategy);

  const requirements = career.skillRequirements;
  const essential = requirements.filter(skill => /essential|required|critical/i.test(skill.relevance));
  const fastSkills = essential.length
    ? essential
    : requirements.slice(0, Math.max(1, Math.ceil(requirements.length / 2)));
  const effort = input.weeklyTime ? `Plan around ${input.weeklyTime} per week` : 'Choose a pace that fits your schedule';
  const start = createTask(
    'orientation',
    `Set up your ${career.name} learning goal`,
    `${input.goalDescription || `Explore a path toward ${career.name}.`} Starting point: ${input.startingLevel}. ${career.path}${input.preferredFormat ? ` Learning preference: ${input.preferredFormat}.` : ''}`,
    'foundation', '1 session', '', [], 'Write down a specific learning goal and one question to investigate.', effort,
  );
  const skillTask = (skill: Career['skillRequirements'][number], dependsOn: string[]): GeneratedRoadmapTask => createTask(
    `skill-${skill.id}`,
    `Practice ${skill.name}`,
    skill.notes || `Complete a beginner activity using ${skill.name.toLowerCase()} and record what you learned.`,
    'skill_practice', '2–4 sessions', skill.id, dependsOn,
    `Save a short reflection or artifact showing how you practiced ${skill.name}.`, effort,
  );
  let tasks: GeneratedRoadmapTask[];

  if (strategy === 'fast_track') {
    tasks = [createTask('sprint-brief', 'Set one focused outcome', `Choose one result to demonstrate on a focused ${career.name} sprint. Starting point: ${input.startingLevel}.`, 'foundation', '1 session', '', [], 'Write one outcome and the first essential skill you will practice.', effort)];
    for (const skill of fastSkills) tasks.push(skillTask(skill, [tasks[tasks.length - 1].client_key]));
    tasks.push(createTask('sprint-project', `Build a focused ${career.name} project`, `Apply the essential skills in a small, clearly scoped project. Optional catalog skills are omitted from this intensive first path.`, 'project', 'Several sessions', fastSkills.at(-1)?.id || '', [tasks[tasks.length - 1].client_key], 'Add the project to your portfolio and identify one next skill to deepen.', effort));
  } else if (strategy === 'project_based') {
    tasks = [start];
    const firstSkill = requirements[0];
    tasks.push(createTask('early-project', `Prototype a small ${career.name} project`, `Start a small artifact using ${firstSkill.name}. Build a draft early so it can guide what you learn next.`, 'project', '2–3 sessions', firstSkill.id, ['orientation'], `Save a draft and note two questions it raises.`, effort));
    for (const skill of requirements.slice(1)) tasks.push(skillTask(skill, [tasks[tasks.length - 1].client_key]));
    tasks.push(createTask('project-reflection', 'Refine and explain your project', 'Use the skills you practiced to improve your first draft, then explain your decisions and remaining questions.', 'reflection', '2–4 sessions', '', [tasks[tasks.length - 1].client_key], 'Add the revised artifact to your portfolio and write a short reflection.', effort));
  } else {
    tasks = [start];
    for (const skill of requirements) tasks.push(skillTask(skill, [tasks[tasks.length - 1].client_key]));
    tasks.push(createTask('portfolio-project', `Build a small ${career.name} project`, 'Apply one or more skills from this roadmap to a small, clearly scoped project.', 'project', 'Several sessions', '', [tasks[tasks.length - 1].client_key], 'Add the project to your portfolio and reflect on next steps.', effort));
  }
  return order(tasks, input.weeklyTime);
}
