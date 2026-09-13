import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://drnlgmhkzbyrwatuuesh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: err1 } = await supabase.from('users').select('*');
  console.log("USERS:", JSON.stringify(users, null, 2));
  
  const { data: profiles, error: err2 } = await supabase.from('telegram_profiles').select('*');
  console.log("TELEGRAM_PROFILES:", JSON.stringify(profiles, null, 2));
}

run();
