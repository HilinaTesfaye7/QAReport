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

// Keepalive: Prevent Supabase project from pausing or dropping idle connection while dashboard is open
export const startSupabaseKeepAlive = () => {
  if (typeof window === 'undefined' || !supabase) return;
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : null;
  if (proc && (proc.env?.IS_TEST || proc.env?.NODE_ENV === 'test')) return;
  // Gentle background ping every 5 minutes
  const timer = setInterval(async () => {
    try {
      await supabase.from('projects').select('id').limit(1);
    } catch {
      // Silently handle background keepalive
    }
  }, 5 * 60 * 1000);
  if (timer && typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
};

startSupabaseKeepAlive();

