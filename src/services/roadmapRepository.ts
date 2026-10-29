import { inferRoadmapStrategy, type GeneratedRoadmapTask, type RoadmapInput, type RoadmapStrategy } from '../features/roadmaps/generator';
import { supabase } from './supabase';

export type RoadmapTask = GeneratedRoadmapTask & { id: string; status: 'upcoming' | 'in_progress' | 'completed' };
export type RoadmapSummary = RoadmapInput & {
  id: string;
  careerId: string | null;
  status: 'active' | 'paused' | 'archived';
  strategy?: RoadmapStrategy;
  updatedAt: string;
  tasks: RoadmapTask[];
};

function roadmapLoadError(message: string): Error {
  const referencesUpgradeField = /roadmap_nodes\.(?:l_)?(?:task_type|resource_url|completion_criteria|estimated_time)|(?:goal_description|starting_level|weekly_time|target_date|preferred_format|client_key|status)/i.test(message);
  if (referencesUpgradeField) {
    return new Error(`Could not load roadmaps because Supabase is missing a roadmap-upgrade field: ${message}. The current app uses roadmap_nodes.task_type (there is no l_task_type field in this codebase). Check that supabase/migrations/202610290002_career_intelligence.sql was applied to this project, then reload Aayam.`);
  }
  return new Error(`Could not load roadmaps: ${message}`);
}

export async function listRoadmaps(userId: string): Promise<RoadmapSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('roadmaps')
    .select('id,career_id,title,goal_description,starting_level,weekly_time,target_date,preferred_format,status,updated_at,roadmap_nodes(id,client_key,title,description,effort_note,position,task_type,resource_url,completion_criteria,estimated_time,skill_id,status,roadmap_edges!roadmap_edges_to_node_fk(from_node_id,to_node_id))')
    .eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw roadmapLoadError(error.message);
  return (data || []).map((row: any) => {
    const nodeKeys = new Map((row.roadmap_nodes || []).map((task: any) => [task.id, task.client_key]));
    const tasks: RoadmapTask[] = (row.roadmap_nodes || []).sort((a: any, b: any) => a.position - b.position).map((task: any) => ({
      id: task.id, client_key: task.client_key, title: task.title, description: task.description,
      effort_note: task.effort_note, position: task.position, task_type: task.task_type,
      resource_url: task.resource_url || '', completion_criteria: task.completion_criteria,
      estimated_time: task.estimated_time, skill_id: task.skill_id || '', depends_on: (task.roadmap_edges || []).map((edge: any) => nodeKeys.get(edge.from_node_id)).filter(Boolean), status: task.status || 'upcoming',
    }));
    return ({
    id: row.id, careerId: row.career_id, title: row.title, goalDescription: row.goal_description,
    startingLevel: row.starting_level, weeklyTime: row.weekly_time, targetDate: row.target_date || '',
    preferredFormat: row.preferred_format, status: row.status, updatedAt: row.updated_at,
    strategy: inferRoadmapStrategy(tasks), tasks,
  });
  });
}

export async function createRoadmap(userId: string, clientKey: string, careerId: string | null, input: RoadmapInput, tasks: GeneratedRoadmapTask[]): Promise<string> {
  if (!supabase) throw new Error('Cloud roadmap creation requires a configured Supabase project.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error('Your authenticated account changed. Refresh and try again.');
  const { data, error } = await supabase.rpc('create_aayam_roadmap', {
    p_roadmap: { client_key: clientKey, career_id: careerId, title: input.title, goal_description: input.goalDescription, starting_level: input.startingLevel, weekly_time: input.weeklyTime, target_date: input.targetDate || null, preferred_format: input.preferredFormat },
    p_nodes: tasks,
  });
  if (error) throw new Error(`Could not create roadmap: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Roadmap creation did not return its identifier.');
  return data;
}

export async function setRoadmapStatus(userId: string, roadmapId: string, status: RoadmapSummary['status']): Promise<void> {
  if (!supabase) throw new Error('Cloud roadmap updates require a configured Supabase project.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error('Your authenticated account changed. Refresh and try again.');
  const { error } = await supabase.from('roadmaps').update({ status }).eq('id', roadmapId).eq('user_id', userId);
  if (error) throw new Error(`Could not update roadmap: ${error.message}`);
}

export async function removeRoadmap(userId: string, roadmapId: string): Promise<void> {
  if (!supabase) throw new Error('Cloud roadmap deletion requires a configured Supabase project.');
  const { error } = await supabase.from('roadmaps').delete().eq('id', roadmapId).eq('user_id', userId);
  if (error) throw new Error(`Could not delete roadmap: ${error.message}`);
}

export async function updateRoadmapTaskStatus(userId: string, roadmapId: string, taskId: string, status: RoadmapTask['status']): Promise<void> {
  if (!supabase) throw new Error('Cloud progress updates require a configured Supabase project.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error('Your authenticated account changed. Refresh and try again.');
  const { error } = await supabase.rpc('set_aayam_roadmap_task_status', { p_roadmap_id: roadmapId, p_node_id: taskId, p_status: status });
  if (error) throw new Error(`Could not save task progress: ${error.message}`);
}

export async function updateRoadmapGoal(userId: string, roadmapId: string, input: RoadmapInput): Promise<void> {
  if (!supabase) throw new Error('Cloud roadmap editing requires a configured Supabase project.');
  const { error } = await supabase.from('roadmaps').update({ title: input.title, goal_description: input.goalDescription, starting_level: input.startingLevel, weekly_time: input.weeklyTime, target_date: input.targetDate || null, preferred_format: input.preferredFormat }).eq('id', roadmapId).eq('user_id', userId);
  if (error) throw new Error(`Could not update roadmap goal: ${error.message}`);
}

export async function updateRoadmapTask(userId: string, taskId: string, task: Pick<GeneratedRoadmapTask, 'title'|'description'|'effort_note'|'resource_url'|'completion_criteria'|'estimated_time'>): Promise<void> {
  if (!supabase) throw new Error('Cloud task editing requires a configured Supabase project.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error('Your authenticated account changed. Refresh and try again.');
  const { error } = await supabase.from('roadmap_nodes').update({ title: task.title, description: task.description, effort_note: task.effort_note, resource_url: task.resource_url || null, completion_criteria: task.completion_criteria, estimated_time: task.estimated_time }).eq('id', taskId);
  if (error) throw new Error(`Could not update roadmap task: ${error.message}`);
}
