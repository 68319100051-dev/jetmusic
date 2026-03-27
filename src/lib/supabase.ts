import { createClient } from '@supabase/supabase-js';

// The URL and Anon Key need to be set in your .env.local file.
// Currently falling back to mock strings so the app doesn't crash on boot without env vars.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
