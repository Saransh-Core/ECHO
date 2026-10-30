import { questions as riasecQuestions, selectBalancedQuestionIds, type Responses } from '../features/assessment/riasec';
import { scoreAssessment } from '../features/assessment/riasec';
import { supabase } from './supabase';

export type WorkspaceState = {
  profile: { name: string; stage: string; study: string; interests: string[]; goal: string; time: string } | null;
  assessment: Responses; assessmentComplete: boolean; career: string; done: string[];
  assessmentSessionId: string | null; assessmentQuestionIds: string[]; assessmentIndex: number;
  assessmentHistory: { id: string; attemptNumber: number; status: string; startedAt: string }[];
  entries: { id: string; title: string; type: string; desc: string; skill: string; skillId?: string; roadmapNodeId?: string; date: string }[];
  saved: string[];
  roadmapNodes: { id: string; title: string; desc: string; action: string; skills: string; effort: string; done?: boolean; custom?: boolean; dependsOn: string[] }[];
};

const stages: Record<string, string> = { School: 'school', College: 'college', 'Graduate / early career': 'graduate', 'Working professional': 'professional' };
const displayStages = Object.fromEntries(Object.entries(stages).map(([a,b]) => [b,a]));
type PortfolioEntryType = 'project' | 'certificate' | 'assessment' | 'skill' | 'competition' | 'mentor_feedback';
const entryTypes: Record<string, PortfolioEntryType> = { Projects: 'project', Certificates: 'certificate', Assessments: 'assessment', Skills: 'skill', Competitions: 'competition', 'Mentor Feedback': 'mentor_feedback' };
const displayEntryTypes: Record<PortfolioEntryType, string> = {
  project: 'Projects', certificate: 'Certificates', assessment: 'Assessments', skill: 'Skills',
  competition: 'Competitions', mentor_feedback: 'Mentor Feedback',
};
const fail = (error: { message: string; code?: string } | null) => {
  if (!error) return;
  const missingAttemptColumn = /selected_question_ids|active_question_index|attempt_number/i.test(error.message);
  if (missingAttemptColumn || (error.code === '42703' && /assessment_sessions/i.test(error.message))) {
    throw new Error(`Supabase is missing assessment-attempt schema fields (${error.message}). Apply supabase/migrations/202610290003_assessment_session_snapshots.sql in the Supabase SQL Editor, then reload Aayam. Existing assessment responses are preserved.`);
  }
  throw new Error(error.message);
};

export async function loadWorkspace(userId: string, fallback: WorkspaceState): Promise<WorkspaceState> {
  if (!supabase) return fallback;
  const [profileRes, roadmapRes, entryRes, savedRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('roadmaps').select('id,career_id,roadmap_nodes(id,client_key,title,description,node_type,status,effort_note,position,roadmap_edges!roadmap_edges_to_node_fk(from_node_id,to_node_id),roadmap_progress(status,node_id))').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('portfolio_entries').select('client_key,title,entry_type,description,related_skill_ids,roadmap_node_id,occurred_on,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('saved_careers').select('career_id').eq('user_id', userId),
  ]);
  [profileRes,roadmapRes,entryRes,savedRes].forEach(r=>fail(r.error));
  const {data:assessmentSessions,error:assessmentSessionError}=await supabase.from('assessment_sessions').select('id,selected_question_ids,active_question_index,attempt_number,status,started_at').eq('user_id',userId).eq('instrument','aayam-riasec-original-v1').order('started_at',{ascending:false}).limit(20);
  fail(assessmentSessionError);
  const assessmentSession=assessmentSessions?.[0];
  let assessment: Responses = {};
  let assessmentComplete=false;
  if(assessmentSession){
    const [responseRes,resultRes]=await Promise.all([
      supabase.from('assessment_responses').select('question_id,response').eq('session_id',assessmentSession.id).eq('user_id',userId),
      supabase.from('assessment_results').select('is_provisional').eq('session_id',assessmentSession.id).eq('user_id',userId).maybeSingle(),
    ]);
    fail(responseRes.error);fail(resultRes.error);
    for(const row of responseRes.data||[])assessment[row.question_id]=row.response;
    assessmentComplete=!!resultRes.data&&!resultRes.data.is_provisional;
  }
  const profile = profileRes.data;
  const roadmap = roadmapRes.data as any;
  const nodeRows = (roadmap?.roadmap_nodes || []) as any[];
  const keys = new Map(nodeRows.map(n=>[n.id,n.client_key]));
  const nodes = nodeRows.sort((a,b)=>a.position-b.position).map(n=>({ id:n.client_key, title:n.title, desc:n.description, action:'Choose a small activity and reflect on what you learned.', skills:'Self-directed learning', effort:n.effort_note, custom:n.node_type==='custom', dependsOn:(n.roadmap_edges||[]).filter((e:any)=>e.to_node_id===n.id).map((e:any)=>keys.get(e.from_node_id)).filter(Boolean), done:(n.roadmap_progress||[]).some((p:any)=>p.node_id===n.id&&p.status==='completed') }));
  return {
    ...fallback,
    profile: profile ? { name:profile.display_name||'', stage:displayStages[profile.educational_stage]||'School', study:profile.study_context?.summary||'', interests:profile.interests||[], goal:profile.goals?.[0]||'', time:profile.learning_preferences?.weekly_time||'3–5 hours' } : null,
    assessment, assessmentComplete,
    assessmentSessionId:assessmentSession?.id||null,
    assessmentQuestionIds:assessmentSession?.selected_question_ids?.length?assessmentSession.selected_question_ids:selectBalancedQuestionIds(assessmentSession?.attempt_number||1),
    assessmentIndex:assessmentSession?.active_question_index||0,
    assessmentHistory:(assessmentSessions||[]).map(session=>({id:session.id,attemptNumber:session.attempt_number,status:session.status,startedAt:session.started_at})),
    career: roadmap?.career_id || fallback.career, done:nodes.filter(n=>n.done).map(n=>n.id),
    roadmapNodes:nodes,
    entries:(entryRes.data||[]).map(e=>({id:e.client_key,title:e.title,type:displayEntryTypes[e.entry_type as PortfolioEntryType]||'Projects',desc:e.description,skill:e.related_skill_ids?.[0]||'',skillId:e.related_skill_ids?.[0]||'',roadmapNodeId:e.roadmap_node_id||undefined,date:e.occurred_on||e.created_at.slice(0,10)})),
    saved:(savedRes.data||[]).map(x=>x.career_id),
  };
}

