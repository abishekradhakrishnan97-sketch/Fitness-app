-- Phase 2: food logging.
-- Additive changes only: no tables/columns dropped, no data rewritten.
--  * meal_items: serving quantity/unit, item source, barcode; portion_grams becomes optional
--  * meal totals kept correct by trigger on every item insert/update/delete
--  * update_meal(): atomic edit of a meal and its items (original timestamps preserved)
--  * save_meal(): stores the new item columns
--  * saved_meals: reusable meal templates
--  * my_foods(): the user's previously logged foods, for search / quick re-add
--  * private storage bucket "meal-photos" with per-user folder policies

-- ---------------------------------------------------------------------------
-- meal_items additions
-- ---------------------------------------------------------------------------
alter table public.meal_items
  alter column portion_grams drop not null,
  add column serving_quantity numeric(8, 2) check (serving_quantity > 0 and serving_quantity <= 10000),
  add column serving_unit     text check (char_length(serving_unit) <= 24),
  add column food_source      text not null default 'manual'
                              check (food_source in ('manual', 'ai_image', 'barcode', 'saved', 'history')),
  add column barcode          text check (barcode ~ '^[0-9]{6,14}$');

create index meal_items_user_name_idx on public.meal_items (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Keep meal totals in sync with items
-- ---------------------------------------------------------------------------
create or replace function public.recalc_meal_totals()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meal uuid := coalesce(new.meal_id, old.meal_id);
begin
  update public.meals m set
    total_calories_kcal   = coalesce(t.kcal, 0),
    total_protein_g       = coalesce(t.protein, 0),
    total_carbohydrates_g = coalesce(t.carbs, 0),
    total_fat_g           = coalesce(t.fat, 0),
    total_fibre_g         = coalesce(t.fibre, 0)
  from (
    select sum(calories_kcal) kcal, sum(protein_g) protein, sum(carbohydrates_g) carbs,
           sum(fat_g) fat, sum(fibre_g) fibre
    from public.meal_items where meal_id = v_meal
  ) t
  where m.id = v_meal;
  if tg_op = 'UPDATE' and old.meal_id is distinct from new.meal_id then
    update public.meals m set
      total_calories_kcal = coalesce((select sum(calories_kcal) from public.meal_items where meal_id = old.meal_id), 0),
      total_protein_g = coalesce((select sum(protein_g) from public.meal_items where meal_id = old.meal_id), 0),
      total_carbohydrates_g = coalesce((select sum(carbohydrates_g) from public.meal_items where meal_id = old.meal_id), 0),
      total_fat_g = coalesce((select sum(fat_g) from public.meal_items where meal_id = old.meal_id), 0),
      total_fibre_g = coalesce((select sum(fibre_g) from public.meal_items where meal_id = old.meal_id), 0)
    where m.id = old.meal_id;
  end if;
  return null;
end;
$$;
revoke execute on function public.recalc_meal_totals() from public, anon, authenticated;

create trigger meal_items_recalc_totals
  after insert or update or delete on public.meal_items
  for each row execute function public.recalc_meal_totals();

-- ---------------------------------------------------------------------------
-- save_meal v3 (adds serving_quantity, serving_unit, food_source, barcode)
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
    coalesce((p_meal ->> 'is_estimate')::boolean, false),
    nullif(p_meal ->> 'ai_model', ''),
    p_meal -> 'ai_analysis',
    nullif(p_meal ->> 'photo_path', '')
  )
  returning id into v_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.meal_items (
      meal_id, user_id, position, name, local_name, cuisine_region,
      portion_grams, portion_description, serving_quantity, serving_unit, food_source, barcode,
      calories_kcal, protein_g, carbohydrates_g, fat_g, fibre_g,
      other_nutrients, ai_confidence, ai_original, user_edited
    ) values (
      v_meal_id, v_uid, v_pos,
      v_item ->> 'name',
      nullif(v_item ->> 'local_name', ''),
      nullif(v_item ->> 'cuisine_region', ''),
      (v_item ->> 'portion_grams')::numeric,
      nullif(v_item ->> 'portion_description', ''),
      (v_item ->> 'serving_quantity')::numeric,
      nullif(v_item ->> 'serving_unit', ''),
      coalesce(nullif(v_item ->> 'food_source', ''), 'manual'),
      nullif(v_item ->> 'barcode', ''),
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

  return v_meal_id;
end;
$$;
revoke execute on function public.save_meal(jsonb, jsonb) from public, anon;
grant execute on function public.save_meal(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- update_meal: edit category/kind/notes and replace items atomically.
-- eaten_at, local_date, timezone, created_at and ai_analysis are never changed.
-- ---------------------------------------------------------------------------
create or replace function public.update_meal(p_meal_id uuid, p_meal jsonb, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item jsonb;
  v_pos  int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 30 then
    raise exception 'p_items must be an array of 1-30 items' using errcode = '22023';
  end if;

  update public.meals set
    meal_type     = coalesce(nullif(p_meal ->> 'meal_type', ''), meal_type),
    category_auto = coalesce((p_meal ->> 'category_auto')::boolean, category_auto),
    meal_kind     = coalesce(nullif(p_meal ->> 'meal_kind', ''), meal_kind),
    notes         = case when p_meal ? 'notes' then nullif(p_meal ->> 'notes', '') else notes end
  where id = p_meal_id and user_id = v_uid;
  if not found then
    raise exception 'Meal not found' using errcode = 'P0002';
  end if;

  delete from public.meal_items where meal_id = p_meal_id and user_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.meal_items (
      meal_id, user_id, position, name, local_name, cuisine_region,
      portion_grams, portion_description, serving_quantity, serving_unit, food_source, barcode,
      calories_kcal, protein_g, carbohydrates_g, fat_g, fibre_g,
      other_nutrients, ai_confidence, ai_original, user_edited
    ) values (
      p_meal_id, v_uid, v_pos,
      v_item ->> 'name',
      nullif(v_item ->> 'local_name', ''),
      nullif(v_item ->> 'cuisine_region', ''),
      (v_item ->> 'portion_grams')::numeric,
      nullif(v_item ->> 'portion_description', ''),
      (v_item ->> 'serving_quantity')::numeric,
      nullif(v_item ->> 'serving_unit', ''),
      coalesce(nullif(v_item ->> 'food_source', ''), 'manual'),
      nullif(v_item ->> 'barcode', ''),
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
end;
$$;
revoke execute on function public.update_meal(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_meal(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- saved_meals: reusable templates ("My usual breakfast")
-- ---------------------------------------------------------------------------
create table public.saved_meals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  items         jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  use_count     integer not null default 0 check (use_count >= 0),
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index saved_meals_user_idx on public.saved_meals (user_id, last_used_at desc nulls last);
create trigger saved_meals_set_updated_at before update on public.saved_meals
  for each row execute function public.set_updated_at();

alter table public.saved_meals enable row level security;
create policy "saved_meals: select own" on public.saved_meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saved_meals: insert own" on public.saved_meals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saved_meals: update own" on public.saved_meals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saved_meals: delete own" on public.saved_meals
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.saved_meals from anon, authenticated;
grant select, insert, update, delete on public.saved_meals to authenticated;

-- ---------------------------------------------------------------------------
-- my_foods: distinct foods the user has logged before (latest values), for
-- search and one-tap re-logging. Runs as the caller, so RLS applies.
-- ---------------------------------------------------------------------------
create or replace function public.my_foods(p_query text default null, p_limit int default 20)
returns table (
  name text,
  serving_quantity numeric,
  serving_unit text,
  portion_grams numeric,
  calories_kcal numeric,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  fibre_g numeric,
  other_nutrients jsonb,
  barcode text,
  times_logged bigint,
  last_logged_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select i.*, count(*) over (partition by lower(i.name)) as n,
           row_number() over (partition by lower(i.name) order by i.created_at desc) as rn
    from public.meal_items i
    where i.user_id = auth.uid()
      and (p_query is null or p_query = '' or i.name ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  )
  select name, serving_quantity, serving_unit, portion_grams, calories_kcal, protein_g, carbohydrates_g,
         fat_g, fibre_g, other_nutrients, barcode, n, created_at
  from ranked
  where rn = 1
  order by n desc, created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke execute on function public.my_foods(text, int) from public, anon;
grant execute on function public.my_foods(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Private meal photo storage: meal-photos/<user_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "meal-photos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal-photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal-photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
