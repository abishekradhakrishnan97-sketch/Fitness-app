-- Water tracking. Additive only.
create table public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_ml   integer not null check (amount_ml between 1 and 5000),
  logged_at   timestamptz not null default now(),
  local_date  date not null default current_date,
  created_at  timestamptz not null default now()
);
create index water_logs_user_date_idx on public.water_logs (user_id, local_date desc, logged_at desc);

alter table public.water_logs enable row level security;
create policy "water_logs: select own" on public.water_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "water_logs: insert own" on public.water_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "water_logs: update own" on public.water_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "water_logs: delete own" on public.water_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.water_logs from anon, authenticated;
grant select, insert, update, delete on public.water_logs to authenticated;
