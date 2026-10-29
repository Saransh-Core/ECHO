-- Repair/complete the assessment-attempt schema without changing responses,
-- sessions, or existing RLS policies. Safe to run if some columns already exist.
alter table public.assessment_sessions
  add column if not exists selected_question_ids text[] not null default '{}',
  add column if not exists active_question_index integer not null default 0
    check (active_question_index >= 0),
  add column if not exists attempt_number integer not null default 1
    check (attempt_number > 0);

-- Legacy sessions have no stored question snapshot. The original RIASEC
-- instrument contained all 24 IDs, so retain their full response set when
-- restoring those sessions in the current attempt-aware frontend.
update public.assessment_sessions
set selected_question_ids = array[
  'r1','r2','r3','r4',
  'i1','i2','i3','i4',
  'a1','a2','a3','a4',
  's1','s2','s3','s4',
  'e1','e2','e3','e4',
  'c1','c2','c3','c4'
]::text[]
where coalesce(cardinality(selected_question_ids), 0) = 0;

create index if not exists assessment_attempts_owner_idx
  on public.assessment_sessions(user_id, instrument, started_at desc);

comment on column public.assessment_sessions.selected_question_ids is
  'Immutable RIASEC question ID snapshot for this attempt; legacy sessions are backfilled with the original 24 IDs.';
comment on column public.assessment_sessions.active_question_index is
  'Zero-based active question position saved for resuming this attempt.';
comment on column public.assessment_sessions.attempt_number is
  'One-based user attempt number for this assessment instrument.';
