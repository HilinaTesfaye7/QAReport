import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envVars = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_ANON_KEY']
);

async function clearDB() {
  console.log('Clearing projects...');
  await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  
  console.log('Clearing tasks...');
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('Clearing bugs...');
  await supabase.from('bugs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('Clearing daily_reports...');
  await supabase.from('daily_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('Clearing blockers...');
  await supabase.from('blockers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('Clearing QA teams (testers)...');
  await supabase.from('users').delete().in('role', ['QA Tester', 'Automation QA Engineer']);
  
  console.log('Database cleared!');
}

clearDB().catch(console.error);
