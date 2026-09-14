-- Voice Studio schema: profiles, generations, bookmarks, presets, usage, audio storage.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  theme text not null default 'system',
  monthly_char_quota integer not null default 100000,
  created_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  script text not null,
  voice text not null,
  model text not null,
  format text not null,
  speed numeric(4, 2) not null default 1,
  instructions text,
  locale text not null default 'en',
  char_count integer not null,
  duration_seconds numeric(8, 2),
  byte_size integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index generations_user_created_idx on public.generations (user_id, created_at desc);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id uuid not null references public.generations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

create table public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  instructions text not null,
  created_at timestamptz not null default now()
);

create table public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  characters integer not null default 0,
  generations integer not null default 0,
  primary key (user_id, month)
);

-- Row-level security: every user sees only their own rows.
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.bookmarks enable row level security;
alter table public.presets enable row level security;
alter table public.usage enable row level security;

create policy "profiles: own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "generations: own" on public.generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bookmarks: own" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "presets: own" on public.presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usage: own" on public.usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create a profile row when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Increment the caller's monthly usage.
create function public.add_usage(p_chars integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage (user_id, month, characters, generations)
  values (auth.uid(), date_trunc('month', now())::date, p_chars, 1)
  on conflict (user_id, month) do update
    set characters = public.usage.characters + excluded.characters,
        generations = public.usage.generations + 1;
$$;

-- Numbers for the sidebar.
create function public.dashboard_stats()
returns table (
  generations bigint,
  seconds numeric,
  bookmarks bigint,
  presets bigint,
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
    (select coalesce(u.characters, 0) from public.usage u
       where u.user_id = auth.uid() and u.month = date_trunc('month', now())::date),
    (select coalesce(p.monthly_char_quota, 100000) from public.profiles p where p.id = auth.uid());
$$;

-- Private bucket for generated audio. Files live under <user id>/<generation id>.<format>.
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

create policy "audio: read own" on storage.objects
  for select using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio: write own" on storage.objects
  for insert with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio: delete own" on storage.objects
  for delete using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
