-- Additive Aayam product upgrade. Leaves all existing records and RLS policies intact.
alter table public.roadmaps
  drop constraint if exists roadmaps_user_id_career_id_key;
alter table public.roadmaps
  add column if not exists goal_description text not null default '',
  add column if not exists client_key text,
  add column if not exists starting_level text not null default 'beginner',
  add column if not exists weekly_time text not null default '',
  add column if not exists target_date date,
  add column if not exists preferred_format text not null default '',
  add column if not exists status text not null default 'active'
    check (status in ('active', 'paused', 'archived'));
create index if not exists roadmaps_owner_status_updated_idx
  on public.roadmaps(user_id, status, updated_at desc);
create unique index if not exists roadmaps_owner_client_key_idx
  on public.roadmaps(user_id, client_key) where client_key is not null;

alter table public.roadmap_nodes
  add column if not exists task_type text not null default 'task',
  add column if not exists resource_url text,
  add column if not exists completion_criteria text not null default '',
  add column if not exists estimated_time text not null default '';

alter table public.assessment_sessions
  add column if not exists selected_question_ids text[] not null default '{}',
  add column if not exists active_question_index integer not null default 0
    check (active_question_index >= 0),
  add column if not exists attempt_number integer not null default 1
    check (attempt_number > 0);
create index if not exists assessment_attempts_owner_idx
  on public.assessment_sessions(user_id, instrument, started_at desc);

-- Atomic roadmap creation. It always derives ownership from the authenticated JWT.
create or replace function public.create_aayam_roadmap(p_roadmap jsonb, p_nodes jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_roadmap_id uuid;
  v_existing_id uuid;
  node jsonb;
  dependency text;
  from_id uuid;
  to_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(length(trim(p_roadmap->>'title')), 0) not between 1 and 120 then
    raise exception 'Roadmap title must be between 1 and 120 characters';
  end if;
  insert into public.roadmaps(user_id, career_id, client_key, title, goal_description, starting_level, weekly_time, target_date, preferred_format)
  values (
    auth.uid(), nullif(p_roadmap->>'career_id',''), p_roadmap->>'client_key', trim(p_roadmap->>'title'),
    coalesce(p_roadmap->>'goal_description',''), coalesce(p_roadmap->>'starting_level','beginner'),
    coalesce(p_roadmap->>'weekly_time',''), nullif(p_roadmap->>'target_date','')::date,
    coalesce(p_roadmap->>'preferred_format','')
  ) on conflict (user_id, client_key) where client_key is not null do nothing returning id into v_roadmap_id;
  if v_roadmap_id is null then
    select id into v_existing_id from public.roadmaps where user_id = auth.uid() and client_key = p_roadmap->>'client_key';
    return v_existing_id;
  end if;

  for node in select value from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb)) loop
    insert into public.roadmap_nodes(roadmap_id, client_key, title, description, node_type, effort_note, position, task_type, resource_url, completion_criteria, estimated_time, skill_id)
    values (
      v_roadmap_id, node->>'client_key', left(trim(node->>'title'),120), coalesce(node->>'description',''),
      'milestone', coalesce(node->>'effort_note',''), (node->>'position')::integer,
      coalesce(node->>'task_type','task'), nullif(node->>'resource_url',''),
      coalesce(node->>'completion_criteria',''), coalesce(node->>'estimated_time',''), nullif(node->>'skill_id','')
    );
  end loop;

  for node in select value from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb)) loop
    for dependency in select jsonb_array_elements_text(coalesce(node->'depends_on','[]'::jsonb)) loop
      select n.id into from_id from public.roadmap_nodes n where n.roadmap_id = v_roadmap_id and n.client_key = dependency;
      select n.id into to_id from public.roadmap_nodes n where n.roadmap_id = v_roadmap_id and n.client_key = node->>'client_key';
      if from_id is null or to_id is null then raise exception 'Roadmap prerequisite is invalid'; end if;
      insert into public.roadmap_edges(roadmap_id, from_node_id, to_node_id) values (v_roadmap_id, from_id, to_id);
    end loop;
  end loop;
  return v_roadmap_id;
end;
$$;
revoke all on function public.create_aayam_roadmap(jsonb, jsonb) from public;
grant execute on function public.create_aayam_roadmap(jsonb, jsonb) to authenticated;

-- Idempotent evidence recording under an account-scoped advisory transaction lock.
create or replace function public.set_aayam_skill_evidence(p_skill_id text, p_evidence_type text, p_portfolio_entry_id uuid, p_note text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_evidence_type not in ('self_reported','portfolio_supported','independently_assessed') then
    raise exception 'Invalid skill evidence type';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws(':',auth.uid()::text,p_skill_id,p_evidence_type,coalesce(p_portfolio_entry_id::text,'')),0));
  select id into v_id from public.user_skill_evidence
  where user_id=auth.uid() and skill_id=p_skill_id and evidence_type=p_evidence_type
    and portfolio_entry_id is not distinct from p_portfolio_entry_id
  order by created_at limit 1 for update;
  if v_id is null then
    insert into public.user_skill_evidence(user_id,skill_id,portfolio_entry_id,evidence_type,note)
    values(auth.uid(),p_skill_id,p_portfolio_entry_id,p_evidence_type,coalesce(p_note,''))
    returning id into v_id;
  else
    update public.user_skill_evidence set note=coalesce(p_note,'') where id=v_id and user_id=auth.uid();
  end if;
  return v_id;
end;
$$;
revoke all on function public.set_aayam_skill_evidence(text, text, uuid, text) from public;
grant execute on function public.set_aayam_skill_evidence(text, text, uuid, text) to authenticated;

create or replace function public.set_aayam_roadmap_task_status(p_roadmap_id uuid, p_node_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('upcoming', 'in_progress', 'completed') then raise exception 'Invalid task status'; end if;
  update public.roadmap_nodes n set status = p_status
  where n.id = p_node_id and n.roadmap_id = p_roadmap_id;
  if not found then raise exception 'Roadmap task not found'; end if;
  insert into public.roadmap_progress(user_id, node_id, status)
  values (auth.uid(), p_node_id, p_status)
  on conflict (user_id, node_id) do update set status = excluded.status, updated_at = now();
  update public.roadmaps set updated_at = now()
  where id = p_roadmap_id and user_id = auth.uid();
end;
$$;
revoke all on function public.set_aayam_roadmap_task_status(uuid, uuid, text) from public;
grant execute on function public.set_aayam_roadmap_task_status(uuid, uuid, text) to authenticated;
