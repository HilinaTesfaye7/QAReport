import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function: /api/ping or /api/health
// Keeps Supabase project active and verifies platform health
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://drnlgmhkzbyrwatuuesh.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw';

  let dbOk = false;
  let dbError = null;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('projects').select('id').limit(1);
    if (!error) {
      dbOk = true;
    } else {
      dbError = error.message;
    }
  } catch (e) {
    dbError = e.message;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  return res.status(200).json({
    status: 'ok',
    service: 'AegisQA Keepalive & Health API',
    supabase: dbOk ? 'healthy' : `warning: ${dbError}`,
    timestamp: new Date().toISOString(),
  });
}
