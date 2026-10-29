import type { Career } from '../../services/careerRepository';

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

/** Catalog-driven templates. Generated content is a planning suggestion, not AI or an official qualification path. */
export function generateCareerRoadmap(career: Career | undefined, input: RoadmapInput): GeneratedRoadmapTask[] {
  const effort = input.weeklyTime ? `Plan for ${input.weeklyTime} per week` : 'Choose a pace that fits your schedule';
  if (!career?.skillRequirements.length) {
    return [
      { client_key: 'explore', title: 'Research the goal', description: 'Write down what you want to be able to do and find a reliable introductory source.', effort_note: effort, position: 0, task_type: 'foundation', resource_url: '', completion_criteria: 'A short goal statement and one source to investigate are recorded.', estimated_time: '1–2 sessions', skill_id: '', depends_on: [] },
      { client_key: 'practice', title: 'Try a small practice task', description: 'Choose a beginner activity related to your goal and note what you learned.', effort_note: effort, position: 1, task_type: 'skill_practice', resource_url: '', completion_criteria: 'A practice activity and reflection are completed.', estimated_time: '1–3 sessions', skill_id: '', depends_on: ['explore'] },
      { client_key: 'project', title: 'Make a small project', description: 'Create a small piece of work that demonstrates your learning. This basic template is not career-specific because no skill requirements are available in the catalog.', effort_note: effort, position: 2, task_type: 'project', resource_url: '', completion_criteria: 'A project artifact and a short reflection are saved.', estimated_time: 'Several sessions', skill_id: '', depends_on: ['practice'] },
    ];
  }
  const tasks: GeneratedRoadmapTask[] = [{
    client_key: 'orientation', title: `Set up your ${career.name} learning goal`, description: `${input.goalDescription || `Explore a path toward ${career.name}.`} Starting point: ${input.startingLevel}. ${career.path}`,
    effort_note: effort, position: 0, task_type: 'foundation', resource_url: '',
    completion_criteria: 'Write down a specific learning goal and one question to investigate.', estimated_time: '1 session', skill_id: '', depends_on: [],
  }];
  career.skillRequirements.forEach((skill, index) => tasks.push({
    client_key: `skill-${skill.id}`, title: `Practice ${skill.name}`, description: skill.notes || `Complete a beginner activity using ${skill.name.toLowerCase()} and record what you learned.`,
    effort_note: effort, position: index + 1, task_type: 'skill_practice', resource_url: '',
    completion_criteria: `Save a short reflection or artifact showing how you practiced ${skill.name}.`, estimated_time: '2–4 sessions', skill_id: skill.id, depends_on: [index === 0 ? 'orientation' : `skill-${career.skillRequirements[index - 1].id}`],
  }));
  tasks.push({
    client_key: 'portfolio-project', title: `Build a small ${career.name} project`, description: `Apply one or more skills from this roadmap to a small, clearly scoped project.`,
    effort_note: effort, position: tasks.length, task_type: 'project', resource_url: '',
    completion_criteria: 'Add the project to your portfolio and reflect on next steps.', estimated_time: 'Several sessions', skill_id: '',
    depends_on: [tasks[tasks.length - 1].client_key],
  });
  return tasks;
}
