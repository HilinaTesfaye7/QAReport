const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://drnlgmhkzbyrwatuuesh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw');
supabase.from('telegram_profiles').update({ status: 'Active' }).eq('chat_id', '7527336375').then(res => console.log(res));
