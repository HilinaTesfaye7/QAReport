import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Static references so Vite bundle always has valid connection
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://drnlgmhkzbyrwatuuesh.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw';

const cleanUrl = (SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    cleanUrl &&
    SUPABASE_ANON_KEY &&
    !cleanUrl.includes('placeholder')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(cleanUrl, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
