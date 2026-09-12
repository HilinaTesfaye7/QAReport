import { requireAuth, supabase } from './_utils/auth.js';
import { getMockUsers, getMockProjects } from './_utils/db.js';

async function usersHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      let data = [];
      const { data: supabaseData, error } = await supabase.from('users').select('*');

      if (!error && supabaseData && supabaseData.length > 0) {
        data = supabaseData;
      } else {
        data = getMockUsers();
        // Fallback: load telegram profiles and merge them in
        const { data: profiles, error: profError } = await supabase.from('telegram_profiles').select('*');
        if (!profError && profiles && profiles.length > 0) {
          const profileUsers = profiles.map(p => {
            const fn = p.full_name ? p.full_name.trim().split(' ')[0].toLowerCase() : '';
            return {
              id: `usr-${p.chat_id}`,
              full_name: p.full_name,
              name: p.full_name,
              username: fn,
              role: p.role || 'QA Tester',
              is_active: true,
              must_change_password: true
            };
          });
          
          // Merge avoiding duplicates by ID
          const existingIds = new Set(data.map(u => u.id));
          for (const pu of profileUsers) {
            if (!existingIds.has(pu.id)) {
              data.push(pu);
            }
          }
        }
      }

      // Remove sensitive fields (password_hash) and map full_name to name
      data = data.map(u => {
        const safeUser = { ...u, name: u.full_name || u.name };
        delete safeUser.password_hash;
        delete safeUser.passwordHash;
        return safeUser;
      });

      if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
        data = data.filter(u => u.id === req.user.id);
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    if (req.user.role !== 'QA Director') {
      return res.status(403).json({ error: 'Only QA Director can create users' });
    }
    
    try {
      const { full_name, username, password, role, is_active, must_change_password } = req.body;
      const bcrypt = await import('bcryptjs');
      const password_hash = await bcrypt.default.hash(password, 10);
      
      const newUser = {
        id: `usr-${Date.now()}`,
        full_name,
        username,
        password_hash,
        role,
        is_active,
        must_change_password
      };
      
      const { data, error } = await supabase.from('users').insert([newUser]).select();
      
      if (error) {
        return res.status(200).json(newUser);
      }
      return res.status(200).json(data[0] || newUser);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default (req, res) => requireAuth(req, res, usersHandler);
