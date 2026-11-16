-- Food logging: meals + itemised foods, saved only after the user reviews AI estimates.
-- Also a small usage log used to rate-limit the Gemini-backed analyse-food-image function.

-- ---------------------------------------------------------------------------
-- meals
-- ---------------------------------------------------------------------------
create table public.meals (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at               timestamptz not null default now(),
  meal_type              text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  source                 text not null default 'manual' check (source in ('ai_image', 'manual')),
  notes                  text check (char_length(notes) <= 1000),
  -- Nutrition from AI image analysis is always an estimate, even after user edits.
  is_estimate            boolean not null default true,
  ai_model               text,
  -- Untouched AI output kept for auditing / improving prompts. Never shown as fact.
  ai_analysis            jsonb,
  total_calories_kcal    numeric(8, 1) not null default 0,
  total_protein_g        numeric(7, 1) not null default 0,
  total_carbohydrates_g  numeric(7, 1) not null default 0,
  total_fat_g            numeric(7, 1) not null default 0,
  total_fibre_g          numeric(7, 1) not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index meals_user_eaten_at_idx on public.meals (user_id, eaten_at desc);

-- ---------------------------------------------------------------------------
-- meal_items
-- ---------------------------------------------------------------------------
create table public.meal_items (
  id                   uuid primary key default gen_random_uuid(),
  meal_id              uuid not null references public.meals (id) on delete cascade,
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position             smallint not null default 0,
  name                 text not null check (char_length(name) between 1 and 200),
  local_name           text check (char_length(local_name) <= 200),
  cuisine_region       text check (char_length(cuisine_region) <= 120),
  portion_grams        numeric(7, 1) not null check (portion_grams >= 0 and portion_grams <= 5000),
  portion_description  text check (char_length(portion_description) <= 300),
  calories_kcal        numeric(7, 1) not null default 0 check (calories_kcal >= 0),
  protein_g            numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbohydrates_g      numeric(6, 1) not null default 0 check (carbohydrates_g >= 0),
  fat_g                numeric(6, 1) not null default 0 check (fat_g >= 0),
  fibre_g              numeric(6, 1) not null default 0 check (fibre_g >= 0),
  -- sugar_g, saturated_fat_g, sodium_mg, potassium_mg, calcium_mg, iron_mg, cholesterol_mg ...
  other_nutrients      jsonb not null default '{}'::jsonb check (jsonb_typeof(other_nutrients) = 'object'),
  ai_confidence        numeric(3, 2) check (ai_confidence between 0 and 1),
  ai_original          jsonb,
  user_edited          boolean not null default false,
  created_at           timestamptz not null default now()
);

create index meal_items_meal_id_idx on public.meal_items (meal_id, position);
create index meal_items_user_id_idx on public.meal_items (user_id);

-- ---------------------------------------------------------------------------
-- ai_usage_events (rate limiting; users can read/insert their own rows only)
-- ---------------------------------------------------------------------------
create table public.ai_usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature     text not null check (char_length(feature) <= 64),
  created_at  timestamptz not null default now()
);

create index ai_usage_events_user_feature_time_idx
  on public.ai_usage_events (user_id, feature, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger meals_set_updated_at
  before update on public.meals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.ai_usage_events enable row level security;

create policy "meals: select own" on public.meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "meals: insert own" on public.meals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "meals: update own" on public.meals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meals: delete own" on public.meals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "meal_items: select own" on public.meal_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "meal_items: insert own" on public.meal_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid()))
  );
create policy "meal_items: update own" on public.meal_items
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid()))
  );
create policy "meal_items: delete own" on public.meal_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No update/delete policies: users cannot erase their usage history to dodge rate limits.
create policy "ai_usage_events: select own" on public.ai_usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_usage_events: insert own" on public.ai_usage_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- save_meal: atomically save a user-reviewed meal and its items.
-- Runs as the caller (security invoker), so RLS still applies.
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

  insert into public.meals (user_id, eaten_at, meal_type, source, notes, is_estimate, ai_model, ai_analysis)
  values (
    v_uid,
    coalesce((p_meal ->> 'eaten_at')::timestamptz, now()),
    nullif(p_meal ->> 'meal_type', ''),
    coalesce(nullif(p_meal ->> 'source', ''), 'manual'),
    nullif(p_meal ->> 'notes', ''),
    coalesce((p_meal ->> 'is_estimate')::boolean, true),
    nullif(p_meal ->> 'ai_model', ''),
    p_meal -> 'ai_analysis'
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
revoke execute on function public.set_updated_at() from public, anon, authenticated;
