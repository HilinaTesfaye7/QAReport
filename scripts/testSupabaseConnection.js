import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Read .env
function loadEnv() {
  if (fs.existsSync('.env')) {
    const content = fs.readFileSync('.env', 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        let val = match[2] ? match[2].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[match[1]] = val;
      }
    }
  }
}
loadEnv();

let rawUrl = process.env.VITE_SUPABASE_URL || '';
rawUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('----------------------------------------------------');
console.log('🔍 Testing Supabase Cloud Database Connection');
console.log(`Endpoint: ${rawUrl}`);
console.log('----------------------------------------------------');

if (!rawUrl || !anonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(rawUrl, anonKey);

async function runCheck() {
  const tables = ['projects', 'telegram_profiles', 'daily_reports', 'blockers'];
  const results = {};

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        results[table] = { status: 'ERROR', error: error.message };
      } else {
        results[table] = { status: 'OK', rows: count ?? data.length, sample: data.slice(0, 2) };
      }
    } catch (e) {
      results[table] = { status: 'EXCEPTION', error: e.message };
    }
  }

  console.log('\n📊 Database Status Results:');
  let allGood = true;
  for (const [table, res] of Object.entries(results)) {
    if (res.status === 'OK') {
      console.log(`  ✅ Table '${table}': Connected! (${res.rows} rows found)`);
      if (res.rows > 0 && table === 'projects') {
        res.sample.forEach((p, idx) => console.log(`     - [Project ${idx+1}] ${p.name} (id: ${p.id})`));
      }
      if (res.rows > 0 && table === 'telegram_profiles') {
        res.sample.forEach((p, idx) => console.log(`     - [Profile] ${p.full_name} (@${p.telegram_username}) - Active: ${p.project_name}`));
      }
    } else {
      allGood = false;
      console.log(`  ⚠️ Table '${table}': ${res.error}`);
    }
  }

  console.log('\n----------------------------------------------------');
  if (allGood) {
    console.log('🎉 SUCCESS: Supabase is fully connected and ready for production!');
  } else {
    console.log('💡 TIP: Run the SQL script from "supabase/schema.sql" in your Supabase SQL Editor.');
  }
  console.log('----------------------------------------------------\n');
}

runCheck();
