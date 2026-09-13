import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://drnlgmhkzbyrwatuuesh.supabase.co';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  console.log("Updating...");
  const { data, error } = await supabase.from('telegram_profiles').update({ status: 'Inactive' }).eq('chat_id', '7527336375').select();
  console.log("Data:", data);
  console.log("Error:", error);
}

testUpdate();
