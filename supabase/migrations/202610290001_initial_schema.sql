-- Aayam initial schema. Private rows are owned by auth.uid(); catalog rows are read-only.

create table if not exists public.careers (
  id text primary key,
  title text not null,
  category text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  riasec_mapping jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_definitions (
  id text primary key,
  name text not null,
  description text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.career_skill_requirements (
  career_id text not null references public.careers(id) on delete cascade,
  skill_id text not null references public.skill_definitions(id) on delete cascade,
  relevance text not null default 'relevant',
  notes text not null default '',
  primary key (career_id, skill_id)
);
create index if not exists career_skill_requirements_skill_idx
  on public.career_skill_requirements(skill_id, career_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  educational_stage text not null check (educational_stage in ('school', 'college', 'graduate', 'professional')),
  study_context jsonb not null default '{}'::jsonb,
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  learning_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument text not null default 'aayam-riasec-original-v1',
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id)
);
create index if not exists assessment_sessions_user_idx
  on public.assessment_sessions(user_id, started_at desc);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 80),
  response smallint not null check (response between 1 and 5),
  updated_at timestamptz not null default now(),
  unique (session_id, question_id),
  foreign key (session_id, user_id)
    references public.assessment_sessions(id, user_id) on delete cascade
);
create index if not exists assessment_responses_user_updated_idx
  on public.assessment_responses(user_id, updated_at desc);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_version text not null,
  scores jsonb not null,
  top_dimensions text[] not null default '{}',
  is_provisional boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.assessment_sessions(id, user_id) on delete cascade
);
create index if not exists assessment_results_user_created_idx
  on public.assessment_results(user_id, created_at desc);

create table if not exists public.saved_careers (
  user_id uuid not null references auth.users(id) on delete cascade,
  career_id text not null references public.careers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, career_id)
);
create index if not exists saved_careers_career_idx
  on public.saved_careers(career_id);

create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_id text references public.careers(id) on delete set null,
  title text not null default 'My learning roadmap',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, career_id)
);
create index if not exists roadmaps_user_updated_idx
  on public.roadmaps(user_id, updated_at desc);
create index if not exists roadmaps_career_idx
  on public.roadmaps(career_id);

create table if not exists public.roadmap_nodes (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  client_key text not null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  node_type text not null default 'milestone',
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed')),
  effort_note text not null default '',
  position integer not null default 0 check (position >= 0),
  skill_id text references public.skill_definitions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, roadmap_id),
  unique (roadmap_id, client_key)
);
create index if not exists roadmap_nodes_order_idx
  on public.roadmap_nodes(roadmap_id, position);
create index if not exists roadmap_nodes_skill_idx
  on public.roadmap_nodes(skill_id);

create table if not exists public.roadmap_edges (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  from_node_id uuid not null,
  to_node_id uuid not null,
  created_at timestamptz not null default now(),
  check (from_node_id <> to_node_id),
  unique (roadmap_id, from_node_id, to_node_id),
  constraint roadmap_edges_from_node_fk foreign key (from_node_id, roadmap_id)
    references public.roadmap_nodes(id, roadmap_id) on delete cascade,
  constraint roadmap_edges_to_node_fk foreign key (to_node_id, roadmap_id)
    references public.roadmap_nodes(id, roadmap_id) on delete cascade
);
create index if not exists roadmap_edges_to_node_idx
  on public.roadmap_edges(roadmap_id, to_node_id);

create table if not exists public.roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.roadmap_nodes(id) on delete cascade,
  status text not null check (status in ('upcoming', 'in_progress', 'completed')),
  updated_at timestamptz not null default now(),
  unique (user_id, node_id)
);
create index if not exists roadmap_progress_node_idx
  on public.roadmap_progress(node_id);

create table if not exists public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_key text not null,
  title text not null check (char_length(title) between 1 and 160),
  entry_type text not null check (entry_type in (
    'project', 'certificate', 'assessment', 'skill', 'competition', 'mentor_feedback'
  )),
  description text not null default '',
  related_skill_ids text[] not null default '{}',
  career_id text references public.careers(id) on delete set null,
  roadmap_node_id uuid references public.roadmap_nodes(id) on delete set null,
  evidence_reference text,
  evidence_status text not null default 'self_declared'
    check (evidence_status in ('self_declared', 'reviewed', 'independently_verified')),
  reflection text not null default '',
  occurred_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key),
  unique (id, user_id)
);
create index if not exists portfolio_entries_owner_created_idx
  on public.portfolio_entries(user_id, created_at desc);
