-- Phase 2 end-to-end database test. SAFE TO RUN: everything is rolled back.
--
-- Runs as the first signed-up user (role "authenticated", RLS enforced) and checks:
-- create -> daily totals -> edit (timestamp preserved) -> totals trigger -> history
-- search -> saved meals -> another user can't read/edit/delete -> delete cascades
-- -> anonymous access blocked.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Expected result: an ERROR whose message starts with "E2E_RESULT:" listing every
-- check as ok. The deliberate error is what rolls the transaction back, so no test
-- data is left behind. Any other error message means a check failed.

do $$
declare
  a uuid := (select id from auth.users order by created_at limit 1);
  b uuid := gen_random_uuid();
  m uuid; n int; r record; eaten timestamptz; log text := '';
begin
  if a is null then raise exception 'No users yet — sign up in the app first.'; end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1. create (manual log, 2 items)
  m := public.save_meal(
    '{"meal_type":"breakfast","local_date":"2026-11-17","timezone":"Asia/Kolkata","category_auto":true,"source":"manual"}',
    '[{"name":"Idli","serving_quantity":3,"serving_unit":"piece","portion_grams":120,"calories_kcal":174,"protein_g":5.6,"carbohydrates_g":36.5,"fat_g":0.6,"fibre_g":1.8,"other_nutrients":{"sugar_g":0.4}},
      {"name":"Sambar","serving_quantity":1,"serving_unit":"katori","calories_kcal":115,"protein_g":5.2,"carbohydrates_g":15.3,"fat_g":3.4,"fibre_g":3.9}]');
  select * into r from public.meals where id = m;
  if r.total_calories_kcal <> 289 or r.total_protein_g <> 10.8 or r.is_estimate then
    raise exception 'create totals wrong: % %', r.total_calories_kcal, r.is_estimate;
  end if;
  eaten := r.eaten_at;
  log := log || 'create ok; ';

  -- 2. daily view reflects it
  select calories_kcal into r from public.daily_nutrition where user_id = a and local_date = '2026-11-17';
  if r.calories_kcal < 289 then raise exception 'daily view wrong'; end if;
  log := log || 'daily totals ok; ';

  -- 3. edit: category + items replaced, totals recalculated, timestamp preserved
  perform public.update_meal(m, '{"meal_type":"lunch","category_auto":false,"notes":"edited"}',
    '[{"name":"Idli","serving_quantity":2,"serving_unit":"piece","calories_kcal":116,"protein_g":3.7,"carbohydrates_g":24.3,"fat_g":0.4,"fibre_g":1.2,"user_edited":true}]');
  select * into r from public.meals where id = m;
  if r.total_calories_kcal <> 116 or r.meal_type <> 'lunch' or r.eaten_at <> eaten or r.notes <> 'edited' then
    raise exception 'update wrong: %', row_to_json(r);
  end if;
  select count(*) into n from public.meal_items where meal_id = m;
  if n <> 1 then raise exception 'items after update: %', n; end if;
  log := log || 'edit ok (timestamp kept); ';

  -- 4. direct item change recalculates via trigger
  update public.meal_items set calories_kcal = 150 where meal_id = m;
  select total_calories_kcal into r from public.meals where id = m;
  if r.total_calories_kcal <> 150 then raise exception 'totals trigger failed'; end if;
  log := log || 'totals trigger ok; ';

  -- 5. history search + saved meal
  select count(*) into n from public.my_foods('idl', 10) where name = 'Idli';
  if n <> 1 then raise exception 'my_foods failed'; end if;
  insert into public.saved_meals (name, items) values ('Test breakfast', '[{"name":"Idli","calories_kcal":116}]');
  log := log || 'history + saved meals ok; ';

  -- 6. another user sees and changes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.meals where id = m;
  if n <> 0 then raise exception 'RLS leak: other user can see meal'; end if;
  select count(*) into n from public.meal_items where meal_id = m;
  if n <> 0 then raise exception 'RLS leak: other user can see items'; end if;
  select count(*) into n from public.saved_meals;
  if n <> 0 then raise exception 'RLS leak: saved_meals'; end if;
  select count(*) into n from public.my_foods(null, 50);
  if n <> 0 then raise exception 'RLS leak: my_foods'; end if;
  begin
    perform public.update_meal(m, '{}', '[{"name":"hack","calories_kcal":1}]');
    raise exception 'RLS leak: other user updated meal';
  exception when sqlstate 'P0002' then null; end;
  delete from public.meals where id = m;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS leak: other user deleted meal'; end if;
  log := log || 'cross-user isolation ok; ';

  -- 7. owner deletes -> items cascade
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.meals where id = m;
  select count(*) into n from public.meal_items where meal_id = m;
  if n <> 0 then raise exception 'cascade delete failed'; end if;
  log := log || 'delete ok; ';

  -- 8. anonymous role has no access
  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.meals limit 1;
    raise exception 'anon could read meals';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_meal('{}', '[{"name":"x"}]');
    raise exception 'anon could call save_meal';
  exception when insufficient_privilege then null; end;
  log := log || 'anonymous blocked ok';

  raise exception 'E2E_RESULT: %', log;  -- rolls everything back
end $$;
