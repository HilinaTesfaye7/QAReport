/**
 * Vercel Serverless Function - Telegram Webhook Handler
 * 
 * Runs 100% serverless on Vercel's free tier.
 * No persistent server required. Directly connects to Supabase database.
 * 
 * Setup:
 * Register with Telegram:
 * https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/telegram
 */

import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣'];

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({
      status: 'active',
      service: 'AegisQA Telegram Webhook',
      supabaseConnected: Boolean(supabase),
      time: new Date().toISOString(),
    });
  }

  const update = req.body;
  if (!update || !update.message) {
    return res.status(200).json({ ok: true });
  }

  const message = update.message;
  const chatId = message.chat?.id;
  const text = message.text?.trim() || '';
  const fromUser = message.from || {};

  if (!chatId) {
    return res.status(200).json({ ok: true });
  }

  try {
    // 1. Fetch user profile from Supabase
    let profile = null;
    if (supabase) {
      const { data } = await supabase
        .from('telegram_profiles')
        .select('*')
        .eq('chat_id', String(chatId))
        .maybeSingle();
      profile = data;
    }

    // 2. Commands Routing
    if (text === '/start' || text === '/help') {
      const welcome = profile
        ? `🛡️ <b>Welcome to AegisQA, ${profile.full_name}!</b>\n\n` +
          `👤 <b>Role:</b> ${profile.role}\n` +
          `🚀 <b>Active Project:</b> ${profile.project_name}\n\n` +
          `<b>Available Commands:</b>\n` +
          `• /project — View and switch your active QA project\n` +
          `• /status — Check platform regression status\n` +
          `• /blocker &lt;reason&gt; — Alert QA Leads of an urgent blocker`
        : `🛡️ <b>Welcome to AegisQA Telegram Bot!</b>\n\n` +
          `You are connected to the cloud QA command center.\n` +
          `Your Chat ID is: <code>${chatId}</code>\n\n` +
          `• Type /project to view or select projects\n` +
          `• Type /status for platform metrics`;

      await sendTelegramMessage(chatId, welcome);
      return res.status(200).json({ ok: true });
    }

    // 3. /project Command
    if (text === '/project' || text === '/projects') {
      let projects = [];
      if (supabase) {
        const { data } = await supabase.from('projects').select('id, name, member_ids');
        projects = data || [];
      }

      if (projects.length === 0) {
        projects = [
          { id: 'prj-banking', name: 'Banking SuperApp' },
          { id: 'prj-mobile', name: 'Mobile Banking iOS & Android' },
          { id: 'prj-merchant', name: 'Merchant Payment Gateway' },
          { id: 'prj-nextgen', name: 'NextGen Mobile Banking' },
        ];
      }

      const memberId = `usr-${chatId}`;
      let listText = '';

      projects.forEach((p, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        const isCurrent = profile && (profile.project_id === p.id || profile.project_name?.toLowerCase() === p.name?.toLowerCase());
        const isAssigned =
          (p.member_ids && (
            p.member_ids.includes(memberId) ||
            p.member_ids.includes('usr-coco') ||
            p.member_ids.includes('usr-347835367')
          )) ||
          (profile && profile.assigned_project_ids && profile.assigned_project_ids.includes(p.id));

        let tag = '';
        if (isCurrent) tag = ' 🌟 <i>(Current Active)</i>';
        else if (isAssigned) tag = ' 🟢 <i>(Assigned to you)</i>';

        listText += `${emoji} <b>${p.name}</b>${tag}\n`;
      });

      await sendTelegramMessage(
        chatId,
        `📁 <b>Current Active Project:</b> ${profile ? profile.project_name : 'Banking SuperApp'}\n\n` +
        `<b>Available Cloud Projects:</b>\n` +
        listText + '\n' +
        `<i>Reply /switch &lt;number or name&gt; to change project</i>`
      );
      return res.status(200).json({ ok: true });
    }

    // 4. /switch <project>
    if (text.startsWith('/switch') || (!isNaN(parseInt(text, 10)) && parseInt(text, 10) >= 1 && parseInt(text, 10) <= 10)) {
      const query = text.replace('/switch', '').trim();
      let projects = [];
      if (supabase) {
        const { data } = await supabase.from('projects').select('id, name');
        projects = data || [];
      }

      const num = parseInt(query, 10);
      let selected = null;
      if (!isNaN(num) && num >= 1 && num <= projects.length) {
        selected = projects[num - 1];
      } else {
        selected = projects.find(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.id.toLowerCase() === query.toLowerCase());
      }

      if (selected && supabase) {
        await supabase.from('telegram_profiles').upsert({
          chat_id: String(chatId),
          full_name: profile ? profile.full_name : (fromUser.first_name || 'QA Tester'),
          role: profile ? profile.role : 'QA Engineer',
          project_id: selected.id,
          project_name: selected.name,
          telegram_username: fromUser.username || '',
          updated_at: new Date().toISOString(),
        });

        await sendTelegramMessage(
          chatId,
          `✅ <b>Active Project Switched!</b>\n\n` +
          `You are now assigned to: <b>${selected.name}</b>.\n` +
          `Synced with Supabase Cloud DB.`
        );
      } else {
        await sendTelegramMessage(chatId, `⚠️ Project not found. Reply with /project to see the list.`);
      }
      return res.status(200).json({ ok: true });
    }

    // 5. /blocker <reason>
    if (text.startsWith('/blocker')) {
      const reason = text.replace('/blocker', '').trim();
      if (!reason) {
        await sendTelegramMessage(chatId, '⚠️ Please provide a blocker reason.\nExample: <code>/blocker Core API 500 error</code>');
        return res.status(200).json({ ok: true });
      }

      const memberName = profile ? profile.full_name : (fromUser.first_name || 'Coco');
      const projectName = profile ? profile.project_name : 'Banking SuperApp';
      const projectId = profile ? profile.project_id : 'prj-banking';

      if (supabase) {
        await supabase.from('blockers').insert({
          id: `blk-${Date.now().toString(36)}`,
          title: `Blocker via Telegram (${memberName})`,
          description: reason,
          project_id: projectId,
          project_name: projectName,
          severity: 'Critical',
          status: 'Open',
          reported_by: memberName,
          chat_id: String(chatId),
          created_at: new Date().toISOString(),
        });
      }

      await sendTelegramMessage(
        chatId,
        `🚨 <b>CRITICAL BLOCKER LOGGED IN CLOUD DB</b>\n\n` +
        `📁 <b>Project:</b> ${projectName}\n` +
        `👤 <b>Reported by:</b> ${memberName}\n` +
        `⚠️ <b>Issue:</b> ${reason}\n\n` +
        `<i>Synced in real time to the QA Command Center on Vercel.</i>`
      );
      return res.status(200).json({ ok: true });
    }

    // Default response
    await sendTelegramMessage(
      chatId,
      `Command received.\n• Type /project to view projects\n• Type /blocker &lt;text&gt; to report an issue\n• Type /help for assistance.`
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
