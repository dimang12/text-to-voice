-- Saved scripts: drafts a user can reopen in the Studio later, with their voice settings.

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  voice text not null default 'alloy',
  model text not null default 'gpt-4o-mini-tts',
  format text not null default 'mp3',
  speed numeric(4, 2) not null default 1,
  instructions text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scripts_user_updated_idx on public.scripts (user_id, updated_at desc);

alter table public.scripts enable row level security;
create policy "scripts: own" on public.scripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sidebar numbers now include the saved-script count.
drop function public.dashboard_stats();
create function public.dashboard_stats()
returns table (
  generations bigint,
  seconds numeric,
  bookmarks bigint,
  presets bigint,
  scripts bigint,
  month_chars integer,
  quota integer
)
language sql
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.generations g where g.user_id = auth.uid()),
    (select coalesce(sum(g.duration_seconds), 0) from public.generations g where g.user_id = auth.uid()),
    (select count(*) from public.bookmarks b where b.user_id = auth.uid()),
    (select count(*) from public.presets p where p.user_id = auth.uid()),
    (select count(*) from public.scripts s where s.user_id = auth.uid()),
    (select coalesce(u.characters, 0) from public.usage u
       where u.user_id = auth.uid() and u.month = date_trunc('month', now())::date),
    (select coalesce(p.monthly_char_quota, 100000) from public.profiles p where p.id = auth.uid());
$$;