const assessmentSaveQueues=new Map<string,Promise<string>>();
async function saveAssessmentNow(userId:string,responses:Responses,sessionId:string|null,questionIds:string[],activeIndex:number):Promise<string>{
  if(!supabase) return '';
  const allowedQuestionIds=new Set(questionIds.length?questionIds:riasecQuestions.map(question=>question.id));
  const invalid=Object.entries(responses).find(([questionId,value])=>!allowedQuestionIds.has(questionId)||!Number.isInteger(value)||value<1||value>5);
  if(invalid)throw new Error('An assessment answer is invalid. Please choose a response from 1 to 5.');
  let session: {id:string}|null=null;
  if(sessionId){const found=await supabase.from('assessment_sessions').select('id').eq('id',sessionId).eq('user_id',userId).maybeSingle();fail(found.error);if(!found.data)throw new Error('The selected assessment attempt is unavailable for this account.');session=found.data;}
  if(!session){const found=await supabase.from('assessment_sessions').select('id').eq('user_id',userId).eq('instrument','aayam-riasec-original-v1').eq('status','in_progress').order('started_at',{ascending:false}).limit(1).maybeSingle();fail(found.error);session=found.data;}
  if(!session){
    const selected=questionIds.length?questionIds:selectBalancedQuestionIds(1);
    const created=await supabase.from('assessment_sessions').insert({user_id:userId,instrument:'aayam-riasec-original-v1',selected_question_ids:selected,active_question_index:activeIndex,attempt_number:1}).select('id').single();
    fail(created.error);if(!created.data)throw new Error('The assessment session was not returned.');session=created.data;
  }
  const rows=Object.entries(responses).map(([question_id,response])=>({session_id:session!.id,user_id:userId,question_id,response}));
  if(rows.length){const {error}=await supabase.from('assessment_responses').upsert(rows,{onConflict:'session_id,question_id'});fail(error);}
  const {data:stored,error:storedError}=await supabase.from('assessment_responses').select('id,question_id').eq('session_id',session.id).eq('user_id',userId);
  fail(storedError);
  const activeQuestions=new Set(rows.map(row=>row.question_id));
  for(const row of stored||[])if(!activeQuestions.has(row.question_id)){const {error}=await supabase.from('assessment_responses').delete().eq('id',row.id).eq('user_id',userId);fail(error);}
  const result=scoreAssessment(responses,questionIds.length?questionIds:riasecQuestions.map(question=>question.id));
  const {error:resultError}=await supabase.from('assessment_results').upsert({session_id:session.id,user_id:userId,instrument_version:'aayam-riasec-original-v1',scores:result.scores,top_dimensions:result.top,is_provisional:!result.complete},{onConflict:'session_id'});
  fail(resultError);
  const {error:sessionUpdateError}=await supabase.from('assessment_sessions').update({status:result.complete?'completed':'in_progress',completed_at:result.complete?new Date().toISOString():null,selected_question_ids:questionIds.length?questionIds:riasecQuestions.map(question=>question.id),active_question_index:activeIndex}).eq('id',session.id).eq('user_id',userId);
  fail(sessionUpdateError);
  return session.id;
}

