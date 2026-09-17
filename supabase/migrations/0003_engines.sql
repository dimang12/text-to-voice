-- Per-user engine settings: which engines are on, their credentials (encrypted by the app), and defaults.

create table public.user_engines (
  user_id uuid not null references auth.users (id) on delete cascade,
  engine_id text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, engine_id)
);

alter table public.user_engines enable row level security;
create policy "user_engines: own" on public.user_engines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.profiles
  add column default_engine text,
  add column default_model text,
  add column default_voice text;

alter table public.generations add column engine text not null default 'openai';
update public.generations set engine = 'mms' where model = 'mms-tts';
