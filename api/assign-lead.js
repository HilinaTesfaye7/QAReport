import { requireAuth, supabase } from './_utils/auth.js';

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

async function assignLeadHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.user.role !== 'QA Director') {
    return res.status(403).json({ error: 'Only QA Director can assign leads' });
  }

  const { telegramChatId, mainProjectName } = req.body;
  if (!telegramChatId || !mainProjectName) {
    return res.status(400).json({ error: 'telegramChatId and mainProjectName are required' });
  }

  try {
    // 1. Fetch telegram profile
    const { data: profiles, error: profError } = await supabase
      .from('telegram_profiles')
      .select('*')
      .eq('chat_id', String(telegramChatId))
      .limit(1);

    if (profError || !profiles || profiles.length === 0) {
      return res.status(404).json({ error: 'Telegram profile not found' });
    }

    const profile = profiles[0];

    // 2. Generate credentials
    const baseUsername = (profile.telegram_username || profile.full_name || `lead_${telegramChatId}`)
      .toLowerCase().replace(/[^a-z0-9]/g, '');
    const tempUsername = `${baseUsername}.lead${Math.floor(Math.random() * 1000)}`;
    const tempPassword = `Aegis${Math.floor(Math.random() * 10000)}!`;

    const bcrypt = await import('bcryptjs');
    const password_hash = await bcrypt.default.hash(tempPassword, 10);

    // 3. Update users table (Web portal access)
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

    // 4. Update telegram profile status
    await supabase.from('telegram_profiles').update({
      status: 'Active',
      updated_at: new Date().toISOString()
    }).eq('chat_id', String(telegramChatId));

    // 5. Send Telegram message
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

export default (req, res) => requireAuth(req, res, assignLeadHandler);
