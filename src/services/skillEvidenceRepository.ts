import { supabase } from './supabase';

export type SkillEvidence = {
  id: string;
  skill_id: string;
  evidence_type: 'self_reported' | 'portfolio_supported' | 'independently_assessed';
  portfolio_entry_id: string | null;
  note: string;
  created_at: string;
};

export async function loadSkillEvidence(userId: string): Promise<SkillEvidence[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('user_skill_evidence')
    .select('id,skill_id,evidence_type,portfolio_entry_id,note,created_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load skill evidence: ${error.message}`);
  return data || [];
}

export async function recordSkillEvidence(input: {
  userId: string;
  skillId: string;
  evidenceType: SkillEvidence['evidence_type'];
  portfolioEntryId?: string;
  note: string;
}): Promise<void> {
  if (!supabase) return;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== input.userId) throw new Error('Your authenticated account changed. Refresh and try again.');
  const { error } = await supabase.rpc('set_aayam_skill_evidence', {
    p_skill_id: input.skillId, p_evidence_type: input.evidenceType,
    p_portfolio_entry_id: input.portfolioEntryId || null, p_note: input.note,
  });
  if (error) throw new Error(`Could not save skill evidence: ${error.message}`);
}

export async function deleteSkillEvidence(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_skill_evidence').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Could not remove skill evidence: ${error.message}`);
}
