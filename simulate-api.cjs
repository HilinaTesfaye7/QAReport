const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://drnlgmhkzbyrwatuuesh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw');
const mockUsers = require('./api/_utils/mockUsers.js').mockUsers;

async function testApi() {
  const { data: profiles, error: profError } = await supabase.from('telegram_profiles').select('*');
  let data = mockUsers;
  if (!profError && profiles && profiles.length > 0) {
    const profileUsers = profiles.map(p => {
      const fn = p.full_name ? p.full_name.trim().split(' ')[0].toLowerCase() : '';
      return {
        id: `usr-${p.chat_id}`,
        full_name: p.full_name,
        name: p.full_name,
        username: fn,
        role: p.role || 'QA Tester',
        is_active: p.project_id && p.project_id !== 'prj-banking',
        status: (p.project_id && p.project_id !== 'prj-banking') ? 'Active' : 'Pending Assignment',
        must_change_password: true,
        telegramUsername: p.telegram_username || ''
      };
    });
    
    const existingMap = new Map(data.map(u => [u.id, u]));
    for (const pu of profileUsers) {
      if (existingMap.has(pu.id)) {
        const existing = existingMap.get(pu.id);
        if (pu.name) {
          existing.name = pu.name;
          existing.full_name = pu.full_name;
        }
      } else {
        data.push(pu);
      }
    }
  }

  data = data.map(u => {
    const safeUser = { ...u, name: u.full_name || u.name };
    delete safeUser.password_hash;
    delete safeUser.passwordHash;
    return safeUser;
  });
  
  console.log(data);
}
testApi();
