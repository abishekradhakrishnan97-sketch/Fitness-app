// Generated from the Supabase schema (public). Regenerate after migrations:
//   Supabase MCP `generate_typescript_types`, or
//   npx supabase gen types typescript --project-id lyeaepzcyxujwcruuddw > src/types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Rel extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Rel;
};

export type AppRole = 'user' | 'client' | 'trainer' | 'admin';

export type MealRow = {
  ai_analysis: Json | null;
  ai_model: string | null;
  category_auto: boolean;
  created_at: string;
  eaten_at: string;
  id: string;
  is_estimate: boolean;
  local_date: string;
  meal_kind: string;
  meal_type: string | null;
  notes: string | null;
  photo_path: string | null;
  source: string;
  timezone: string | null;
  total_calories_kcal: number;
  total_carbohydrates_g: number;
  total_fat_g: number;
  total_fibre_g: number;
  total_protein_g: number;
  updated_at: string;
  user_id: string;
};

export type MealItemRow = {
  ai_confidence: number | null;
  ai_original: Json | null;
  calories_kcal: number;
  carbohydrates_g: number;
  created_at: string;
  cuisine_region: string | null;
  fat_g: number;
  fibre_g: number;
  id: string;
  local_name: string | null;
  meal_id: string;
  name: string;
  other_nutrients: Json;
  portion_description: string | null;
  portion_grams: number | null;
  position: number;
  protein_g: number;
  serving_quantity: number | null;
  serving_unit: string | null;
  food_source: string;
  barcode: string | null;
  user_edited: boolean;
  user_id: string;
};

export type SavedMealRow = {
  id: string;
  user_id: string;
  name: string;
  items: Json;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MyFoodRow = {
  name: string;
  serving_quantity: number | null;
  serving_unit: string | null;
  portion_grams: number | null;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fibre_g: number;
  other_nutrients: Json;
  barcode: string | null;
  times_logged: number;
  last_logged_at: string;
};

export type NutritionTargetRow = {
  calories_kcal: number;
  carbohydrates_g: number;
  created_at: string;
  effective_from: string;
  fat_g: number;
  fibre_g: number;
  id: string;
  protein_g: number;
  set_by: string | null;
  source: string;
  user_id: string;
  water_ml: number;
};

export type ProfileRow = {
  activity_level: string | null;
  birth_year: number | null;
  created_at: string;
  display_name: string | null;
  fitness_experience: string | null;
  height_cm: number | null;
  id: string;
  onboarding_completed_at: string | null;
  sex: string | null;
  timezone: string | null;
  updated_at: string;
};

export type UserGoalRow = {
  created_at: string;
  goal_type: string;
  id: string;
  is_active: boolean;
  start_weight_kg: number | null;
  target_date: string | null;
  target_weight_kg: number | null;
  updated_at: string;
  user_id: string;
  weekly_rate_kg: number | null;
};

export type UserPreferencesRow = {
  ai_photo_consent_at: string | null;
  allergies: string[];
  created_at: string;
  dashboard_metrics: string[];
  dietary_preference: string | null;
  food_restrictions: string[];
  preferred_cuisines: string[];
  theme: string;
  updated_at: string;
  user_id: string;
  workout_days_per_week: number | null;
  workout_environment: string | null;
  workout_minutes_per_session: number | null;
};

export type WeightLogRow = {
  created_at: string;
  id: string;
  local_date: string;
  logged_at: string;
  note: string | null;
  user_id: string;
  weight_kg: number;
};

export type DailyNutritionRow = {
  calories_kcal: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  local_date: string | null;
  meal_count: number | null;
  protein_g: number | null;
  user_id: string | null;
};

type Opt<T, Required extends keyof T> = Pick<T, Required> & Partial<Omit<T, Required>>;

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      ai_usage_events: Table<
        { created_at: string; feature: string; id: number; user_id: string },
        { created_at?: string; feature: string; user_id?: string }
      >;
      meal_items: Table<
        MealItemRow,
        Opt<MealItemRow, 'meal_id' | 'name'>,
        [
          {
            foreignKeyName: 'meal_items_meal_id_fkey';
            columns: ['meal_id'];
            isOneToOne: false;
            referencedRelation: 'meals';
            referencedColumns: ['id'];
          },
        ]
      >;
      saved_meals: Table<SavedMealRow, Opt<SavedMealRow, 'name' | 'items'>>;
      meals: Table<MealRow, Partial<MealRow>>;
      nutrition_targets: Table<
        NutritionTargetRow,
        Opt<NutritionTargetRow, 'calories_kcal' | 'carbohydrates_g' | 'fat_g' | 'protein_g'>
      >;
      profiles: Table<ProfileRow, Opt<ProfileRow, 'id'>>;
      user_goals: Table<UserGoalRow, Opt<UserGoalRow, 'goal_type'>>;
      user_preferences: Table<UserPreferencesRow, Opt<UserPreferencesRow, 'user_id'>>;
      user_roles: Table<
        { granted_at: string; role: AppRole; user_id: string },
        { granted_at?: string; role: AppRole; user_id: string }
      >;
      weight_logs: Table<WeightLogRow, Opt<WeightLogRow, 'weight_kg'>>;
    };
    Views: {
      daily_nutrition: { Row: DailyNutritionRow; Relationships: [] };
    };
    Functions: {
      has_role: { Args: { p_role: AppRole }; Returns: boolean };
      save_meal: { Args: { p_items: Json; p_meal: Json }; Returns: string };
      update_meal: { Args: { p_meal_id: string; p_meal: Json; p_items: Json }; Returns: undefined };
      my_foods: { Args: { p_query?: string | null; p_limit?: number }; Returns: MyFoodRow[] };
    };
    Enums: { app_role: AppRole };
    CompositeTypes: { [_ in never]: never };
  };
};
