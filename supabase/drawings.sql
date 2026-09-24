create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  points jsonb not null,
  color text not null default '#d32f2f',
  size integer not null default 6 check (size >= 1 and size <= 50),
  created_at timestamptz not null default now()
);

alter table public.drawings enable row level security;

grant select, insert, update, delete
on table public.drawings
to anon;

grant select, insert, update, delete
on table public.drawings
to authenticated;

drop policy if exists "Public read drawings" on public.drawings;
create policy "Public read drawings"
on public.drawings
for select
to anon
using (true);

drop policy if exists "Public insert drawings" on public.drawings;
create policy "Public insert drawings"
on public.drawings
for insert
to anon
with check (true);

drop policy if exists "Public update drawings" on public.drawings;
create policy "Public update drawings"
on public.drawings
for update
to anon
using (true)
with check (true);

drop policy if exists "Public delete drawings" on public.drawings;
create policy "Public delete drawings"
on public.drawings
for delete
to anon
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'drawings'
  ) then
    alter publication supabase_realtime add table public.drawings;
  end if;
end $$;
