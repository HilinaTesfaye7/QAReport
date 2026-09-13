import { requireAuth, supabase } from './_utils/auth.js';
import { getMockUsers, getMockProjects } from './_utils/db.js';

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN ||
  '8976092354:AAGROrwSrscf27zGsH5zRaXv2OCSwES8CA8';

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send telegram message:', err);
    return false;
  }
}

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
      }

      // Load telegram profiles and merge them in
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
            is_active: p.project_id && p.project_id !== 'prj-banking',
            status: (p.project_id && p.project_id !== 'prj-banking') ? 'Active' : 'Pending Assignment',
            must_change_password: true,
            telegramUsername: p.telegram_username || ''
          };
        });
        
        // Merge avoiding duplicates by ID, but update status and name if pending
        const existingMap = new Map(data.map(u => [u.id, u]));
        for (const pu of profileUsers) {
          if (existingMap.has(pu.id)) {
            const existing = existingMap.get(pu.id);
            // Always take the most recent name from telegram
            if (pu.name) {
              existing.name = pu.name;
              existing.full_name = pu.full_name;
            }
            // If they just registered, they are 'Pending Assignment' in Telegram.
            // But if they are ALREADY in users table, they have been assigned. Do not overwrite.
          } else {
            data.push(pu);
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
      return res.status(403).json({ error: 'Only QA Director can perform this action' });
    }

    if (req.query.action === 'assign-lead') {
      const { telegramChatId, mainProjectName, mainProjectId } = req.body;
      if (!telegramChatId || !mainProjectName || !mainProjectId) {
        return res.status(400).json({ error: 'telegramChatId, mainProjectName, and mainProjectId are required' });
      }

      try {
        const { data: profiles, error: profError } = await supabase
          .from('telegram_profiles')
          .select('*')
          .eq('chat_id', String(telegramChatId))
          .limit(1);

        if (profError || !profiles || profiles.length === 0) {
          return res.status(404).json({ error: 'Telegram profile not found' });
        }

        const profile = profiles[0];

        const baseUsername = (profile.telegram_username || profile.full_name || `lead_${telegramChatId}`)
          .toLowerCase().replace(/[^a-z0-9]/g, '');
        const tempUsername = `${baseUsername}.lead${Math.floor(Math.random() * 1000)}`;
        const tempPassword = `Aegis${Math.floor(Math.random() * 10000)}!`;

        const bcrypt = await import('bcryptjs');
        const password_hash = await bcrypt.default.hash(tempPassword, 10);

        const newUserWeb = {
          id: `usr-${telegramChatId}`,
          full_name: profile.full_name,
          username: tempUsername,
          password_hash: password_hash,
          role: 'QA Lead',
          is_active: true,
          must_change_password: true,
          telegram_chat_id: String(telegramChatId),
          telegram_username: profile.telegram_username || ''
        };
        
        await supabase.from('users').upsert([newUserWeb]);

        await supabase.from('telegram_profiles').update({
          project_id: mainProjectId,
          project_name: mainProjectName,
          updated_at: new Date().toISOString()
        }).eq('chat_id', String(telegramChatId));

        const portalUrl = req.headers.origin || process.env.VITE_APP_URL || 'https://aegisqa.vercel.app';
        const message = `🎉 <b>Profile Configured Successfully!</b>\n\n` +
          `You have been registered as a <b>QA Lead of "${mainProjectName}"</b>.\n\n` +
          `Here are your AegisQA Portal credentials:\n\n` +
          `👤 <b>Username:</b> <code>${tempUsername}</code>\n` +
          `🔑 <b>Temporary Password:</b> <code>${tempPassword}</code>\n\n` +
          `🌐 <b>Login:</b> ${portalUrl}\n\n` +
          `<b>Note:</b> You will be required to change your temporary password on your first login for security.`;

        await sendTelegramMessage(telegramChatId, message);
        return res.status(200).json({ success: true, user: newUserWeb });

      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
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

  if (req.method === 'DELETE') {
    if (req.user.role !== 'QA Director') {
      return res.status(403).json({ error: 'Only QA Director can delete users' });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    try {
      // 1. Deactivate in users table
      await supabase.from('users').update({ is_active: false }).eq('id', String(id));

      // 2. If it is a telegram-linked user (usr-<chatId>), remove from telegram_profiles
      if (String(id).startsWith('usr-')) {
        const chatId = String(id).replace('usr-', '');
        await supabase.from('telegram_profiles').delete().eq('chat_id', chatId);
      }

      return res.status(200).json({ success: true, message: 'User deactivated successfully' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default (req, res) => requireAuth(req, res, usersHandler);
