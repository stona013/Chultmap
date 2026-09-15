create extension if not exists pgcrypto;

create table if not exists public.markers (
  id uuid primary key default gen_random_uuid(),
  x double precision not null,
  y double precision not null,
  title text not null check (char_length(title) <= 80),
  note text not null default '' check (char_length(note) <= 2000),
  category text not null default 'note'
    check (category in ('place', 'danger', 'quest', 'camp', 'npc', 'note')),
  created_at timestamptz not null default now()
);

alter table public.markers enable row level security;

drop policy if exists "Public read markers" on public.markers;
create policy "Public read markers"
on public.markers
for select
to anon
using (true);

drop policy if exists "Public insert markers" on public.markers;
create policy "Public insert markers"
on public.markers
for insert
to anon
with check (true);

drop policy if exists "Public update markers" on public.markers;
create policy "Public update markers"
on public.markers
for update
to anon
using (true)
with check (true);

drop policy if exists "Public delete markers" on public.markers;
create policy "Public delete markers"
on public.markers
for delete
to anon
using (true);

alter publication supabase_realtime add table public.markers;