export function saveAssessment(userId:string,responses:Responses,sessionId:string|null=null,questionIds:string[]=[],activeIndex=0):Promise<string>{
  if(!supabase)return Promise.resolve('');
  const previous=assessmentSaveQueues.get(userId)||Promise.resolve('');
  const next=previous.catch(()=>undefined).then(()=>saveAssessmentNow(userId,responses,sessionId,questionIds,activeIndex));
  assessmentSaveQueues.set(userId,next);
  return next.finally(()=>{if(assessmentSaveQueues.get(userId)===next)assessmentSaveQueues.delete(userId);});
}

export async function startAssessmentAttempt(userId:string,attemptNumber:number):Promise<{id:string;questionIds:string[]}>{
  if(!supabase)throw new Error('Assessment attempts require a configured Supabase project.');
  const questionIds=selectBalancedQuestionIds(attemptNumber);
  const {data,error}=await supabase.from('assessment_sessions').insert({user_id:userId,instrument:'aayam-riasec-original-v1',status:'in_progress',attempt_number:attemptNumber,selected_question_ids:questionIds,active_question_index:0}).select('id').single();
  fail(error);if(!data)throw new Error('Could not create a new assessment attempt.');
  return {id:data.id,questionIds};
}

export async function saveAssessmentPosition(userId:string,sessionId:string,index:number):Promise<void>{
  if(!supabase)return;
  const {error}=await supabase.from('assessment_sessions').update({active_question_index:index}).eq('id',sessionId).eq('user_id',userId);
  fail(error);
}

export async function setSavedCareer(userId:string,careerId:string,saved:boolean):Promise<void>{
  if(!supabase)return;
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||user?.id!==userId)throw new Error('Your authenticated account changed. Refresh and try again.');
  const response=saved
    ?await supabase.from('saved_careers').upsert({user_id:userId,career_id:careerId},{onConflict:'user_id,career_id'})
    :await supabase.from('saved_careers').delete().eq('user_id',userId).eq('career_id',careerId);
  fail(response.error);
}

export async function saveProfile(userId: string, profile: NonNullable<WorkspaceState['profile']>): Promise<void> {
  if (!supabase) return;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error('Your authenticated account changed. Refresh and try again.');
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    display_name: profile.name.trim() || null,
    educational_stage: stages[profile.stage] || 'school',
    study_context: { summary: profile.study.trim() },
    interests: profile.interests,
    goals: profile.goal.trim() ? [profile.goal.trim()] : [],
    learning_preferences: { weekly_time: profile.time },
  }, { onConflict: 'id' });
  fail(error);
}

