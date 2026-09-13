const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://drnlgmhkzbyrwatuuesh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw');
const newProj = {
  id: 'core-teletv',
  name: 'teletv',
  description: 'Core project umbrella',
  status: 'Testing',
  qa_progress: 0,
  regression_progress: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
supabase.from('projects').upsert([newProj]).then(res => console.log('Inserted teletv:', res));