create index if not exists portfolio_entries_career_idx
  on public.portfolio_entries(career_id);
create index if not exists portfolio_entries_roadmap_node_idx
  on public.portfolio_entries(roadmap_node_id);

create table if not exists public.user_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null references public.skill_definitions(id),
  portfolio_entry_id uuid,
  evidence_type text not null check (evidence_type in (
    'self_reported', 'portfolio_supported', 'independently_assessed'
  )),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (portfolio_entry_id, user_id)
    references public.portfolio_entries(id, user_id)
    on delete set null (portfolio_entry_id)
);
create index if not exists user_skill_evidence_owner_idx
  on public.user_skill_evidence(user_id, skill_id);
create index if not exists user_skill_evidence_skill_idx
  on public.user_skill_evidence(skill_id);
create index if not exists user_skill_evidence_portfolio_idx
  on public.user_skill_evidence(portfolio_entry_id);

-- RLS: private tables require auth.uid() ownership for reads and writes.
alter table public.profiles enable row level security;
create policy profiles_owner_all on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

alter table public.assessment_sessions enable row level security;
create policy assessment_sessions_owner_all on public.assessment_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.assessment_responses enable row level security;
create policy assessment_responses_owner_all on public.assessment_responses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.assessment_results enable row level security;
create policy assessment_results_owner_all on public.assessment_results
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.saved_careers enable row level security;
create policy saved_careers_owner_all on public.saved_careers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.user_skill_evidence enable row level security;
create policy user_skill_evidence_owner_all on public.user_skill_evidence
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.roadmaps enable row level security;
create policy roadmaps_owner_all on public.roadmaps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.roadmap_nodes enable row level security;
create policy roadmap_nodes_owner_all on public.roadmap_nodes
  for all to authenticated
  using (exists (
    select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()
  ));

alter table public.roadmap_edges enable row level security;
create policy roadmap_edges_owner_all on public.roadmap_edges
  for all to authenticated
  using (exists (
    select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()
  ));

alter table public.roadmap_progress enable row level security;
create policy roadmap_progress_owner_all on public.roadmap_progress
  for all to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.roadmap_nodes n
    join public.roadmaps r on r.id = n.roadmap_id
    where n.id = node_id and r.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.roadmap_nodes n
    join public.roadmaps r on r.id = n.roadmap_id
    where n.id = node_id and r.user_id = auth.uid()
  ));

alter table public.portfolio_entries enable row level security;
create policy portfolio_entries_owner_all on public.portfolio_entries
  for all to authenticated
  using (user_id = auth.uid() and (roadmap_node_id is null or exists (
    select 1 from public.roadmap_nodes n
    join public.roadmaps r on r.id = n.roadmap_id
    where n.id = roadmap_node_id and r.user_id = auth.uid()
  )))
  with check (user_id = auth.uid() and (roadmap_node_id is null or exists (
    select 1 from public.roadmap_nodes n
    join public.roadmaps r on r.id = n.roadmap_id
    where n.id = roadmap_node_id and r.user_id = auth.uid()
  )));

-- Public catalog access is read-only; career rows must be published.
alter table public.careers enable row level security;
create policy careers_published_read on public.careers
  for select to anon, authenticated using (is_published);

alter table public.skill_definitions enable row level security;
create policy skills_read on public.skill_definitions
  for select to anon, authenticated using (true);

alter table public.career_skill_requirements enable row level security;
create policy career_skills_read on public.career_skill_requirements
  for select to anon, authenticated using (true);

-- Maintain timestamps for mutable records.
create function public.aayam_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.aayam_set_updated_at();
create trigger assessment_responses_set_updated_at before update on public.assessment_responses
  for each row execute function public.aayam_set_updated_at();
create trigger user_skill_evidence_set_updated_at before update on public.user_skill_evidence
  for each row execute function public.aayam_set_updated_at();
create trigger roadmaps_set_updated_at before update on public.roadmaps
  for each row execute function public.aayam_set_updated_at();
create trigger roadmap_nodes_set_updated_at before update on public.roadmap_nodes
  for each row execute function public.aayam_set_updated_at();
create trigger roadmap_progress_set_updated_at before update on public.roadmap_progress
  for each row execute function public.aayam_set_updated_at();
