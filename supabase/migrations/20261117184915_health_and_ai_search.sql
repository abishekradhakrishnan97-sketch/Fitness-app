-- Health profile for the coach + allow AI-searched foods. Additive only.

alter table public.user_preferences
  add column health_conditions    text[] not null default '{}' check (cardinality(health_conditions) <= 20),
  add column medication_flags     text[] not null default '{}' check (cardinality(medication_flags) <= 20),
  add column medication_notes     text check (char_length(medication_notes) <= 500),
  -- Explicit consent before health conditions are included in AI (Gemini) requests.
  add column health_ai_consent_at timestamptz;

alter table public.meal_items drop constraint meal_items_food_source_check;
alter table public.meal_items add constraint meal_items_food_source_check
  check (food_source in ('manual', 'ai_image', 'ai_search', 'barcode', 'saved', 'history'));
