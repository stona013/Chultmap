create table if not exists public.campaign_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.campaign_state (key, value)
values ('days_underway', '0'::jsonb)
on conflict (key) do nothing;

alter table public.campaign_state enable row level security;

grant select, insert, update, delete on table public.campaign_state to anon;
grant select, insert, update, delete on table public.campaign_state to authenticated;

drop policy if exists "Public read campaign state" on public.campaign_state;
create policy "Public read campaign state"
on public.campaign_state for select to anon using (true);

drop policy if exists "Public insert campaign state" on public.campaign_state;
create policy "Public insert campaign state"
on public.campaign_state for insert to anon with check (true);

drop policy if exists "Public update campaign state" on public.campaign_state;
create policy "Public update campaign state"
on public.campaign_state for update to anon using (true) with check (true);

create table if not exists public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Neue Seite' check (char_length(title) <= 120),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notebook_pages enable row level security;

grant select, insert, update, delete on table public.notebook_pages to anon;
grant select, insert, update, delete on table public.notebook_pages to authenticated;

drop policy if exists "Public read notebook pages" on public.notebook_pages;
create policy "Public read notebook pages"
on public.notebook_pages for select to anon using (true);

drop policy if exists "Public insert notebook pages" on public.notebook_pages;
create policy "Public insert notebook pages"
on public.notebook_pages for insert to anon with check (true);

drop policy if exists "Public update notebook pages" on public.notebook_pages;
create policy "Public update notebook pages"
on public.notebook_pages for update to anon using (true) with check (true);

drop policy if exists "Public delete notebook pages" on public.notebook_pages;
create policy "Public delete notebook pages"
on public.notebook_pages for delete to anon using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'campaign_state'
  ) then
    alter publication supabase_realtime add table public.campaign_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notebook_pages'
  ) then
    alter publication supabase_realtime add table public.notebook_pages;
  end if;
end $$;
