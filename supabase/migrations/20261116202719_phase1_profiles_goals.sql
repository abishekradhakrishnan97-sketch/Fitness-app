-- Phase 1: profiles, roles, preferences, goals, nutrition targets, weight logs,
-- and timezone-aware meal metadata. All tables are RLS-protected, owner-only for now.
-- Trainer access policies are added in the coaching phase via explicit trainer_clients links.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('user', 'client', 'trainer', 'admin');

create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.app_role not null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  display_name             text check (char_length(display_name) <= 80),
  birth_year               smallint check (birth_year between 1900 and 2100),
  height_cm                numeric(5, 1) check (height_cm between 50 and 272),
  sex                      text check (sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  activity_level           text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  fitness_experience       text check (fitness_experience in ('beginner', 'intermediate', 'advanced')),
  timezone                 text check (char_length(timezone) <= 64),
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Preferences (1:1)
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id                     uuid primary key references auth.users (id) on delete cascade,
  dietary_preference          text check (dietary_preference in
                                ('no_preference', 'vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'pescatarian', 'jain')),
  allergies                   text[] not null default '{}' check (cardinality(allergies) <= 30),
  food_restrictions           text[] not null default '{}' check (cardinality(food_restrictions) <= 30),
  preferred_cuisines          text[] not null default '{}' check (cardinality(preferred_cuisines) <= 20),
  workout_days_per_week       smallint check (workout_days_per_week between 0 and 7),
  workout_minutes_per_session smallint check (workout_minutes_per_session between 0 and 300),
  workout_environment         text check (workout_environment in ('home', 'gym', 'outdoor', 'mixed')),
  theme                       text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  dashboard_metrics           text[] not null default '{calories,protein,carbohydrates,fat,fibre,water}',
  -- Explicit consent before photos are sent to the external AI service.
  ai_photo_consent_at         timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Goals (history kept; one active goal per user)
-- ---------------------------------------------------------------------------
create table public.user_goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_type         text not null check (goal_type in
                      ('weight_loss', 'muscle_gain', 'recomposition', 'general_fitness', 'maintenance')),
  start_weight_kg   numeric(5, 2) check (start_weight_kg between 20 and 400),
  target_weight_kg  numeric(5, 2) check (target_weight_kg between 20 and 400),
  target_date       date,
  weekly_rate_kg    numeric(4, 2) check (weekly_rate_kg between -1.5 and 1.5),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index user_goals_one_active_idx on public.user_goals (user_id) where is_active;

-- ---------------------------------------------------------------------------
-- Nutrition targets (append-only history; latest effective row is current)
-- ---------------------------------------------------------------------------
create table public.nutrition_targets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  calories_kcal    integer not null check (calories_kcal between 800 and 8000),
  protein_g        integer not null check (protein_g between 0 and 600),
  carbohydrates_g  integer not null check (carbohydrates_g between 0 and 1200),
  fat_g            integer not null check (fat_g between 0 and 400),
  fibre_g          integer not null default 30 check (fibre_g between 0 and 150),
  water_ml         integer not null default 2500 check (water_ml between 0 and 10000),
  source           text not null default 'calculated' check (source in ('calculated', 'manual', 'trainer')),
  set_by           uuid default auth.uid() references auth.users (id) on delete set null,
  effective_from   date not null default current_date,
  created_at       timestamptz not null default now()
);
create index nutrition_targets_user_effective_idx
  on public.nutrition_targets (user_id, effective_from desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Weight logs
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weight_kg   numeric(5, 2) not null check (weight_kg between 20 and 400),
  logged_at   timestamptz not null default now(),
  local_date  date not null default current_date,
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index weight_logs_user_date_idx on public.weight_logs (user_id, local_date desc, logged_at desc);

-- ---------------------------------------------------------------------------
-- Meals: timezone-aware categorisation, meal kind, photo
-- ---------------------------------------------------------------------------
alter table public.meals
  add column local_date      date,
  add column timezone        text check (char_length(timezone) <= 64),
  add column category_auto   boolean not null default true,
  add column meal_kind       text not null default 'regular'
                             check (meal_kind in ('regular', 'treat', 'cheat', 'social')),
  add column photo_path      text check (char_length(photo_path) <= 500);

update public.meals set local_date = (eaten_at at time zone 'UTC')::date where local_date is null;
alter table public.meals alter column local_date set not null;
alter table public.meals alter column local_date set default current_date;

alter table public.meals drop constraint meals_meal_type_check;
alter table public.meals add constraint meals_meal_type_check
  check (meal_type in ('breakfast', 'pre_workout', 'lunch', 'snack', 'dinner', 'other'));

create index meals_user_local_date_idx on public.meals (user_id, local_date desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger user_goals_set_updated_at before update on public.user_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile, preferences, default 'user' role
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 80))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role helper for future policies (definer so it can read user_roles regardless of RLS)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role);
$$;
revoke execute on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily nutrition summary (security_invoker => RLS of meals applies)
-- ---------------------------------------------------------------------------
create view public.daily_nutrition
with (security_invoker = true) as
select
  user_id,
  local_date,
  count(*)::int                         as meal_count,
  sum(total_calories_kcal)::numeric(8,1)   as calories_kcal,
  sum(total_protein_g)::numeric(7,1)       as protein_g,
  sum(total_carbohydrates_g)::numeric(7,1) as carbohydrates_g,
  sum(total_fat_g)::numeric(7,1)           as fat_g,
  sum(total_fibre_g)::numeric(7,1)         as fibre_g
from public.meals
group by user_id, local_date;

-- ---------------------------------------------------------------------------
-- save_meal v2: adds local_date, timezone, meal_kind, photo_path, category_auto
-- ---------------------------------------------------------------------------
create or replace function public.save_meal(p_meal jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_meal_id uuid;
  v_item    jsonb;
  v_pos     int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 30 then
    raise exception 'p_items must be an array of 1-30 items' using errcode = '22023';
  end if;

  insert into public.meals (
    user_id, eaten_at, local_date, timezone, meal_type, category_auto, meal_kind, source, notes,
    is_estimate, ai_model, ai_analysis, photo_path
  ) values (
    v_uid,
    coalesce((p_meal ->> 'eaten_at')::timestamptz, now()),
    coalesce((p_meal ->> 'local_date')::date, current_date),
    nullif(p_meal ->> 'timezone', ''),
    nullif(p_meal ->> 'meal_type', ''),
    coalesce((p_meal ->> 'category_auto')::boolean, true),
    coalesce(nullif(p_meal ->> 'meal_kind', ''), 'regular'),
    coalesce(nullif(p_meal ->> 'source', ''), 'manual'),
    nullif(p_meal ->> 'notes', ''),
    coalesce((p_meal ->> 'is_estimate')::boolean, true),
    nullif(p_meal ->> 'ai_model', ''),
    p_meal -> 'ai_analysis',
    nullif(p_meal ->> 'photo_path', '')
  )
  returning id into v_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.meal_items (
      meal_id, user_id, position, name, local_name, cuisine_region,
      portion_grams, portion_description,
      calories_kcal, protein_g, carbohydrates_g, fat_g, fibre_g,
      other_nutrients, ai_confidence, ai_original, user_edited
    ) values (
      v_meal_id, v_uid, v_pos,
      v_item ->> 'name',
      nullif(v_item ->> 'local_name', ''),
      nullif(v_item ->> 'cuisine_region', ''),
      coalesce((v_item ->> 'portion_grams')::numeric, 0),
      nullif(v_item ->> 'portion_description', ''),
      coalesce((v_item ->> 'calories_kcal')::numeric, 0),
      coalesce((v_item ->> 'protein_g')::numeric, 0),
      coalesce((v_item ->> 'carbohydrates_g')::numeric, 0),
      coalesce((v_item ->> 'fat_g')::numeric, 0),
      coalesce((v_item ->> 'fibre_g')::numeric, 0),
      coalesce(v_item -> 'other_nutrients', '{}'::jsonb),
      (v_item ->> 'ai_confidence')::numeric,
      v_item -> 'ai_original',
      coalesce((v_item ->> 'user_edited')::boolean, false)
    );
    v_pos := v_pos + 1;
  end loop;

  update public.meals m set
    total_calories_kcal   = t.kcal,
    total_protein_g       = t.protein,
    total_carbohydrates_g = t.carbs,
    total_fat_g           = t.fat,
    total_fibre_g         = t.fibre
  from (
    select sum(calories_kcal) kcal, sum(protein_g) protein, sum(carbohydrates_g) carbs,
           sum(fat_g) fat, sum(fibre_g) fibre
    from public.meal_items where meal_id = v_meal_id
  ) t
  where m.id = v_meal_id;

  return v_meal_id;
end;
$$;
revoke execute on function public.save_meal(jsonb, jsonb) from public, anon;
grant execute on function public.save_meal(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.user_roles        enable row level security;
alter table public.profiles          enable row level security;
alter table public.user_preferences  enable row level security;
alter table public.user_goals        enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.weight_logs       enable row level security;

-- Roles are read-only for users; changes go through privileged server code.
create policy "user_roles: select own" on public.user_roles
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "profiles: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "user_preferences: select own" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_preferences: update own" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "user_goals: select own" on public.user_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_goals: insert own" on public.user_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_goals: update own" on public.user_goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_goals: delete own" on public.user_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "nutrition_targets: select own" on public.nutrition_targets
  for select to authenticated using ((select auth.uid()) = user_id);
-- Users may only add calculated/manual targets for themselves; 'trainer' targets come later via trainer policies.
create policy "nutrition_targets: insert own" on public.nutrition_targets
  for insert to authenticated with check (
    (select auth.uid()) = user_id and source in ('calculated', 'manual') and set_by = (select auth.uid())
  );

create policy "weight_logs: select own" on public.weight_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weight_logs: insert own" on public.weight_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weight_logs: update own" on public.weight_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weight_logs: delete own" on public.weight_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Explicit Data API grants (Supabase is moving to opt-in grants)
-- ---------------------------------------------------------------------------
revoke all on public.user_roles, public.profiles, public.user_preferences, public.user_goals,
  public.nutrition_targets, public.weight_logs, public.meals, public.meal_items,
  public.ai_usage_events, public.daily_nutrition from anon, authenticated;

grant select on public.user_roles to authenticated;
grant select, update on public.profiles, public.user_preferences to authenticated;
grant select, insert, update, delete on public.user_goals, public.weight_logs,
  public.meals, public.meal_items to authenticated;
grant select, insert on public.nutrition_targets, public.ai_usage_events to authenticated;
grant select on public.daily_nutrition to authenticated;
