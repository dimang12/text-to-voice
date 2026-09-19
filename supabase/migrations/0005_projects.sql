-- Studio projects: a non-destructive timeline of clips cut from generated audio.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  timeline jsonb not null default '{"tracks":[{"id":"voice","name":"Voice","clips":[]}]}'::jsonb,
  duration_seconds numeric(8, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_updated_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;
create policy "projects: own" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