export async function saveWorkspace(userId: string, state: WorkspaceState): Promise<void> {
  if (!supabase) return;
  if (state.profile) {
    const p=state.profile;
    const {error}=await supabase.from('profiles').upsert({id:userId,display_name:p.name.trim()||null,educational_stage:stages[p.stage]||'school',study_context:{summary:p.study.trim()},interests:p.interests,goals:p.goal.trim()?[p.goal.trim()]:[],learning_preferences:{weekly_time:p.time}},{onConflict:'id'});
    fail(error);
  }
  const nodes=state.roadmapNodes;
  if (state.career || nodes.length || state.done.length) {
    let roadmapQuery=supabase.from('roadmaps').select('id').eq('user_id',userId).eq('title','My learning roadmap');
    roadmapQuery=state.career?roadmapQuery.eq('career_id',state.career):roadmapQuery.is('career_id',null);
    const {data:existingRoadmap,error:findRoadmapError}=await roadmapQuery.order('updated_at',{ascending:false}).limit(1).maybeSingle();fail(findRoadmapError);
    let roadmapId=existingRoadmap?.id;
    if(roadmapId){const {error}=await supabase.from('roadmaps').update({career_id:state.career||null}).eq('id',roadmapId).eq('user_id',userId);fail(error);}
    else {const {data:created,error}=await supabase.from('roadmaps').insert({user_id:userId,career_id:state.career||null,title:'My learning roadmap'}).select('id').single();fail(error);if(!created)throw new Error('Roadmap was not returned');roadmapId=created.id;}
    if(nodes.length||state.done.length){
      const nodePayload=nodes.map((n,position)=>({roadmap_id:roadmapId,client_key:n.id,title:n.title,description:n.desc,node_type:n.custom?'custom':'milestone',status:state.done.includes(n.id)?'completed':'upcoming',effort_note:n.effort,position}));
      if(nodePayload.length){const {error}=await supabase.from('roadmap_nodes').upsert(nodePayload,{onConflict:'roadmap_id,client_key'});fail(error);}
      const {data:savedNodes,error:nErr}=await supabase.from('roadmap_nodes').select('id,client_key').eq('roadmap_id',roadmapId);fail(nErr);
      const nodeIds=new Map((savedNodes||[]).map(n=>[n.client_key,n.id]));
      const {error:clearEdges}=await supabase.from('roadmap_edges').delete().eq('roadmap_id',roadmapId);fail(clearEdges);
      const activeIds=new Set(nodes.map(n=>n.id));
      for(const row of savedNodes||[])if(!activeIds.has(row.client_key)){const {error}=await supabase.from('roadmap_nodes').delete().eq('id',row.id);fail(error);}
      const edges=nodes.flatMap(n=>n.dependsOn.map(dep=>({roadmap_id:roadmapId,from_node_id:nodeIds.get(dep),to_node_id:nodeIds.get(n.id)}))).filter(e=>e.from_node_id&&e.to_node_id);
      if(edges.length){const {error}=await supabase.from('roadmap_edges').insert(edges);fail(error);}
      const progress=nodes.map(n=>({user_id:userId,node_id:nodeIds.get(n.id),status:state.done.includes(n.id)?'completed':'upcoming'})).filter(p=>p.node_id);
      const {error:deleteProgress}=await supabase.from('roadmap_progress').delete().eq('user_id',userId).in('node_id',Array.from(nodeIds.values()));fail(deleteProgress);
      if(progress.length){const {error}=await supabase.from('roadmap_progress').insert(progress);fail(error);}
    }
  }
  const {data:catalogSkills,error:catalogSkillError}=await supabase.from('skill_definitions').select('id');fail(catalogSkillError);const validSkillIds=new Set((catalogSkills||[]).map(skill=>skill.id));const canonicalSkillByEntry=new Map(state.entries.map(entry=>[entry.id,entry.skillId]));const entryRows=state.entries.filter(e=>e.id!=='sample').map(e=>({user_id:userId,client_key:e.id,title:e.title,entry_type:entryTypes[e.type]||'project',description:e.desc,related_skill_ids:e.skillId?[e.skillId]:e.skill?[e.skill]:[],roadmap_node_id:e.roadmapNodeId||null,occurred_on:e.date||null}));
  if(entryRows.length){const {data:savedEntries,error}=await supabase.from('portfolio_entries').upsert(entryRows,{onConflict:'user_id,client_key'}).select('id,client_key,related_skill_ids');fail(error);for(const entry of savedEntries||[]){const candidateSkillId=canonicalSkillByEntry.get(entry.client_key);const linkedSkillId=candidateSkillId&&validSkillIds.has(candidateSkillId)?candidateSkillId:undefined;const {data:prior,error:priorError}=await supabase.from('user_skill_evidence').select('id,skill_id').eq('user_id',userId).eq('portfolio_entry_id',entry.id).eq('evidence_type','portfolio_supported');fail(priorError);for(const record of prior||[])if(record.skill_id!==linkedSkillId){const {error:deleteEvidenceError}=await supabase.from('user_skill_evidence').delete().eq('id',record.id).eq('user_id',userId);fail(deleteEvidenceError);}if(linkedSkillId){const {error:recordEvidenceError}=await supabase.rpc('set_aayam_skill_evidence',{p_skill_id:linkedSkillId,p_evidence_type:'portfolio_supported',p_portfolio_entry_id:entry.id,p_note:'Linked from a portfolio entry.'});fail(recordEvidenceError);}}}
  const activeEntries=new Set(entryRows.map(e=>e.client_key));
  const {data:existingEntries,error:existingEntryError}=await supabase.from('portfolio_entries').select('id,client_key').eq('user_id',userId); fail(existingEntryError);
  for (const row of existingEntries||[]) if (!activeEntries.has(row.client_key)) { const {error:evidenceDeleteError}=await supabase.from('user_skill_evidence').delete().eq('user_id',userId).eq('portfolio_entry_id',row.id);fail(evidenceDeleteError);const {error}=await supabase.from('portfolio_entries').delete().eq('id',row.id).eq('user_id',userId); fail(error); }
}
