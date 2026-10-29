import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The public anon key is intended for browser use only when every exposed table has RLS.
// Never place service-role or model-provider secrets in VITE_ variables.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const dataMode = supabase ? 'supabase-configured' : 'local-demo';
