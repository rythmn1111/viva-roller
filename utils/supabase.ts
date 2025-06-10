import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types for our database tables
export interface VivaQueue {
  id: number
  enrollment_number: string
  queue_position: number
  status: 'waiting' | 'called' | 'completed' | 'warned'
  created_at: string
  updated_at: string
}

export interface SystemSettings {
  id: number
  setting_key: string
  setting_value: string
  updated_at: string
}