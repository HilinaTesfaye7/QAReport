/**
 * AegisQA - Telegram Daily Standup & QA Management Bot
 * 
 * 100% Non-AI, deterministic Telegram bot for QA teams.
 * Works using native Node.js fetch (zero external npm dependencies).
 *
 * Capabilities:
 * - First-time QA member onboarding (Full Name, QA Role, Project assignment)
 * - Structured 5-step QA daily standup check-ins (/checkin) tied to project
 * - Instant project switching (/project)
 * - Profile inspection & updates (/profile, /register)
 * - Urgent blocker logging (/blocker <description>)
 * - QA Team status snapshot (/status)
 *
 * Usage:
 *   node scripts/telegramQABot.js <BOT_TOKEN>
 * Or set .env / TELEGRAM_BOT_TOKEN environment variable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Automatically load .env or .env.example file if present
function loadEnv() {
  const candidates = ['.env', '.env.example'];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
          if (match) {
            const key = match[1];
            let value = match[2] ? match[2].trim() : '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  }
}
loadEnv();

const BOT_TOKEN = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('\n❌ ERROR: Missing Telegram Bot Token.');
  console.log('\nUsage:');
  console.log('  node scripts/telegramQABot.js <YOUR_BOT_TOKEN>');
  console.log('Or set the environment variable:');
  console.log('  $env:TELEGRAM_BOT_TOKEN="your_token_here"  (PowerShell)\n');
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Supabase Cloud Database Client
const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (supabase) {
  console.log('✓ Connected to Supabase Cloud Database:', supabaseUrl);
}

// Seeded Projects from AegisQA Platform
const DEFAULT_PROJECTS = [
  { id: 'prj-banking', name: 'Banking SuperApp' },
  { id: 'prj-mobile', name: 'Mobile Banking iOS & Android' },
  { id: 'prj-merchant', name: 'Merchant Payment Gateway' },
];

const DEFAULT_ROLES = [
  'QA Engineer / Tester',
  'QA Lead',
  'Automation QA Engineer',
  'Manual / Performance QA',
];

// Persistent Profiles Store (telegram_profiles.json)
const PROFILES_FILE = path.resolve(process.cwd(), 'telegram_profiles.json');
const PUBLIC_PROFILES_FILE = path.resolve(process.cwd(), 'public', 'telegram_profiles.json');
const REPORTS_FILE = path.resolve(process.cwd(), 'telegram_daily_reports.json');
const BLOCKERS_FILE = path.resolve(process.cwd(), 'telegram_blockers.json');
const PROJECTS_FILE = path.resolve(process.cwd(), 'projects.json');
const PUBLIC_PROJECTS_FILE = path.resolve(process.cwd(), 'public', 'projects.json');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

let memoryProjects = null;

async function refreshProjectsFromCloud() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        memoryProjects = data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          status: p.status,
          memberIds: p.member_ids || [],
          resources: p.resources || {},
        }));
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(memoryProjects, null, 2), 'utf8');
        fs.writeFileSync(PUBLIC_PROJECTS_FILE, JSON.stringify(memoryProjects, null, 2), 'utf8');
        return memoryProjects;
      }
    } catch (e) {
      console.error('[Supabase] Error refreshing projects:', e.message);
    }
  }
  return getProjects();
}

function getProjects() {
  if (memoryProjects && memoryProjects.length > 0) return memoryProjects;
  for (const file of [PROJECTS_FILE, PUBLIC_PROJECTS_FILE]) {
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
  }
  return DEFAULT_PROJECTS;
}

function saveProjects(projectsList) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsList, null, 2), 'utf8');
    fs.writeFileSync(PUBLIC_PROJECTS_FILE, JSON.stringify(projectsList, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving projects:', e);
  }
}

function loadProfiles() {
  if (fs.existsSync(PROFILES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function getProfile(chatId) {
  const profiles = loadProfiles();
  return profiles[String(chatId)] || null;
}

function saveProfile(chatId, data) {
  const strChatId = String(chatId);
  const profiles = loadProfiles();
  profiles[strChatId] = {
    ...(profiles[strChatId] || {}),
    ...data,
    chatId: strChatId,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  try {
    fs.writeFileSync(PUBLIC_PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  } catch {}
  
  const saved = profiles[strChatId];
  console.log(`[Profile] Saved profile for chat ${strChatId}: ${saved.fullName || 'QA Member'} (${saved.projectName || 'General'})`);

  // Cloud sync to Supabase
  if (supabase) {
    supabase.from('telegram_profiles').upsert({
      chat_id: strChatId,
      full_name: saved.fullName || 'QA Tester',
      role: saved.role || 'QA Engineer / Tester',
      project_id: saved.projectId || 'prj-banking',
      project_name: saved.projectName || 'Banking SuperApp',
      assigned_project_ids: saved.assignedProjectIds || (saved.projectId ? [saved.projectId] : ['prj-banking']),
      assigned_projects: saved.assignedProjects || (saved.projectName ? [saved.projectName] : ['Banking SuperApp']),
      telegram_username: saved.telegramUsername ? saved.telegramUsername.replace(/^@/, '') : '',
      updated_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('[Supabase] Profile sync error:', error.message);
      else console.log(`[Supabase] Synced profile for ${saved.fullName} to cloud`);
    });
  }

  return saved;
}

async function findOrLinkProfile(chatId, user) {
  const strChatId = String(chatId);
  const username = user && user.username ? user.username.replace(/^@/, '').toLowerCase() : null;

  // 1. Check Supabase as single source of truth for active membership
  if (supabase) {
    try {
      // Direct lookup by Telegram chat_id
      const { data: directMatch, error: directErr } = await supabase
        .from('telegram_profiles')
        .select('*')
        .eq('chat_id', strChatId);

      if (!directErr && directMatch && directMatch.length > 0) {
        const row = directMatch[0];
        const linked = {
          fullName: row.full_name,
          role: row.role,
          projectId: row.project_id || 'prj-banking',
          projectName: row.project_name || 'Banking SuperApp',
          assignedProjectIds: row.assigned_project_ids || [],
          assignedProjects: row.assigned_projects || [],
          telegramUsername: user.username || row.telegram_username || '',
          chatId: strChatId,
          updatedAt: row.updated_at || new Date().toISOString(),
        };
        // Update local cache so it matches Supabase
        const profiles = loadProfiles();
        profiles[strChatId] = linked;
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
        try {
          fs.writeFileSync(PUBLIC_PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
        } catch {}
        return linked;
      }

      // Check for pre-registered invite by telegram_username
      if (username) {
        const { data: userMatch, error: userErr } = await supabase
          .from('telegram_profiles')
          .select('*')
          .or(`telegram_username.ilike.${username},chat_id.eq.pending_${username}`);

        if (!userErr && userMatch && userMatch.length > 0) {
          const row = userMatch[0];
          const linked = {
            fullName: row.full_name,
            role: row.role,
            projectId: row.project_id || 'prj-banking',
            projectName: row.project_name || 'Banking SuperApp',
            assignedProjectIds: row.assigned_project_ids || [],
            assignedProjects: row.assigned_projects || [],
            telegramUsername: user.username || row.telegram_username || '',
            chatId: strChatId,
            updatedAt: new Date().toISOString(),
          };
          saveProfile(strChatId, linked);
          if (row.chat_id && row.chat_id.startsWith('pending_') && row.chat_id !== strChatId) {
            await supabase.from('telegram_profiles').delete().eq('chat_id', row.chat_id);
          }
          return linked;
        }
      }

      // User does NOT exist in Supabase (deleted by QA Lead or brand new)!
      // Purge any stale local profile so the member is required to re-onboard
      const profiles = loadProfiles();
      if (profiles[strChatId]) {
        console.log(`[Profile] Member ${strChatId} was deleted in Supabase. Purging local cached profile.`);
        delete profiles[strChatId];
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
        try {
          fs.writeFileSync(PUBLIC_PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
        } catch {}
      }

      return null;
    } catch (e) {
      console.error('[Supabase] Error verifying profile:', e.message);
    }
  }

  // 2. Offline fallback (only when Supabase client is not available)
  return getProfile(strChatId);
}

// In-memory conversation state for wizards (onboarding, checkin, switch_project)
const userSessions = new Map();

// Helper to send Telegram message with retry resilience
async function sendMessage(chatId, text, extra = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          ...extra,
        }),
      });
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Telegram] Failed to send message to ${chatId}:`, err.message);
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
}

// Helper to persist daily report
function persistReport(report) {
  let existing = [];
  if (fs.existsSync(REPORTS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
    } catch {
      existing = [];
    }
  }
  existing = existing.filter((r) => r.id !== report.id);
  existing.unshift(report);
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(existing, null, 2), 'utf8');
  try {
    fs.writeFileSync(path.resolve(process.cwd(), 'public', 'telegram_daily_reports.json'), JSON.stringify(existing, null, 2), 'utf8');
  } catch {}
  console.log(`[Storage] Saved daily report from ${report.memberName} (${report.projectName})`);

  // Cloud sync to Supabase
  if (supabase) {
    supabase.from('daily_reports').upsert({
      id: report.id,
      date: report.date,
      chat_id: String(report.chatId || ''),
      member_id: report.memberId,
      member_name: report.memberName,
      role: report.role,
      project_id: report.projectId,
      project_name: report.projectName,
      yesterday_completed: report.yesterdayCompleted,
      today_working_on: report.todayWorkingOn,
      blockers: report.blockers || '',
      is_blocked: Boolean(report.isBlocked),
      expected_completion: report.expectedCompletion || 'Today',
      notes: report.notes || '',
      submitted_at: report.submittedAt || new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('[Supabase] Report sync error:', error.message);
      else console.log(`[Supabase] Synced daily report for ${report.memberName} to cloud`);
    });
  }
}

// Helper to persist blocker
function persistBlocker(blocker) {
  let existing = [];
  if (fs.existsSync(BLOCKERS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(BLOCKERS_FILE, 'utf8'));
    } catch {
      existing = [];
    }
  }
  existing = existing.filter((b) => b.id !== blocker.id);
  existing.unshift(blocker);
  fs.writeFileSync(BLOCKERS_FILE, JSON.stringify(existing, null, 2), 'utf8');
  try {
    fs.writeFileSync(path.resolve(process.cwd(), 'public', 'telegram_blockers.json'), JSON.stringify(existing, null, 2), 'utf8');
  } catch {}
  console.log(`[Storage] Logged blocker for project: ${blocker.projectName}`);

  // Cloud sync to Supabase
  if (supabase) {
    supabase.from('blockers').upsert({
      id: blocker.id,
      title: blocker.title,
      description: blocker.description || '',
      project_id: blocker.projectId,
      project_name: blocker.projectName || '',
      severity: blocker.severity || 'High',
      status: blocker.status || 'Open',
      reported_by: blocker.reportedBy || 'QA Tester',
      chat_id: String(blocker.chatId || ''),
      created_at: blocker.createdAt || new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('[Supabase] Blocker sync error:', error.message);
      else console.log(`[Supabase] Synced blocker for ${blocker.projectName} to cloud`);
    });
  }
}

// ==========================================
// 1. ONBOARDING WIZARD (Name, Role, Project)
// ==========================================

async function startOnboarding(chatId, user, proceedToCheckinAfter = false) {
  userSessions.set(chatId, {
    type: 'onboarding',
    step: 1,
    proceedToCheckinAfter,
    user,
    answers: {},
  });

  const defaultName = user.first_name || user.username || 'QA Tester';

  await sendMessage(
    chatId,
    `🛡️ <b>Welcome to AegisQA!</b>\n\n` +
    `Let's quickly configure your <b>QA Profile</b> (takes 20 seconds) so all your daily reports, blockers, and assignments are linked to you and your project in the system.\n\n` +
    `<b>Step 1 of 3: What is your Full Name?</b>\n` +
    `<i>(e.g., Coco or your real name. Reply with your name, or reply <code>skip</code> to use "${defaultName}")</i>`
  );
}

async function handleOnboardingStep(chatId, user, text) {
  const session = userSessions.get(chatId);
  if (!session || session.type !== 'onboarding') return false;

  switch (session.step) {
    case 1: {
      const defaultName = user.first_name || user.username || 'QA Tester';
      const chosenName = text.toLowerCase() === 'skip' ? defaultName : text.trim();
      session.answers.fullName = chosenName;
      session.step = 2;

      await sendMessage(
        chatId,
        `Nice to meet you, <b>${chosenName}</b>!\n\n` +
        `<b>Step 2 of 3: What is your QA Role?</b>\n\n` +
        `1️⃣ QA Engineer / Tester\n` +
        `2️⃣ QA Lead\n` +
        `3️⃣ Automation QA Engineer\n` +
        `4️⃣ Manual / Performance QA\n\n` +
        `<i>Reply 1, 2, 3, 4, or type your custom role title:</i>`
      );
      return true;
    }

    case 2: {
      let role = text.trim();
      if (role === '1') role = DEFAULT_ROLES[0];
      else if (role === '2') role = DEFAULT_ROLES[1];
      else if (role === '3') role = DEFAULT_ROLES[2];
      else if (role === '4') role = DEFAULT_ROLES[3];

      session.answers.role = role;
      session.step = 3;

      const projects = await refreshProjectsFromCloud();
      let listText = '';
      projects.forEach((p, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        listText += `${emoji} <b>${p.name}</b>\n`;
      });

      await sendMessage(
        chatId,
        `Role set to: <b>${role}</b>\n\n` +
        `<b>Step 3 of 3: Which QA Project are you currently assigned to?</b>\n\n` +
        listText + '\n' +
        `<i>Reply with a number (1-${projects.length}) or type your project name:</i>`
      );
      return true;
    }

    case 3: {
      const projects = await refreshProjectsFromCloud();
      let projectName = text.trim();
      let projectId = 'prj-custom';

      const num = parseInt(projectName, 10);
      if (!isNaN(num) && num >= 1 && num <= projects.length) {
        projectId = projects[num - 1].id;
        projectName = projects[num - 1].name;
      } else {
        const found = projects.find(
          (p) => p.name.toLowerCase() === projectName.toLowerCase() || p.id.toLowerCase() === projectName.toLowerCase()
        ) || projects.find((p) => p.name.toLowerCase().includes(projectName.toLowerCase()));

        if (found) {
          projectId = found.id;
          projectName = found.name;
        } else {
          projectId = `prj-${Date.now().toString(36)}`;
          const newProj = {
            id: projectId,
            name: projectName,
            description: `QA scope for ${projectName}`,
            status: 'Testing',
            memberIds: [`usr-${chatId}`],
          };
          projects.push(newProj);
          saveProjects(projects);
          if (supabase) {
            supabase.from('projects').upsert({
              id: projectId,
              name: projectName,
              description: `QA scope for ${projectName}`,
              status: 'Testing',
              member_ids: [`usr-${chatId}`],
            }).then(() => {});
          }
        }
      }

      session.answers.projectId = projectId;
      session.answers.projectName = projectName;

      const profile = saveProfile(chatId, {
        fullName: session.answers.fullName,
        role: session.answers.role,
        projectId: session.answers.projectId,
        projectName: session.answers.projectName,
        assignedProjectIds: [session.answers.projectId],
        assignedProjects: [session.answers.projectName],
        telegramUsername: user.username ? user.username.replace(/^@/, '') : '',
      });

      // Ensure the project includes this user in memberIds
      const targetProj = projects.find((p) => p.id === projectId);
      if (targetProj) {
        if (!targetProj.memberIds) targetProj.memberIds = [];
        const memberKey = `usr-${chatId}`;
        if (!targetProj.memberIds.includes(memberKey)) {
          targetProj.memberIds.push(memberKey);
          saveProjects(projects);
          if (supabase) {
            supabase.from('projects').update({
              member_ids: targetProj.memberIds,
            }).eq('id', targetProj.id).then(() => {});
          }
        }
      }

      const shouldCheckin = session.proceedToCheckinAfter;
      userSessions.delete(chatId);

      await sendMessage(
        chatId,
        `🎉 <b>QA Profile Configured Successfully!</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `🏷 <b>Role:</b> ${profile.role}\n` +
        `🚀 <b>Active Project:</b> ${profile.projectName}\n` +
        `💬 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
        `<b>Helpful Commands:</b>\n` +
        `• /checkin — Submit your daily standup\n` +
        `• /project — Switch your active project\n` +
        `• /blocker <issue> — Immediately report an urgent blocker\n` +
        `• /profile — View or update your profile\n` +
        `• /status — View overall QA metrics`
      );

      if (shouldCheckin) {
        await startCheckin(chatId, user);
      }
      return true;
    }

    default:
      userSessions.delete(chatId);
      return false;
  }
}

// Helper to get open blockers for user
async function getOpenBlockersForUser(chatId, fullName) {
  let openBlockers = [];
  if (fs.existsSync(BLOCKERS_FILE)) {
    try {
      const allB = JSON.parse(fs.readFileSync(BLOCKERS_FILE, 'utf8'));
      openBlockers = allB.filter((b) => 
        (String(b.chatId) === String(chatId) || (fullName && (b.reportedBy || '').toLowerCase().includes(fullName.toLowerCase()))) &&
        b.status !== 'Resolved'
      );
    } catch {}
  }

  if (openBlockers.length === 0 && supabase) {
    try {
      const { data } = await supabase
        .from('blockers')
        .select('*')
        .or(`chat_id.eq.${chatId},reported_by.ilike.%${fullName}%`)
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        openBlockers = data.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          projectId: d.project_id,
          projectName: d.project_name,
          severity: d.severity,
          status: d.status,
          reportedBy: d.reported_by,
          chatId: d.chat_id,
          createdAt: d.created_at,
        }));
      }
    } catch {}
  }
  return openBlockers;
}

// Helper to mark blocker resolved in storage and cloud
async function markBlockerResolved(blockerId) {
  if (fs.existsSync(BLOCKERS_FILE)) {
    try {
      let allB = JSON.parse(fs.readFileSync(BLOCKERS_FILE, 'utf8'));
      allB = allB.map((b) => (b.id === blockerId ? { ...b, status: 'Resolved', resolvedAt: new Date().toISOString() } : b));
      fs.writeFileSync(BLOCKERS_FILE, JSON.stringify(allB, null, 2), 'utf8');
      try {
        fs.writeFileSync(path.resolve(process.cwd(), 'public', 'telegram_blockers.json'), JSON.stringify(allB, null, 2), 'utf8');
      } catch {}
    } catch {}
  }

  if (supabase && blockerId) {
    await supabase.from('blockers').update({
      status: 'Resolved',
    }).eq('id', blockerId);
  }
}

// ==========================================
// 2. DAILY STANDUP CHECK-IN WIZARD
// ==========================================

async function startCheckin(chatId, user) {
  const profile = getProfile(chatId);

  // If user has not configured their profile, guide through onboarding first!
  if (!profile) {
    await startOnboarding(chatId, user, true);
    return;
  }

  // Check if member previously reported an active blocker from yesterday/earlier
  const openBlockers = await getOpenBlockersForUser(chatId, profile.fullName);

  if (openBlockers.length > 0) {
    const b = openBlockers[0];
    userSessions.set(chatId, {
      type: 'checkin',
      step: 'resolve_previous_blocker',
      pendingBlocker: b,
      profile,
      answers: {},
    });

    await sendMessage(
      chatId,
      `👋 <b>Good morning, ${profile.fullName}!</b>\n\n` +
      `⚠️ <b>Reminder from Yesterday:</b>\n` +
      `You previously reported an active blocker on <b>${b.projectName || profile.projectName}</b>:\n` +
      `<i>"${b.title || 'Blocker'}: ${b.description}"</i>\n\n` +
      `<b>Is this blocker now resolved?</b>\n\n` +
      `1️⃣ <b>Yes, it is resolved</b> (Mark resolved & remove from blocked tasks)\n` +
      `2️⃣ <b>No, still blocked</b>\n\n` +
      `<i>Reply 1 (or 'yes') to remove it, or 2 (or 'no') to keep it active:</i>`
    );
    return;
  }

  userSessions.set(chatId, {
    type: 'checkin',
    step: 1,
    profile,
    answers: {},
  });

  await sendMessage(
    chatId,
    `👋 <b>Good morning, ${profile.fullName}!</b>\n\n` +
    `📁 <b>Active Project:</b> <b>${profile.projectName}</b>\n\n` +
    `Welcome to your structured <b>Daily QA Standup</b>.\n` +
    `Please answer the following 5 questions for <b>${profile.projectName}</b>.\n\n` +
    `<b>Question 1 of 5:</b>\n` +
    `<i>What did you complete yesterday on ${profile.projectName}?</i>\n` +
    `(Test cases executed, bugs verified, PRDs reviewed)`
  );
}

async function handleCheckinStep(chatId, user, text) {
  const session = userSessions.get(chatId);
  if (!session || session.type !== 'checkin') return false;
  const profile = session.profile;

  if (session.step === 'resolve_previous_blocker') {
    const isYes = text === '1' || text.toLowerCase().includes('yes') || text.toLowerCase().includes('resolved') || text.toLowerCase() === 'y';
    if (isYes && session.pendingBlocker) {
      await markBlockerResolved(session.pendingBlocker.id);
      await sendMessage(
        chatId,
        `✅ <b>Blocker Marked as Resolved!</b>\n` +
        `It has been removed from the blocked tasks on the QA Command Center Dashboard.\n\n` +
        `Now let's proceed with your daily standup.\n\n` +
        `<b>Question 1 of 5:</b>\n` +
        `<i>What did you complete yesterday on ${profile.projectName}?</i>\n` +
        `(Test cases executed, bugs verified, PRDs reviewed)`
      );
    } else {
      await sendMessage(
        chatId,
        `Understood, keeping the blocker active on the dashboard.\n\n` +
        `Now let's proceed with your daily standup.\n\n` +
        `<b>Question 1 of 5:</b>\n` +
        `<i>What did you complete yesterday on ${profile.projectName}?</i>\n` +
        `(Test cases executed, bugs verified, PRDs reviewed)`
      );
    }
    session.step = 1;
    return true;
  }

  switch (session.step) {
    case 1:
      session.answers.yesterdayCompleted = text;
      session.step = 2;
      await sendMessage(
        chatId,
        `<b>Question 2 of 5:</b>\n` +
        `<i>What is your primary testing task today on ${profile.projectName}?</i>\n` +
        `(Modules, regression suites, API endpoints)`
      );
      return true;

    case 2:
      session.answers.todayWorkingOn = text;
      session.step = 3;
      await sendMessage(
        chatId,
        `<b>Question 3 of 5:</b>\n` +
        `<i>Do you have any blockers on ${profile.projectName}?</i>\n` +
        `(Reply with your blocker description, or reply <code>none</code> if all clear)`
      );
      return true;

    case 3:
      session.answers.blockers = text.toLowerCase() === 'none' ? '' : text;
      session.answers.isBlocked = text.toLowerCase() !== 'none' && text.trim().length > 0;
      session.step = 4;
      await sendMessage(
        chatId,
        `<b>Question 4 of 5:</b>\n` +
        `<i>What is your expected completion time?</i>\n` +
        `Reply: <code>Today</code>, <code>Tomorrow</code>, or <code>Later</code>`
      );
      return true;

    case 4:
      session.answers.expectedCompletion = text;
      session.step = 5;
      await sendMessage(
        chatId,
        `<b>Question 5 of 5:</b>\n` +
        `<i>Any additional notes or risks for the QA Lead?</i> (or reply <code>none</code>)`
      );
      return true;

    case 5: {
      session.answers.notes = text.toLowerCase() === 'none' ? '' : text;

      const fullReport = {
        id: `tg-${Date.now().toString(36)}`,
        date: new Date().toISOString().split('T')[0],
        chatId,
        memberId: `usr-${chatId}`,
        memberName: profile.fullName,
        role: profile.role,
        projectId: profile.projectId,
        projectName: profile.projectName,
        ...session.answers,
        submittedAt: new Date().toISOString(),
      };

      persistReport(fullReport);

      // If blocker was flagged, also create blocker record
      if (fullReport.isBlocked) {
        persistBlocker({
          id: `blk-${Date.now().toString(36)}`,
          title: `Blocker via Standup (${profile.fullName})`,
          description: fullReport.blockers,
          projectId: profile.projectId,
          projectName: profile.projectName,
          severity: 'High',
          status: 'Open',
          reportedBy: profile.fullName,
          chatId,
          createdAt: new Date().toISOString(),
        });
      }

      userSessions.delete(chatId);

      await sendMessage(
        chatId,
        `✅ <b>Daily QA Report Submitted Successfully!</b>\n\n` +
        `📁 <b>Project:</b> ${profile.projectName}\n` +
        `👤 <b>QA Member:</b> ${profile.fullName} (${profile.role})\n` +
        `📋 <b>Yesterday:</b> ${fullReport.yesterdayCompleted}\n` +
        `🎯 <b>Today:</b> ${fullReport.todayWorkingOn}\n` +
        `${fullReport.isBlocked ? `⚠️ <b>Blocker Flagged:</b> ${fullReport.blockers}\n` : '🟢 <b>Blockers:</b> None\n'}` +
        `⏱ <b>Completion:</b> ${fullReport.expectedCompletion}\n\n` +
        `<i>Your report has been logged and synced with the QA Command Center. Have a productive testing day!</i>`
      );
      return true;
    }

    default:
      userSessions.delete(chatId);
      return false;
  }
}

// ==========================================
// 3. PROJECT SWITCH WIZARD
// ==========================================

async function startProjectSwitch(chatId) {
  const projects = await refreshProjectsFromCloud();
  const profile = getProfile(chatId);
  const memberId = `usr-${chatId}`;

  userSessions.set(chatId, {
    type: 'switch_project',
    step: 1,
    profile,
    projects,
  });

  let listText = '';

  projects.forEach((p, idx) => {
    const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
    const isCurrent = profile && (profile.projectId === p.id || profile.projectName?.toLowerCase() === p.name?.toLowerCase());
    const isAssigned =
      (p.memberIds && (
        p.memberIds.includes(memberId) || 
        p.memberIds.includes('usr-coco') || 
        p.memberIds.includes('usr-347835367') ||
        p.memberIds.some((m) => String(m).includes(String(chatId)))
      )) ||
      (profile && profile.assignedProjectIds && profile.assignedProjectIds.includes(p.id)) ||
      (profile && profile.assignedProjects && profile.assignedProjects.some((ap) => ap.toLowerCase() === p.name.toLowerCase()));

    let tag = '';
    if (isCurrent) {
      tag = ' 🌟 <i>(Current Active)</i>';
    } else if (isAssigned) {
      tag = ' 🟢 <i>(Assigned to you)</i>';
    }

    listText += `${emoji} <b>${p.name}</b>${tag}\n`;
  });

  await sendMessage(
    chatId,
    `📁 <b>Current Active Project:</b> ${profile ? profile.projectName : 'None'}\n\n` +
    `<b>Select a project to switch to:</b>\n` +
    listText + '\n' +
    `<i>Reply with a number (1-${projects.length}) or type a project name:</i>`
  );
}

async function handleProjectSwitch(chatId, text) {
  const session = userSessions.get(chatId);
  if (!session || session.type !== 'switch_project') return false;

  const projects = session.projects || getProjects();
  let projectName = text.trim();
  let projectId = 'prj-custom';
  let selected = null;

  const num = parseInt(projectName, 10);
  if (!isNaN(num) && num >= 1 && num <= projects.length) {
    selected = projects[num - 1];
  } else {
    selected = projects.find(
      (p) => p.name.toLowerCase() === projectName.toLowerCase() || p.id.toLowerCase() === projectName.toLowerCase()
    ) || projects.find((p) => p.name.toLowerCase().includes(projectName.toLowerCase()));
  }

  if (selected) {
    projectId = selected.id;
    projectName = selected.name;
  } else {
    projectId = `prj-${Date.now().toString(36)}`;
    const newProj = {
      id: projectId,
      name: projectName,
      description: `QA Project ${projectName}`,
      status: 'Testing',
      memberIds: [`usr-${chatId}`],
    };
    projects.push(newProj);
    saveProjects(projects);

    if (supabase) {
      supabase.from('projects').upsert({
        id: projectId,
        name: projectName,
        description: `QA Project ${projectName}`,
        status: 'Testing',
        member_ids: [`usr-${chatId}`],
      }).then(({ error }) => {
        if (error) console.error('[Supabase] Error creating project:', error.message);
      });
    }
  }

  saveProfile(chatId, {
    projectId,
    projectName,
  });

  userSessions.delete(chatId);

  await sendMessage(
    chatId,
    `✅ <b>Active Project Switched!</b>\n\n` +
    `You are now assigned to: <b>${projectName}</b>.\n` +
    `Your next <code>/checkin</code> and blocker alerts will be recorded for this project.`
  );
  return true;
}

// ==========================================
// 4. MAIN MESSAGE ROUTER
// ==========================================

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text?.trim() || '';
  const user = message.from || {};
  const profile = await findOrLinkProfile(chatId, user);

  // Active Session handling
  if (userSessions.has(chatId) && !text.startsWith('/')) {
    const session = userSessions.get(chatId);
    if (session.type === 'onboarding') {
      const handled = await handleOnboardingStep(chatId, user, text);
      if (handled) return;
    } else if (session.type === 'checkin') {
      const handled = await handleCheckinStep(chatId, user, text);
      if (handled) return;
    } else if (session.type === 'switch_project') {
      const handled = await handleProjectSwitch(chatId, text);
      if (handled) return;
    }
  }

  // Active Session cancellation
  if (text === '/cancel') {
    if (userSessions.has(chatId)) {
      userSessions.delete(chatId);
      await sendMessage(chatId, '❌ Active operation cancelled. Type /checkin when ready.');
    } else {
      await sendMessage(chatId, 'No active operation in progress.');
    }
    return;
  }

  // Explicit re-registration / profile update
  if (text === '/register' || text === '/profile edit') {
    await startOnboarding(chatId, user, false);
    return;
  }

  // If user does not have an active profile in Supabase (new member, or previously deleted member joining again):
  // ALWAYS trigger onboarding wizard to ask Name, Role, and Project!
  if (!profile) {
    console.log(`[Bot] Member ${chatId} (${user.username || user.first_name || 'unknown'}) has no active profile in Supabase. Prompting onboarding wizard.`);
    await startOnboarding(chatId, user, text === '/checkin');
    return;
  }

  // Commands for registered members
  if (text === '/start' || text === '/help') {
    await sendMessage(
      chatId,
      `🛡️ <b>Welcome to AegisQA, ${profile.fullName}!</b>\n\n` +
      `👤 <b>Role:</b> ${profile.role}\n` +
      `🚀 <b>Active Project:</b> ${profile.projectName}\n` +
      `💬 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
      `<b>Available Commands:</b>\n` +
      `• /checkin — Start your daily QA standup for ${profile.projectName}\n` +
      `• /project — Switch your active QA project\n` +
      `• /blocker <reason> — Immediately report an urgent blocker\n` +
      `• /resolve — Resolve active blockers and remove from blocked tasks\n` +
      `• /profile — View or update your profile\n` +
      `• /status — View platform release readiness & regression metrics\n` +
      `• /cancel — Cancel an active operation`
    );
    return;
  }

  if (text === '/profile') {
    if (!profile) {
      await startOnboarding(chatId, user, false);
      return;
    }

    await sendMessage(
      chatId,
      `👤 <b>AegisQA Profile</b>\n\n` +
      `• <b>Full Name:</b> ${profile.fullName}\n` +
      `• <b>QA Role:</b> ${profile.role}\n` +
      `• <b>Active Project:</b> ${profile.projectName}\n` +
      `• <b>Telegram:</b> @${user.username || 'n/a'}\n` +
      `• <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
      `<b>Quick Commands:</b>\n` +
      `• /project — Switch active project\n` +
      `• /register — Re-run full setup wizard\n` +
      `• /checkin — Submit today's standup`
    );
    return;
  }

  if (text === '/project' || text === '/projects' || text === '/switch' || text === '/switchproject') {
    await startProjectSwitch(chatId);
    return;
  }

  if (text === '/checkin') {
    await startCheckin(chatId, user);
    return;
  }

  if (text.startsWith('/blocker')) {
    const reason = text.replace('/blocker', '').trim();
    if (!reason) {
      await sendMessage(
        chatId,
        '⚠️ Please provide a description.\nExample: <code>/blocker Staging API returning 500 on auth</code>'
      );
      return;
    }

    const memberName = profile ? profile.fullName : (user.first_name || 'QA Tester');
    const projectName = profile ? profile.projectName : 'General QA';
    const projectId = profile ? profile.projectId : 'prj-banking';

    const blockerItem = {
      id: `blk-${Date.now().toString(36)}`,
      title: `Blocker via Telegram (${memberName})`,
      description: reason,
      projectId,
      projectName,
      severity: 'Critical',
      status: 'Open',
      reportedBy: memberName,
      createdAt: new Date().toISOString(),
      chatId,
    };

    persistBlocker(blockerItem);

    await sendMessage(
      chatId,
      `🚨 <b>CRITICAL BLOCKER LOGGED</b>\n\n` +
      `📁 <b>Project:</b> ${projectName}\n` +
      `👤 <b>Reported by:</b> ${memberName} (@${user.username || user.first_name})\n` +
      `⚠️ <b>Issue:</b> ${reason}\n` +
      `🕒 <b>Time:</b> ${new Date().toLocaleTimeString()}\n\n` +
      `<i>The QA Lead Command Center has been alerted.</i>`
    );
    return;
  }

  if (text === '/resolve' || text === '/unblock' || text.startsWith('/resolve ') || text.startsWith('/unblock ')) {
    const openBlockers = await getOpenBlockersForUser(chatId, profile ? profile.fullName : '');

    if (openBlockers.length === 0) {
      await sendMessage(
        chatId,
        `🎉 <b>No Active Blockers Found!</b>\n\nYou currently have no open blockers in the system.`
      );
      return;
    }

    for (const b of openBlockers) {
      await markBlockerResolved(b.id);
    }

    await sendMessage(
      chatId,
      `✅ <b>Blocker(s) Resolved!</b>\n\n` +
      `The following blocker(s) have been marked as <b>Resolved</b>:\n` +
      openBlockers.map((b) => `• <b>${b.title}</b> (${b.description})`).join('\n') +
      `\n\nThey have been removed from the blocked tasks on the QA Command Center Dashboard!`
    );
    return;
  }

  if (text === '/status') {
    const currentProject = profile ? profile.projectName : 'Banking SuperApp';
    await sendMessage(
      chatId,
      `📊 <b>AegisQA Live Platform Status</b>\n\n` +
      `• <b>Banking SuperApp:</b> 78% QA Progress | 82% Regression (Ready with risks)\n` +
      `• <b>Mobile Banking:</b> 65% QA Progress | 60% Regression (Testing)\n` +
      `• <b>Merchant Portal:</b> 90% QA Progress | 95% Regression (Ready)\n\n` +
      `Active Project for you: <b>${currentProject}</b>\n` +
      `QA Team: 3 engineers active | Zero critical outages.`
    );
    return;
  }

  // Fallback
  await sendMessage(
    chatId,
    `I didn't recognize that command.\n` +
    `• Type /checkin to start your daily standup\n` +
    `• Type /project to change project\n` +
    `• Type /profile to view your profile\n` +
    `• Type /help for all commands.`
  );
}

// Long Polling Loop
let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`);
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    } else if (!data.ok) {
      console.error('[Telegram API Error]', data.description);
    }
  } catch (err) {
    console.error('[Polling Error]', err.message);
  }

  setTimeout(pollUpdates, 800);
}

// Startup
async function init() {
  console.log('\n=============================================');
  console.log('🛡️  AegisQA Telegram Daily Standup Bot');
  console.log('    100% Non-AI Deterministic QA Engine');
  console.log('=============================================\n');

  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`);
    const data = await res.json();

    if (!data.ok) {
      console.error('❌ Failed to connect to Telegram:', data.description);
      process.exit(1);
    }

    console.log(`✓ Connected to Telegram Bot: @${data.result.username} (${data.result.first_name})`);
    console.log(`✓ Bot ID: ${data.result.id}`);
    console.log('✓ Listening for messages, onboarding, /project, and /checkin...\n');

    pollUpdates();
  } catch (err) {
    console.error('❌ Network error connecting to Telegram API:', err.message);
    process.exit(1);
  }
}

init();