create trigger portfolio_entries_set_updated_at before update on public.portfolio_entries
  for each row execute function public.aayam_set_updated_at();

-- Explicit grants keep catalog access read-only and private data authenticated-only.
grant select, insert, update, delete on
  public.profiles, public.assessment_sessions, public.assessment_responses,
  public.assessment_results, public.saved_careers, public.user_skill_evidence,
  public.roadmaps, public.roadmap_progress, public.portfolio_entries,
  public.roadmap_nodes, public.roadmap_edges to authenticated;
grant select on
  public.careers, public.skill_definitions, public.career_skill_requirements
  to anon, authenticated;

-- Illustrative global catalog entries; not labor-market data.
insert into public.careers(id, title, category, summary, details, riasec_mapping, is_published) values
('software', 'Software Developer', 'Technology', 'Design, build, test, and improve software used by people and organizations.', '{"pathway":"Programming fundamentals, small projects, and study options in computer science or software engineering."}'::jsonb, '{"R":["hands-on technical activities"],"I":["problem-solving"],"E":["initiative"]}'::jsonb, true),
('data', 'Data Scientist', 'Technology', 'Use data, statistics, and code to understand patterns and inform decisions.', '{"pathway":"Explore mathematics, statistics, programming, and small data projects."}'::jsonb, '{"R":["technical exploration"],"I":["analysis"],"C":["organizing information"]}'::jsonb, true),
('designer', 'Product Designer', 'Design', 'Make digital products easier to understand and use through research and design.', '{"pathway":"Learn design fundamentals, observe users, and build a portfolio of process and outcomes."}'::jsonb, '{"A":["creative expression"],"S":["understanding people"],"E":["presenting ideas"]}'::jsonb, true),
('research', 'Research Analyst', 'Research', 'Investigate questions, evaluate evidence, and communicate findings.', '{"pathway":"Build research methods and communication; explore subject-specific degree options."}'::jsonb, '{"I":["research"],"S":["communicating findings"],"C":["structured work"]}'::jsonb, true)
on conflict (id) do nothing;

insert into public.skill_definitions(id, name, description, category) values
('programming', 'Programming', 'Write and understand code to solve a problem.', 'Technical'),
('analysis', 'Data analysis', 'Organize and interpret information to answer questions.', 'Analytical'),
('statistics', 'Statistics', 'Use quantitative methods to summarize and reason about data.', 'Analytical'),
('communication', 'Communication', 'Explain an idea or decision to an audience.', 'Transferable'),
('research', 'Research', 'Find, evaluate, and synthesize information.', 'Analytical'),
('user-research', 'User research', 'Learn about people’s needs and experiences.', 'Design'),
('prototyping', 'Prototyping', 'Make a testable representation of an idea.', 'Design'),
('visual-design', 'Visual design', 'Use visual structure to communicate clearly.', 'Design'),
('problem-solving', 'Problem solving', 'Break down a challenge and explore possible approaches.', 'Transferable'),
('version-control', 'Version control', 'Track and coordinate changes to digital work.', 'Technical')
on conflict (id) do nothing;

insert into public.career_skill_requirements(career_id, skill_id, notes) values
('software', 'programming', 'Explore programming fundamentals through small builds.'),
('software', 'version-control', 'Learn to track changes as project work grows.'),
('software', 'problem-solving', 'Practice breaking tasks into manageable steps.'),
('software', 'communication', 'Explain decisions and collaborate.'),
('data', 'programming', 'Explore code as a way to work with data.'),
('data', 'analysis', 'Practice organizing and interpreting information.'),
('data', 'statistics', 'Learn quantitative concepts relevant to questions.'),
('data', 'communication', 'Explain findings and uncertainty.'),
('designer', 'user-research', 'Explore how people experience products.'),
('designer', 'prototyping', 'Create testable representations of ideas.'),
('designer', 'visual-design', 'Practice visual hierarchy and communication.'),
('designer', 'communication', 'Explain design choices and trade-offs.'),
('research', 'research', 'Develop structured inquiry and source evaluation.'),
('research', 'analysis', 'Compare evidence and identify patterns.'),
('research', 'communication', 'Share findings for a clear audience.'),
('research', 'problem-solving', 'Frame a question and possible approaches.')
on conflict (career_id, skill_id) do nothing;
