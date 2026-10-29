import { supabase } from './supabase';

export type Career = {
  id: string;
  name: string;
  group: string;
  desc: string;
  interests: string[];
  skills: string[];
  path: string;
  consider: string;
  riasecDimensions: string[];
  skillRequirements: { id: string; name: string; notes: string; relevance: string }[];
  details: Record<string, unknown>;
};

type CareerRow = {
  id: string; title: string; category: string; summary: string;
  riasec_mapping: Record<string, string[] | undefined> | null;
  details: Record<string, unknown> | null;
};

export async function loadCareerCatalog(): Promise<Career[]> {
  if (!supabase) return [];
  const [careersRes, requirementsRes, skillsRes] = await Promise.all([
    supabase.from('careers')
      .select('id,title,category,summary,details,riasec_mapping')
      .eq('is_published', true)
      .order('title'),
    supabase.from('career_skill_requirements').select('career_id,skill_id,notes,relevance'),
    supabase.from('skill_definitions').select('id,name,description,category'),
  ]);
  if (careersRes.error) throw new Error(`Career catalog: ${careersRes.error.message}`);
  if (requirementsRes.error) throw new Error(`Career skill requirements: ${requirementsRes.error.message}`);
  if (skillsRes.error) throw new Error(`Skill catalog: ${skillsRes.error.message}`);

  const requirementsByCareer = new Map<string, Career['skillRequirements']>();
  for (const row of requirementsRes.data || []) {
    const requirements = requirementsByCareer.get(row.career_id) || [];
    const skill = skillsRes.data?.find(item => item.id === row.skill_id);
    if (skill) requirements.push({ id: row.skill_id, name: skill.name, notes: row.notes || '', relevance: row.relevance || 'relevant' });
    requirementsByCareer.set(row.career_id, requirements);
  }
  return ((careersRes.data || []) as CareerRow[]).map(row => ({
    id: row.id,
    name: row.title,
    group: row.category,
    desc: row.summary,
    interests: [...new Set(Object.values(row.riasec_mapping || {}).flatMap(values => values || []))],
    skills: (requirementsByCareer.get(row.id) || []).map(skill => skill.name),
    riasecDimensions: Object.keys(row.riasec_mapping || {}),
    skillRequirements: requirementsByCareer.get(row.id) || [],
    details: row.details || {},
    path: typeof row.details?.pathway === 'string' ? row.details.pathway : 'Research learning pathways and try a small, relevant activity.',
    consider: typeof row.details?.consider === 'string' ? row.details.consider : 'Explore local study requirements and speak with people familiar with this field.',
  }));
}

export type SkillDefinition = { id: string; name: string; description: string; category: string };

export async function loadSkillCatalog(): Promise<SkillDefinition[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('skill_definitions').select('id,name,description,category').order('name');
  if (error) throw new Error(`Skill catalog: ${error.message}`);
  return data || [];
}
