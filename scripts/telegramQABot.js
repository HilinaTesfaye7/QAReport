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

  if (saved && saved.role) {
    syncTelegramCommands(strChatId, saved.role).catch(() => {});
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

// Helper to escape HTML characters in dynamic user inputs
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Strip HTML tags for fallback
function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '');
}

// Helper to send Telegram message with retry resilience and entity parse error fallback
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
      const data = await res.json();
      if (data.ok) {
        return data;
      }

      console.warn(`[Telegram API Warning] sendMessage HTML rejected for ${chatId}:`, data.description);

      // If Telegram rejects HTML entities (e.g. unsupported start tag or unescaped characters), immediately fallback to plain text!
      if (data.description && (data.description.includes('parse entities') || data.description.includes('tag'))) {
        console.log(`[Telegram Fallback] Retrying plain-text delivery to ${chatId}...`);
        const fallbackRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: stripHtml(text),
            ...extra,
          }),
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.ok) {
          console.log(`[Telegram Fallback] Successfully delivered plain-text message to ${chatId}`);
          return fallbackData;
        } else {
          console.error(`[Telegram Fallback Error]`, fallbackData.description);
        }
      }
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Telegram] Network failed to send message to ${chatId}:`, err.message);
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

// Helper to look up QA Leads registered in local store or Supabase
async function findQALeadsForProject(projectId, projectName) {
  const leads = new Map();

  // 1. Local profiles (telegram_profiles.json)
  const profiles = loadProfiles();
  for (const [cId, prof] of Object.entries(profiles)) {
    if (isQALead(prof) && cId) {
      leads.set(String(cId), {
        chatId: String(cId),
        fullName: prof.fullName || 'QA Lead',
        role: prof.role || 'QA Lead',
        projectId: prof.projectId || '',
        projectName: prof.projectName || '',
        assignedProjectIds: prof.assignedProjectIds || [],
        assignedProjects: prof.assignedProjects || [],
      });
    }
  }

  // 2. Supabase cloud profiles
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('telegram_profiles')
        .select('*');
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (isQALead(row) && row.chat_id) {
            const strChatId = String(row.chat_id);
            if (!leads.has(strChatId)) {
              leads.set(strChatId, {
                chatId: strChatId,
                fullName: row.full_name || 'QA Lead',
                role: row.role || 'QA Lead',
                projectId: row.project_id || '',
                projectName: row.project_name || '',
                assignedProjectIds: row.assigned_project_ids || [],
                assignedProjects: row.assigned_projects || [],
              });
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const allLeads = Array.from(leads.values());
  if (allLeads.length === 0) return [];

  const pId = projectId ? String(projectId).toLowerCase() : '';
  const pName = projectName ? String(projectName).toLowerCase() : '';

  const matchedLeads = allLeads.filter((lead) => {
    if (!pId && !pName) return true;
    const lPId = lead.projectId ? String(lead.projectId).toLowerCase() : '';
    const lPName = lead.projectName ? String(lead.projectName).toLowerCase() : '';
    const assignedIds = (lead.assignedProjectIds || []).map((x) => String(x).toLowerCase());
    const assignedNames = (lead.assignedProjects || []).map((x) => String(x).toLowerCase());

    return (
      (pId && lPId === pId) ||
      (pName && lPName === pName) ||
      (pId && assignedIds.includes(pId)) ||
      (pName && assignedNames.includes(pName))
    );
  });

  return matchedLeads.length > 0 ? matchedLeads : allLeads;
}

// Proactive Telegram Alert to QA Lead when a blocker is filed via /blocker
async function notifyQALeadsOfBlocker({
  senderChatId,
  memberName,
  username,
  projectName,
  projectId,
  reason,
  severity = 'Critical',
  createdAt,
}) {
  try {
    const leads = await findQALeadsForProject(projectId, projectName);
    const targetLeads = leads.filter((l) => String(l.chatId) !== String(senderChatId));

    if (targetLeads.length === 0) {
      console.log(`[Notification] No QA Leads to notify for blocker on ${projectName}`);
      return;
    }

    const timeStr = new Date(createdAt || Date.now()).toLocaleTimeString();
    let msg = `🚨 <b>QA LEAD ALERT — URGENT BLOCKER FILED</b>\n\n`;
    msg += `📁 <b>Project:</b> <b>${escapeHtml(projectName)}</b>\n`;
    msg += `👤 <b>Reported by:</b> <b>${escapeHtml(memberName)}</b> (@${escapeHtml(username || 'unknown')})\n`;
    msg += `⚠️ <b>Severity:</b> <b>${escapeHtml(severity)}</b>\n`;
    msg += `🕒 <b>Time:</b> <code>${escapeHtml(timeStr)}</code>\n\n`;
    msg += `🚨 <b>Blocker Issue:</b>\n`;
    msg += `<i>"${escapeHtml(reason)}"</i>\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 <b>Quick Lead Actions:</b>\n`;
    msg += `• View status: <code>/status</code>\n`;
    msg += `• Resolve blocker: <code>/resolve</code>\n`;
    msg += `• View risks: <code>/risks</code>`;

    for (const lead of targetLeads) {
      console.log(`[Notification] Dispatching Blocker alert to QA Lead ${lead.fullName} (${lead.chatId})...`);
      await sendMessage(lead.chatId, msg);
    }
  } catch (err) {
    console.error('[Notification Error] Blocker notification failed:', err.message);
  }
}

// Proactive Telegram Alert to QA Lead when a blocker is resolved
async function notifyQALeadsOfBlockerResolved({
  senderChatId,
  memberName,
  username,
  projectName,
  projectId,
  resolvedBlockers = [],
  resolvedAt,
}) {
  try {
    const leads = await findQALeadsForProject(projectId, projectName);
    const targetLeads = leads.filter((l) => String(l.chatId) !== String(senderChatId));

    if (targetLeads.length === 0) {
      console.log(`[Notification] No QA Leads to notify for resolved blocker on ${projectName}`);
      return;
    }

    const timeStr = new Date(resolvedAt || Date.now()).toLocaleTimeString();
    let msg = `✅ <b>QA LEAD ALERT — BLOCKER RESOLVED</b>\n\n`;
    msg += `📁 <b>Project:</b> <b>${escapeHtml(projectName || 'QA Project')}</b>\n`;
    msg += `👤 <b>Resolved by:</b> <b>${escapeHtml(memberName)}</b> (@${escapeHtml(username || 'unknown')})\n`;
    msg += `🛡️ <b>Status:</b> <b>Resolved</b>\n`;
    msg += `🕒 <b>Time:</b> <code>${escapeHtml(timeStr)}</code>\n\n`;

    msg += `✅ <b>Resolved Blocker(s):</b>\n`;
    if (resolvedBlockers.length > 0) {
      resolvedBlockers.forEach((b, i) => {
        msg += `${i + 1}. <b>${escapeHtml(b.title || 'Blocker')}</b>\n`;
        if (b.description && b.description !== b.title) {
          msg += `   <i>"${escapeHtml(b.description)}"</i>\n`;
        }
      });
    } else {
      msg += `• Blocker issue marked as resolved.\n`;
    }
    msg += `\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 <b>Quick Lead Actions:</b>\n`;
    msg += `• View updated status: <code>/status</code>\n`;
    msg += `• Team progress: <code>/team</code>\n`;
    msg += `• Project risks: <code>/risks</code>`;

    for (const lead of targetLeads) {
      console.log(`[Notification] Dispatching Blocker Resolved alert to QA Lead ${lead.fullName} (${lead.chatId})...`);
      await sendMessage(lead.chatId, msg);
    }
  } catch (err) {
    console.error('[Notification Error] Blocker resolved notification failed:', err.message);
  }
}

// Proactive Telegram Alert to QA Lead when a member mentions a Blocker, Risk, or Critical Bug in Standup
async function notifyQALeadsOfStandupIssue({
  senderChatId,
  profile,
  workStatus,
  statusEmoji,
  todayWorkingOn,
  blockersText,
  risksText,
  bugsSummary,
  hasBlocker,
  hasRisk,
  hasCriticalBugs,
}) {
  try {
    const leads = await findQALeadsForProject(profile.projectId, profile.projectName);
    const targetLeads = leads.filter((l) => String(l.chatId) !== String(senderChatId));

    if (targetLeads.length === 0) {
      console.log(`[Notification] No QA Leads to notify for standup issue on ${profile.projectName}`);
      return;
    }

    let alertHeader = `🚨 <b>QA LEAD ALERT — URGENT BLOCKER IN STANDUP</b>`;
    if (!hasBlocker && hasRisk) {
      alertHeader = `⚠️ <b>QA LEAD ALERT — QA RISK REPORTED IN STANDUP</b>`;
    } else if (!hasBlocker && hasCriticalBugs) {
      alertHeader = `🐞 <b>QA LEAD ALERT — CRITICAL BUG REPORTED IN STANDUP</b>`;
    }

    let msg = `${alertHeader}\n\n`;
    msg += `📁 <b>Project:</b> <b>${escapeHtml(profile.projectName)}</b>\n`;
    msg += `👤 <b>QA Member:</b> <b>${escapeHtml(profile.fullName)}</b> (${escapeHtml(profile.role || 'Tester')})\n`;
    msg += `📈 <b>Status:</b> <b>${statusEmoji} ${escapeHtml(workStatus)}</b>\n\n`;

    if (todayWorkingOn) {
      msg += `🎯 <b>Today's Task:</b>\n${escapeHtml(todayWorkingOn)}\n\n`;
    }

    if (hasBlocker) {
      const bText = (blockersText && blockersText !== 'None')
        ? blockersText
        : `Member marked work status as ${statusEmoji} ${workStatus}.`;
      msg += `🚨 <b>Blocker Details:</b>\n<i>"${escapeHtml(bText)}"</i>\n\n`;
    }

    if (hasRisk && risksText && risksText !== 'None') {
      msg += `⚠️ <b>Risk Details:</b>\n<i>"${escapeHtml(risksText)}"</i>\n\n`;
    }

    if (bugsSummary && bugsSummary !== 'None') {
      msg += `🐞 <b>Bugs Found:</b>\n${escapeHtml(bugsSummary)}\n\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 <b>Quick Lead Actions:</b>\n`;
    msg += `• View team status: <code>/status</code>\n`;
    msg += `• Team progress: <code>/team</code>\n`;
    if (hasBlocker) msg += `• Resolve blocker: <code>/resolve</code>\n`;
    if (hasRisk) msg += `• Project risks: <code>/risks</code>\n`;

    for (const lead of targetLeads) {
      console.log(`[Notification] Dispatching Standup alert to QA Lead ${lead.fullName} (${lead.chatId})...`);
      await sendMessage(lead.chatId, msg);
    }
  } catch (err) {
    console.error('[Notification Error] Standup issue notification failed:', err.message);
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
        `👤 <b>Name:</b> ${escapeHtml(profile.fullName)}\n` +
        `🏷 <b>Role:</b> ${escapeHtml(profile.role)}\n` +
        `🚀 <b>Active Project:</b> ${escapeHtml(profile.projectName)}\n` +
        `💬 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
        `<b>Helpful Commands:</b>\n` +
        `• /checkin — Submit your daily standup\n` +
        `• /project — Switch your active project\n` +
        `• /blocker &lt;issue&gt; — Immediately report an urgent blocker\n` +
        `• /resolve — Resolve active blockers\n` +
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

// Check if user has QA Lead role
function isQALead(profile) {
  if (!profile || !profile.role) return false;
  const r = String(profile.role).toLowerCase();
  return r.includes('lead') || r.includes('manager') || r === 'qa_lead' || r === 'admin';
}

// Parse bug count inputs by severity
function parseBugCounts(input) {
  if (!input || typeof input !== 'string') {
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
      summary: 'None',
    };
  }

  const text = input.trim();
  const lower = text.toLowerCase();

  if (lower === 'none' || lower === '0' || lower === 'no' || lower === 'no bugs' || lower === 'clear' || lower === 'zero') {
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
      summary: 'None',
    };
  }

  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  // Check for comma or space separated 4 numbers e.g. "0, 2, 1, 0" or "0 2 1 0"
  const commaNums = text.split(/[,/ ]+/).map((s) => s.trim()).filter(Boolean);
  if (commaNums.length === 4 && commaNums.every((n) => !isNaN(parseInt(n, 10)))) {
    critical = parseInt(commaNums[0], 10) || 0;
    high = parseInt(commaNums[1], 10) || 0;
    medium = parseInt(commaNums[2], 10) || 0;
    low = parseInt(commaNums[3], 10) || 0;
  } else {
    // Regex matching severity keywords
    const critMatch = lower.match(/(\d+)\s*(?:crit|critical)/i) || lower.match(/(?:crit|critical)[\s:]*(\d+)/i);
    const highMatch = lower.match(/(\d+)\s*(?:high)/i) || lower.match(/(?:high)[\s:]*(\d+)/i);
    const medMatch = lower.match(/(\d+)\s*(?:med|medium)/i) || lower.match(/(?:med|medium)[\s:]*(\d+)/i);
    const lowMatch = lower.match(/(\d+)\s*(?:low)/i) || lower.match(/(?:low)[\s:]*(\d+)/i);

    if (critMatch) critical = parseInt(critMatch[1], 10) || 0;
    if (highMatch) high = parseInt(highMatch[1], 10) || 0;
    if (medMatch) medium = parseInt(medMatch[1], 10) || 0;
    if (lowMatch) low = parseInt(lowMatch[1], 10) || 0;

    // If none of the severity keywords matched, but user typed a single number like "3"
    if (!critMatch && !highMatch && !medMatch && !lowMatch) {
      const singleNum = parseInt(text.match(/\d+/)?.[0] || '0', 10);
      if (singleNum > 0) {
        medium = singleNum;
      }
    }
  }

  const total = critical + high + medium + low;
  const parts = [];
  if (critical > 0) parts.push(`${critical} Critical`);
  if (high > 0) parts.push(`${high} High`);
  if (medium > 0) parts.push(`${medium} Medium`);
  if (low > 0) parts.push(`${low} Low`);

  const summary = parts.length > 0 ? parts.join('\n') : (total > 0 ? `${total} Bugs` : text);

  return {
    critical,
    high,
    medium,
    low,
    total: total || (summary !== 'None' ? 1 : 0),
    summary,
  };
}

// Fetch all daily reports from cloud DB and local storage
async function fetchDailyReports(filterProjectId = null) {
  let reports = [];

  // 1. Fetch from Supabase
  if (supabase) {
    try {
      let query = supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false });
      if (filterProjectId) {
        query = query.eq('project_id', filterProjectId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        reports = data.map((r) => {
          let workStatus = r.is_blocked ? 'Blocked' : 'On Track';
          let statusEmoji = r.is_blocked ? '🔴' : '🟢';
          let bugsSummary = 'None';
          let bugsFound = { critical: 0, high: 0, medium: 0, low: 0, total: 0, summary: 'None' };
          let risks = 'None';

          if (r.expected_completion) {
            if (r.expected_completion.includes('Blocked')) {
              workStatus = 'Blocked';
              statusEmoji = '🔴';
            } else if (r.expected_completion.includes('Risk') || r.expected_completion.includes('At Risk')) {
              workStatus = 'At Risk';
              statusEmoji = '🟡';
            } else if (r.expected_completion.includes('Track') || r.expected_completion.includes('On Track')) {
              workStatus = 'On Track';
              statusEmoji = '🟢';
            }
          }

          if (r.notes) {
            try {
              const parsed = JSON.parse(r.notes);
              if (parsed.workStatus) workStatus = parsed.workStatus;
              if (parsed.statusEmoji) statusEmoji = parsed.statusEmoji;
              if (parsed.bugsSummary) bugsSummary = parsed.bugsSummary;
              if (parsed.bugsBreakdown) bugsFound = parsed.bugsBreakdown;
              if (parsed.risks) risks = parsed.risks;
            } catch {}
          }

          return {
            id: r.id,
            date: r.date,
            chatId: r.chat_id,
            memberId: r.member_id,
            memberName: r.member_name,
            role: r.role,
            projectId: r.project_id,
            projectName: r.project_name,
            yesterdayCompleted: r.yesterday_completed,
            todayWorkingOn: r.today_working_on,
            workStatus,
            statusEmoji,
            bugsFound,
            bugsSummary,
            blockers: r.blockers || '',
            isBlocked: Boolean(r.is_blocked || workStatus === 'Blocked'),
            risks,
            expectedCompletion: r.expected_completion || `${statusEmoji} ${workStatus}`,
            notes: r.notes || '',
            submittedAt: r.submitted_at,
          };
        });
      }
    } catch (e) {
      console.error('[Supabase] Error fetching daily reports:', e.message);
    }
  }

  // 2. Supplement / fallback with local file
  if (fs.existsSync(REPORTS_FILE)) {
    try {
      const local = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
      if (Array.isArray(local) && local.length > 0) {
        const existingIds = new Set(reports.map((r) => r.id));
        for (const lr of local) {
          if (!existingIds.has(lr.id)) {
            if (!filterProjectId || lr.projectId === filterProjectId) {
              reports.push({
                ...lr,
                workStatus: lr.workStatus || (lr.isBlocked ? 'Blocked' : 'On Track'),
                statusEmoji: lr.statusEmoji || (lr.isBlocked ? '🔴' : '🟢'),
                bugsSummary: lr.bugsSummary || lr.bugsFound?.summary || 'None',
                risks: lr.risks || 'None',
              });
              existingIds.add(lr.id);
            }
          }
        }
      }
    } catch {}
  }

  return reports;
}

// Fetch active project blockers
async function fetchProjectBlockers(filterProjectId = null, filterProjectName = null) {
  let blockers = [];

  if (supabase) {
    try {
      let query = supabase.from('blockers').select('*').neq('status', 'Resolved').order('created_at', { ascending: false });
      if (filterProjectId) {
        query = query.eq('project_id', filterProjectId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        blockers = data.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          projectId: b.project_id,
          projectName: b.project_name,
          severity: b.severity,
          status: b.status,
          reportedBy: b.reported_by,
          chatId: b.chat_id,
          createdAt: b.created_at,
        }));
      }
    } catch (e) {
      console.error('[Supabase] Error fetching blockers:', e.message);
    }
  }

  if (fs.existsSync(BLOCKERS_FILE)) {
    try {
      const localB = JSON.parse(fs.readFileSync(BLOCKERS_FILE, 'utf8'));
      const existingIds = new Set(blockers.map((b) => b.id));
      for (const b of localB) {
        if (b.status !== 'Resolved' && !existingIds.has(b.id)) {
          const matchProj = !filterProjectId || b.projectId === filterProjectId || (filterProjectName && b.projectName && b.projectName.toLowerCase() === filterProjectName.toLowerCase());
          if (matchProj) {
            blockers.push(b);
            existingIds.add(b.id);
          }
        }
      }
    } catch {}
  }

  return blockers;
}

// Deduplicate reports by member keeping latest submission
function deduplicateMemberReports(reportsList) {
  const byMember = new Map();
  const sorted = [...reportsList].sort((a, b) => {
    const timeA = new Date(a.submittedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || 0).getTime();
    return timeB - timeA;
  });

  for (const r of sorted) {
    const key = (r.memberId || r.chatId || r.memberName || '').toLowerCase();
    if (!byMember.has(key)) {
      byMember.set(key, r);
    }
  }
  return Array.from(byMember.values());
}

// Format formatted text for project daily report
function formatProjectReportText(projectName, memberReports, openBlockers = [], options = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const totalMembers = memberReports.length;
  const blockedCount = memberReports.filter((r) => r.isBlocked || (r.workStatus && r.workStatus.toLowerCase().includes('block'))).length;
  const isAllView = Boolean(options.isAllView);

  let out = '';
  if (!isAllView) {
    out += `📋 <b>QA LEAD DAILY TEAM REPORT</b>\n`;
    out += `📁 <b>Project:</b> <b>${escapeHtml(projectName)}</b>\n`;
    out += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
    out += `👥 <b>Team Submissions:</b> ${totalMembers} member${totalMembers === 1 ? '' : 's'} | `;
    out += (blockedCount > 0 || openBlockers.length > 0)
      ? `🚨 <b>${blockedCount + openBlockers.length} Blocker(s) Active</b>\n\n`
      : `🟢 <b>All Clear (0 Blockers)</b>\n\n`;
  } else {
    out += `📁 <b>Project: ${escapeHtml(projectName)}</b> (${totalMembers} submission${totalMembers === 1 ? '' : 's'})\n`;
  }

  if (memberReports.length === 0) {
    out += `<i>No daily standup reports submitted yet for this project.</i>\n\n`;
    return out;
  }

  memberReports.forEach((r) => {
    const dateTag = (r.date && r.date !== todayStr) ? ` <i>(${r.date})</i>` : '';
    const statusEmoji = r.statusEmoji || (r.isBlocked ? '🔴' : (r.workStatus === 'At Risk' ? '🟡' : '🟢'));
    const workStatus = r.workStatus || (r.isBlocked ? 'Blocked' : 'On Track');
    const isBlocked = r.isBlocked || (r.workStatus && r.workStatus.toLowerCase().includes('block'));
    const blockerTag = isBlocked && r.blockers && r.blockers.toLowerCase() !== 'none'
      ? `🚨 <b>Blocker:</b> ${escapeHtml(r.blockers)}`
      : `🟢 <b>Blockers:</b> None`;

    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `👤 <b>${escapeHtml(r.memberName || 'QA Member')}</b> <i>(${escapeHtml(r.role || 'QA Engineer')})</i>${dateTag}\n`;
    out += `• <b>Status:</b> ${statusEmoji} ${escapeHtml(workStatus)}\n`;
    out += `• <b>Worked Today:</b> ${escapeHtml(r.todayWorkingOn || 'In progress')}\n`;
    out += `• ${blockerTag}\n`;
    if (r.risks && r.risks.toLowerCase() !== 'none') {
      out += `• <b>Risk:</b> <i>${escapeHtml(r.risks)}</i>\n`;
    }
    if (r.nextPlan) {
      out += `• <b>Next Plan:</b> ${escapeHtml(r.nextPlan)}\n`;
    }
    if (r.majorAchievement && r.majorAchievement.toLowerCase() !== 'none') {
      out += `• <b>Achievement:</b> 🏆 ${escapeHtml(r.majorAchievement)}\n`;
    }
  });

  if (openBlockers.length > 0 && !isAllView) {
    out += `\n🚨 <b>ACTIVE PROJECT BLOCKERS (${openBlockers.length}):</b>\n`;
    openBlockers.forEach((b, i) => {
      out += `${i + 1}. <b>${escapeHtml(b.title || 'Blocker')}</b>\n`;
      if (b.description) out += `   <i>"${escapeHtml(b.description)}"</i>\n`;
      out += `   👤 Reported by: ${escapeHtml(b.reportedBy || 'Team Member')}\n`;
    });
  }

  return out;
}

// Send message with automatic chunking if text exceeds 3800 chars
async function sendLongMessage(chatId, text, extra = {}) {
  const MAX_LEN = 3800;
  if (text.length <= MAX_LEN) {
    return await sendMessage(chatId, text, extra);
  }

  const chunks = [];
  let remaining = text;
  while (remaining.length > MAX_LEN) {
    let splitIdx = remaining.lastIndexOf('━━━━━━━━━━━━━━━━━━━━', MAX_LEN);
    if (splitIdx === -1 || splitIdx < 500) {
      splitIdx = remaining.lastIndexOf('\n\n', MAX_LEN);
    }
    if (splitIdx === -1 || splitIdx < 500) {
      splitIdx = MAX_LEN;
    }
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).trim();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  for (const chunk of chunks) {
    await sendMessage(chatId, chunk, extra);
  }
}

// Generate ASCII progress bar
function makeProgressBar(percent, length = 10) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const filled = Math.max(0, Math.min(length, Math.round((p / 100) * length)));
  const empty = Math.max(0, length - filled);
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${p}%`;
}

// Format QA Lead /status text
function formatQALeadStatusText(project, memberReports, openBlockers = [], bugs = []) {
  const todayStr = new Date().toISOString().split('T')[0];
  const totalMembers = memberReports.length;

  let onTrackCount = 0;
  let atRiskCount = 0;
  let blockedCount = 0;

  let repCritical = 0;
  let repHigh = 0;
  let repMedium = 0;
  let repLow = 0;

  const activeRisksList = [];

  memberReports.forEach((r) => {
    const status = (r.workStatus || (r.isBlocked ? 'Blocked' : 'On Track')).toLowerCase();
    if (status.includes('block') || r.isBlocked) {
      blockedCount++;
    } else if (status.includes('risk')) {
      atRiskCount++;
    } else {
      onTrackCount++;
    }

    if (r.bugsFound && typeof r.bugsFound === 'object') {
      repCritical += r.bugsFound.critical || 0;
      repHigh += r.bugsFound.high || 0;
      repMedium += r.bugsFound.medium || 0;
      repLow += r.bugsFound.low || 0;
    } else if (r.notes) {
      try {
        const parsed = JSON.parse(r.notes);
        if (parsed.bugsBreakdown) {
          repCritical += parsed.bugsBreakdown.critical || 0;
          repHigh += parsed.bugsBreakdown.high || 0;
          repMedium += parsed.bugsBreakdown.medium || 0;
          repLow += parsed.bugsBreakdown.low || 0;
        }
      } catch {}
    }

    if (r.risks && r.risks.toLowerCase() !== 'none' && r.risks.trim().length > 0) {
      activeRisksList.push({ member: r.memberName || 'QA Member', risk: r.risks });
    }
  });

  const critBugs = bugs.filter((b) => b.severity === 'Critical' && b.status !== 'Closed');
  const highBugs = bugs.filter((b) => b.severity === 'High' && b.status !== 'Closed');
  const medBugs = bugs.filter((b) => b.severity === 'Medium' && b.status !== 'Closed');
  const lowBugs = bugs.filter((b) => b.severity === 'Low' && b.status !== 'Closed');

  const totalCrit = repCritical + critBugs.length;
  const totalHigh = repHigh + highBugs.length;
  const totalMed = repMedium + medBugs.length;
  const totalLow = repLow + lowBugs.length;
  const totalBugs = totalCrit + totalHigh + totalMed + totalLow;

  let readiness = '🟢 ON TRACK / READY';
  if (blockedCount > 0 || openBlockers.length > 0 || totalCrit > 0) {
    readiness = '🔴 BLOCKED / ACTION REQUIRED';
  } else if (atRiskCount > 0 || totalHigh > 2 || (project.qa_progress || 74) < 65) {
    readiness = '🟡 AT RISK / MONITOR CLOSELY';
  }

  const qaProgress = project.qa_progress ?? project.qaProgress ?? 74;
  const regressionProgress = project.regression_progress ?? project.regressionProgress ?? 62;
  const progressBar = makeProgressBar(qaProgress, 10);

  let out = `📊 <b>QA LEAD - PROJECT STATUS OVERVIEW</b>\n\n`;
  out += `📁 <b>Project:</b> <b>${escapeHtml(project.name)}</b>\n`;
  out += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
  out += `🛡️ <b>QA Readiness:</b> <b>${readiness}</b>\n\n`;

  out += `📊 <b>Project Progress</b>\n`;
  out += `• QA Execution: ${progressBar}\n`;
  out += `• Regression Suite: ${regressionProgress}% Complete\n\n`;

  out += `👥 <b>Team Members (${totalMembers})</b>\n`;
  out += `• 🟢 On Track: <b>${onTrackCount}</b>\n`;
  out += `• 🟡 At Risk: <b>${atRiskCount}</b>\n`;
  out += `• 🔴 Blocked: <b>${blockedCount}</b>\n\n`;

  out += `🐞 <b>Bug Counts by Severity</b>\n`;
  out += `• Critical: <b>${totalCrit}</b>\n`;
  out += `• High: <b>${totalHigh}</b>\n`;
  out += `• Medium: <b>${totalMed}</b>\n`;
  out += `• Low: <b>${totalLow}</b>\n`;
  out += `• Total Defect Exposure: <b>${totalBugs}</b>\n\n`;

  out += `🚨 <b>Active Blockers (${openBlockers.length})</b>\n`;
  if (openBlockers.length === 0 && blockedCount === 0) {
    out += `• None (All clear)\n\n`;
  } else {
    if (openBlockers.length > 0) {
      openBlockers.slice(0, 3).forEach((b) => {
        out += `• <b>${escapeHtml(b.title || 'Blocker')}</b>: <i>"${escapeHtml(b.description || 'Impacting testing')}"</i> (by ${escapeHtml(b.reportedBy || 'Team')})\n`;
      });
      if (openBlockers.length > 3) out += `  <i>+ ${openBlockers.length - 3} more blockers</i>\n`;
    }
    if (blockedCount > 0 && openBlockers.length === 0) {
      const blockedMembers = memberReports.filter((r) => r.isBlocked || (r.workStatus || '').toLowerCase().includes('block'));
      blockedMembers.forEach((m) => {
        out += `• 👤 <b>${escapeHtml(m.memberName)}:</b> <i>"${escapeHtml(m.blockers || 'Marked blocked in standup')}"</i>\n`;
      });
    }
    out += `\n`;
  }

  out += `⚠️ <b>Risks (${activeRisksList.length})</b>\n`;
  if (activeRisksList.length === 0) {
    out += `• None identified\n\n`;
  } else {
    activeRisksList.forEach((rk) => {
      out += `• 👤 <b>${escapeHtml(rk.member)}:</b> <i>"${escapeHtml(rk.risk)}"</i>\n`;
    });
    out += `\n`;
  }

  out += `💡 <b>Quick Navigation:</b> <code>/team</code> (member updates) • <code>/risks</code> • <code>/report</code>`;
  return out;
}

// Format QA Member /status text
function formatQAMemberStatusText(project, memberReport) {
  const todayStr = new Date().toISOString().split('T')[0];
  const qaProgress = project.qa_progress ?? project.qaProgress ?? 74;
  const regressionProgress = project.regression_progress ?? project.regressionProgress ?? 62;
  const progressBar = makeProgressBar(qaProgress, 10);

  let out = `📊 <b>QA STATUS - ${escapeHtml(project.name)}</b>\n\n`;
  out += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
  out += `📊 <b>Progress:</b> ${progressBar} (Regression: ${regressionProgress}%)\n\n`;

  if (memberReport) {
    const statusEmoji = memberReport.statusEmoji || (memberReport.isBlocked ? '🔴' : (memberReport.workStatus === 'At Risk' ? '🟡' : '🟢'));
    const workStatus = memberReport.workStatus || (memberReport.isBlocked ? 'Blocked' : 'On Track');
    out += `👤 <b>Your Latest Standup:</b>\n`;
    out += `• <b>Status:</b> ${statusEmoji} ${escapeHtml(workStatus)}\n`;
    out += `• <b>Today:</b> ${escapeHtml(memberReport.todayWorkingOn || 'In progress')}\n`;
    if (memberReport.blockers && memberReport.blockers.toLowerCase() !== 'none') {
      out += `• 🚨 <b>Blocker:</b> ${escapeHtml(memberReport.blockers)}\n`;
    }
    if (memberReport.bugsSummary && memberReport.bugsSummary.toLowerCase() !== 'none') {
      out += `• 🐞 <b>Bugs:</b> ${escapeHtml(memberReport.bugsSummary.replace(/\n/g, ', '))}\n`;
    }
  } else {
    out += `<i>You have not submitted a standup report today. Reply <code>/checkin</code> to submit.</i>\n`;
  }

  out += `\n💡 <b>Commands:</b> <code>/checkin</code> • <code>/blocker</code> • <code>/project</code>`;
  return out;
}

// Format formatted text for QA Lead /team command (daily report & progress)
function formatTeamProgressText(project, memberReports, openBlockers = [], options = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const isAllView = Boolean(options.isAllView);
  const qaProgress = project.qa_progress ?? project.qaProgress ?? 74;
  const regressionProgress = project.regression_progress ?? project.regressionProgress ?? 62;
  const progressBar = makeProgressBar(qaProgress, 10);
  const totalSubmissions = memberReports.length;

  let onTrack = 0;
  let atRisk = 0;
  let blocked = 0;

  memberReports.forEach((r) => {
    const st = (r.workStatus || (r.isBlocked ? 'Blocked' : 'On Track')).toLowerCase();
    if (st.includes('block') || r.isBlocked) blocked++;
    else if (st.includes('risk')) atRisk++;
    else onTrack++;
  });

  let out = '';
  if (!isAllView) {
    out += `👥 <b>QA LEAD - TEAM DAILY REPORT & PROGRESS</b>\n`;
    out += `📁 <b>Project:</b> <b>${escapeHtml(project.name)}</b>\n`;
    out += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
    out += `📊 <b>QA Progress:</b> ${progressBar} (Regression: ${regressionProgress}%)\n\n`;
    out += `👥 <b>Team Breakdown (${totalSubmissions} submitted):</b>\n`;
    out += `🟢 <b>${onTrack} On Track</b>  |  🟡 <b>${atRisk} At Risk</b>  |  🔴 <b>${blocked} Blocked</b>\n\n`;
  } else {
    out += `📁 <b>${escapeHtml(project.name)}</b> (${totalSubmissions} submitted)\n`;
    out += `🟢 ${onTrack} On Track | 🟡 ${atRisk} At Risk | 🔴 ${blocked} Blocked\n`;
  }

  if (memberReports.length === 0) {
    out += `<i>No team daily reports submitted yet for this project.</i>\n\n`;
    return out;
  }

  out += `━━━━━━━━━━━━━━━━━━━━\n`;
  out += `📋 <b>Team Member Updates:</b>\n\n`;

  memberReports.forEach((r, idx) => {
    const isToday = r.date === todayStr;
    const dateTag = !isToday && r.date ? ` <i>(${r.date})</i>` : '';
    const statusEmoji = r.statusEmoji || (r.isBlocked ? '🔴' : (r.workStatus === 'At Risk' ? '🟡' : '🟢'));
    const workStatus = r.workStatus || (r.isBlocked ? 'Blocked' : 'On Track');

    out += `${statusEmoji} <b>${escapeHtml(r.memberName || 'QA Member')}</b> <i>(${escapeHtml(r.role || 'QA Engineer')})</i>${dateTag}\n`;
    out += `• <b>Status:</b> ${statusEmoji} ${escapeHtml(workStatus)}\n`;
    out += `• <b>Yesterday:</b> ${escapeHtml(r.yesterdayCompleted || 'None recorded')}\n`;
    out += `• <b>Today:</b> ${escapeHtml(r.todayWorkingOn || 'In progress')}\n`;
    if (r.bugsSummary && r.bugsSummary !== 'None') {
      out += `• 🐞 <b>Bugs:</b> ${escapeHtml(r.bugsSummary.replace(/\n/g, ', '))}\n`;
    }
    if (r.blockers && r.blockers.toLowerCase() !== 'none') {
      out += `• 🚨 <b>Blocker:</b> <i>${escapeHtml(r.blockers)}</i>\n`;
    }
    if (r.risks && r.risks.toLowerCase() !== 'none') {
      out += `• ⚠️ <b>Risk:</b> <i>${escapeHtml(r.risks)}</i>\n`;
    }
    if (idx < memberReports.length - 1) {
      out += `\n`;
    }
  });

  return out;
}

// Fetch critical & high severity project bugs
async function fetchProjectBugs(projectId = null) {
  let bugs = [];
  if (supabase) {
    try {
      let query = supabase.from('qa_bugs').select('*').neq('status', 'Closed');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        bugs = data.map((b) => ({
          id: b.id,
          title: b.title,
          severity: b.severity || 'Medium',
          priority: b.priority || 'Medium',
          status: b.status || 'Open',
          projectId: b.project_id,
          module: b.module || 'General',
        }));
      }
    } catch (e) {}
  }

  if (bugs.length === 0) {
    const defaultBugs = [
      {
        id: 'BUG-142',
        title: 'Payment Gateway 500 error on zero-decimal currencies (JPY, KRW)',
        severity: 'Critical',
        priority: 'Critical',
        status: 'Retest',
        projectId: 'prj-banking',
        module: 'Payment Module',
      },
      {
        id: 'BUG-140',
        title: 'KYC Document upload silently fails on high-resolution PNGs (>12MB)',
        severity: 'Critical',
        priority: 'Critical',
        status: 'In Progress',
        projectId: 'prj-banking',
        module: 'KYC / Onboarding',
      },
      {
        id: 'BUG-138',
        title: 'Biometric FaceID unlock bypass on background resume',
        severity: 'High',
        priority: 'High',
        status: 'In Progress',
        projectId: 'prj-mobile',
        module: 'Biometrics Core',
      },
      {
        id: 'BUG-135',
        title: 'Merchant settlement CSV export memory leak on >50k transactions',
        severity: 'High',
        priority: 'High',
        status: 'Open',
        projectId: 'prj-merchant',
        module: 'Settlement Engine',
      },
    ];
    bugs = projectId ? defaultBugs.filter((b) => b.projectId === projectId) : defaultBugs;
  }
  return bugs;
}


// Format formatted text for QA Lead /risks command (QA risks, blockers & defect exposures)
function formatQARisksText(project, openBlockers = [], memberReports = [], bugs = [], options = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const isAllView = Boolean(options.isAllView);
  const blockedMembers = memberReports.filter((r) => r.isBlocked && r.blockers);
  const criticalBugs = bugs.filter((b) => b.severity === 'Critical' && b.status !== 'Closed');
  const highBugs = bugs.filter((b) => b.severity === 'High' && b.status !== 'Closed');
  const qaProgress = project.qa_progress ?? project.qaProgress ?? 74;

  // Determine Release Risk Level
  let riskLevel = '🟢 LOW RISK / ON TRACK';
  let riskSummary = 'Testing is proceeding smoothly with zero critical impediments.';

  if (openBlockers.length > 0 || blockedMembers.length > 0) {
    riskLevel = '🚨 CRITICAL RISK / BLOCKED';
    riskSummary = 'Active blockers are currently stalling testing operations and require immediate escalation.';
  } else if (criticalBugs.length > 0) {
    riskLevel = '🔴 HIGH RISK / NOT READY';
    riskSummary = 'Critical defect(s) unresolved that prevent production release.';
  } else if (highBugs.length > 2 || qaProgress < 60) {
    riskLevel = '🟡 MEDIUM RISK / READY WITH RISKS';
    riskSummary = 'Elevated defect volume or low regression coverage poses release exposure.';
  }

  let out = '';
  if (!isAllView) {
    out += `⚠️ <b>QA LEAD - ACTIVE RISKS & BLOCKERS</b>\n`;
    out += `📁 <b>Project:</b> <b>${escapeHtml(project.name)}</b>\n`;
    out += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
    out += `🛡️ <b>Release Risk Level:</b> <b>${riskLevel}</b>\n`;
    out += `<i>${riskSummary}</i>\n\n`;
  } else {
    out += `📁 <b>Project: ${escapeHtml(project.name)}</b> — <b>${riskLevel}</b>\n`;
  }

  let hasRisks = false;

  // 1. Blockers Section
  if (openBlockers.length > 0) {
    hasRisks = true;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🚨 <b>Active Project Blockers (${openBlockers.length}):</b>\n`;
    openBlockers.forEach((b, i) => {
      out += `${i + 1}. <b>${escapeHtml(b.title || 'Blocker')}</b>\n`;
      if (b.description) out += `   <i>"${escapeHtml(b.description)}"</i>\n`;
      out += `   👤 Reported by: ${escapeHtml(b.reportedBy || 'Team Member')} • Status: <b>${escapeHtml(b.status || 'Open')}</b>\n`;
    });
  }

  // 2. Blocked Team Members Section
  if (blockedMembers.length > 0) {
    hasRisks = true;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `👥 <b>Blocked Team Members (${blockedMembers.length}):</b>\n`;
    blockedMembers.forEach((m) => {
      out += `• <b>${escapeHtml(m.memberName || 'QA Member')}:</b> <i>"${escapeHtml(m.blockers)}"</i>\n`;
    });
  }

  // 3. Critical & High Bugs Section
  if (criticalBugs.length > 0 || highBugs.length > 0) {
    hasRisks = true;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🐛 <b>Defect Exposure (${criticalBugs.length} Critical, ${highBugs.length} High):</b>\n`;
    criticalBugs.forEach((b) => {
      out += `• 🔴 [${escapeHtml(b.id)}] <b>${escapeHtml(b.title)}</b>\n`;
      out += `  Severity: <b>Critical</b> • Status: ${escapeHtml(b.status)} • Module: ${escapeHtml(b.module)}\n`;
    });
    highBugs.slice(0, 3).forEach((b) => {
      out += `• 🟡 [${escapeHtml(b.id)}] <b>${escapeHtml(b.title)}</b>\n`;
      out += `  Severity: <b>High</b> • Status: ${escapeHtml(b.status)} • Module: ${escapeHtml(b.module)}\n`;
    });
    if (highBugs.length > 3) {
      out += `  <i>+ ${highBugs.length - 3} more high severity bugs</i>\n`;
    }
  }

  // If no risks detected
  if (!hasRisks) {
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🎉 <b>Zero Active Risks Detected!</b>\n`;
    out += `• 0 Open Blockers\n`;
    out += `• 0 Critical/High Unresolved Defects\n`;
    out += `• All team members actively working without impediments\n`;
    out += `• QA Progress: ${qaProgress}%\n`;
  }

  return out;
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
    userSessions.set(chatId, {
      type: 'checkin',
      step: 'resolve_previous_blocker',
      pendingBlockers: openBlockers,
      profile,
      answers: {},
    });

    const blockerCountText = openBlockers.length === 1 ? 'an active blocker' : `${openBlockers.length} active blockers`;
    const blockerItemsList = openBlockers
      .map((b) => `• <b>${escapeHtml(b.title || 'Blocker')}</b>: <i>"${escapeHtml(b.description)}"</i>`)
      .join('\n');

    await sendMessage(
      chatId,
      `👋 <b>Good morning, ${escapeHtml(profile.fullName)}!</b>\n\n` +
      `⚠️ <b>Reminder from Yesterday:</b>\n` +
      `You previously reported ${blockerCountText} on <b>${escapeHtml(openBlockers[0].projectName || profile.projectName)}</b>:\n` +
      `${blockerItemsList}\n\n` +
      `<b>Are these blocker(s) now resolved?</b>\n\n` +
      `1️⃣ <b>Yes, mark resolved</b> (Remove from blocked tasks on QA Command Center)\n` +
      `2️⃣ <b>No, still blocked</b>\n\n` +
      `<i>Reply 1 (or 'yes', 'resolved') to mark them resolved, or 2 (or 'no') to keep active:</i>`
    );
    return;
  }

  userSessions.set(chatId, {
    type: 'checkin',
    step: 'q1_worked_today',
    profile,
    answers: {},
  });

  await sendMessage(
    chatId,
    `👋 <b>Good day, ${escapeHtml(profile.fullName)}!</b>\n\n` +
    `📁 <b>Project:</b> <b>${escapeHtml(profile.projectName)}</b>\n\n` +
    `🎯 <b>What you worked on today?</b>\n` +
    `<i>(Feature, module, test cases executed, API testing, regression, bugs retested, etc.)</i>`
  );
}

async function finalizeAndSubmitCheckin(chatId, user, session) {
  const profile = session.profile;
  const answers = session.answers;
  const hasBlocker = Boolean(answers.isBlocked && answers.blockers && answers.blockers.toLowerCase() !== 'none' && answers.blockers.trim().length > 0);
  const blockersText = hasBlocker ? answers.blockers : 'None';
  const hasRisk = Boolean(answers.risks && answers.risks.toLowerCase() !== 'none' && answers.risks.trim().length > 0);
  const risksText = hasRisk ? answers.risks : 'None';
  const nextPlanText = answers.nextPlan || 'Continue testing';
  const majorAchievementText = answers.majorAchievement || 'None';

  const workStatus = hasBlocker ? 'Blocked' : (hasRisk ? 'At Risk' : 'On Track');
  const statusEmoji = hasBlocker ? '🔴' : (hasRisk ? '🟡' : '🟢');

  const fullReport = {
    id: `tg-${Date.now().toString(36)}`,
    date: new Date().toISOString().split('T')[0],
    chatId: String(chatId),
    memberId: `usr-${chatId}`,
    memberName: profile.fullName,
    role: profile.role,
    projectId: profile.projectId,
    projectName: profile.projectName,
    todayWorkingOn: answers.todayWorkingOn,
    blockers: blockersText === 'None' ? '' : blockersText,
    isBlocked: hasBlocker,
    risks: risksText === 'None' ? '' : risksText,
    nextPlan: nextPlanText,
    majorAchievement: majorAchievementText,
    yesterdayCompleted: majorAchievementText, // for backward compatibility
    workStatus: workStatus,
    statusEmoji: statusEmoji,
    progressPercentage: 80,
    expectedCompletion: nextPlanText,
    notes: JSON.stringify({
      workStatus,
      statusEmoji,
      risks: risksText,
      nextPlan: nextPlanText,
      majorAchievement: majorAchievementText,
    }),
    submittedAt: new Date().toISOString(),
  };

  persistReport(fullReport);

  // If member has blocker, create blocker item so QA Lead dashboard reflects it
  if (hasBlocker) {
    persistBlocker({
      id: `blk-${Date.now().toString(36)}`,
      title: `Blocker: ${profile.fullName} (${workStatus})`,
      description: blockersText,
      projectId: profile.projectId,
      projectName: profile.projectName,
      severity: 'Critical',
      status: 'Open',
      reportedBy: profile.fullName,
      chatId: String(chatId),
      createdAt: new Date().toISOString(),
    });
  }

  // PROACTIVELY NOTIFY QA LEAD(S) IF THERE IS A BLOCKER OR RISK
  if (hasBlocker || hasRisk) {
    notifyQALeadsOfStandupIssue({
      senderChatId: chatId,
      profile,
      workStatus,
      statusEmoji,
      todayWorkingOn: answers.todayWorkingOn,
      blockersText,
      risksText,
      hasBlocker,
      hasRisk,
      nextPlanText,
      majorAchievementText,
    }).catch((err) => console.error('[Notify Lead Error]', err.message));
  }

  userSessions.delete(chatId);

  // AFTER SUBMISSION, show concise confirmation matching required template
  const confirmationMsg =
    `✅ <b>Daily QA Report Submitted</b>\n\n` +
    `📁 <b>Project:</b> ${escapeHtml(profile.projectName)}\n` +
    `👤 <b>QA Member:</b> ${escapeHtml(profile.fullName)}\n\n` +
    `🎯 <b>What you worked on today</b>\n` +
    `${escapeHtml(answers.todayWorkingOn)}\n\n` +
    `🚨 <b>Blocker</b>\n` +
    `${escapeHtml(blockersText)}\n\n` +
    `⚠️ <b>Risk</b>\n` +
    `${escapeHtml(risksText)}\n\n` +
    `📋 <b>Next Plan</b>\n` +
    `${escapeHtml(nextPlanText)}\n\n` +
    `🏆 <b>Major achievement today</b>\n` +
    `${escapeHtml(majorAchievementText)}\n\n` +
    `<i>Your report has been logged successfully.</i>`;

  await sendMessage(chatId, confirmationMsg);
}

async function handleCheckinStep(chatId, user, text) {
  const session = userSessions.get(chatId);
  if (!session || session.type !== 'checkin') return false;
  const profile = session.profile;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (session.step === 'resolve_previous_blocker') {
    const isYes = lower === '1' || lower.includes('yes') || lower.includes('resolved') || lower === 'y' || lower.includes('fixed');
    const blockersToResolve = session.pendingBlockers || [session.pendingBlocker].filter(Boolean);
    if (isYes && blockersToResolve.length > 0) {
      for (const b of blockersToResolve) {
        await markBlockerResolved(b.id);
      }

      const activeProj = profile ? profile.projectName : (blockersToResolve[0]?.projectName || 'QA Project');
      const activeProjId = profile ? profile.projectId : (blockersToResolve[0]?.projectId || '');
      notifyQALeadsOfBlockerResolved({
        senderChatId: chatId,
        memberName: profile ? profile.fullName : (user.first_name || 'QA Member'),
        username: user.username || user.first_name,
        projectName: activeProj,
        projectId: activeProjId,
        resolvedBlockers: blockersToResolve,
        resolvedAt: new Date().toISOString(),
      }).catch((err) => console.error('[Notify Lead Error]', err.message));

      await sendMessage(
        chatId,
        `✅ <b>${blockersToResolve.length} Blocker(s) Marked as Resolved!</b>\n` +
        `They have been removed from the blocked tasks on the QA Command Center Dashboard.\n\n` +
        `Now let's proceed with your daily standup.\n\n` +
        `🎯 <b>What you worked on today?</b>\n` +
        `<i>(Feature, module, test cases executed, API testing, regression, bugs retested, etc.)</i>`
      );
    } else {
      await sendMessage(
        chatId,
        `Understood, keeping blocker(s) active on the dashboard.\n\n` +
        `Now let's proceed with your daily standup.\n\n` +
        `🎯 <b>What you worked on today?</b>\n` +
        `<i>(Feature, module, test cases executed, API testing, regression, bugs retested, etc.)</i>`
      );
    }
    session.step = 'q1_worked_today';
    return true;
  }

  switch (session.step) {
    case 'q1_worked_today':
    case 1:
      session.answers.todayWorkingOn = trimmed;
      session.step = 'q2_blockers';
      await sendMessage(
        chatId,
        `🚨 <b>Any blockers/challenges?</b>\n\n` +
        `<i>(Reply with any blockers or challenges, or type <b>None</b> if all clear):</i>`
      );
      return true;

    case 'q2_blockers':
    case 2: {
      const isNone = lower === 'none' || lower === 'no' || lower === '0' || lower === 'clear' || lower === 'all clear' || lower === 'nothing' || lower === 'nil';
      if (isNone) {
        session.answers.blockers = 'None';
        session.answers.isBlocked = false;
      } else {
        session.answers.blockers = trimmed;
        session.answers.isBlocked = true;
      }
      session.step = 'q3_risks';
      await sendMessage(
        chatId,
        `⚠️ <b>Risk you afraid of?</b>\n\n` +
        `<i>(Any release risks, environment instability, dependencies, or type <b>None</b> if none):</i>`
      );
      return true;
    }

    case 'q3_risks':
    case 3: {
      const isNone = lower === 'none' || lower === 'no' || lower === '0' || lower === 'clear' || lower === 'nothing' || lower === 'nil';
      session.answers.risks = isNone ? 'None' : trimmed;
      session.step = 'q4_next_plan';
      await sendMessage(
        chatId,
        `📋 <b>Next Plan?</b>\n\n` +
        `<i>(What is your primary testing task or plan next?):</i>`
      );
      return true;
    }

    case 'q4_next_plan':
    case 4:
      session.answers.nextPlan = trimmed;
      session.step = 'q5_major_achievement';
      await sendMessage(
        chatId,
        `🏆 <b>Major achievement today?</b>\n\n` +
        `<i>(Key accomplishment, milestone, critical bug found/verified, or type <b>None</b>):</i>`
      );
      return true;

    case 'q5_major_achievement':
    case 5: {
      const isNone = lower === 'none' || lower === 'no' || lower === '0' || lower === 'nothing' || lower === 'nil';
      session.answers.majorAchievement = isNone ? 'None' : trimmed;
      session.answers.yesterdayCompleted = session.answers.majorAchievement;
      await finalizeAndSubmitCheckin(chatId, user, session);
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
  const rawText = message.text?.trim() || '';
  const text = rawText.toLowerCase();
  const user = message.from || {};
  console.log(`[Telegram IN] Chat ${chatId} (@${user.username || user.first_name || 'unknown'}): "${rawText}"`);

  const profile = await findOrLinkProfile(chatId, user);
  if (profile && profile.role) {
    syncTelegramCommands(chatId, profile.role).catch(() => {});
  }

  // Handle /start, start, /help, help, /menu, menu
  if (text === '/start' || text === 'start' || text === '/help' || text === 'help' || text === '/menu' || text === 'menu') {
    // Clear any stuck/previous wizard session so /start always provides a fresh welcome!
    userSessions.delete(chatId);

    if (!profile) {
      console.log(`[Bot] Member ${chatId} has no active profile in Supabase. Prompting onboarding wizard.`);
      await startOnboarding(chatId, user, false);
      return;
    }

    const isLead = isQALead(profile);
    const commandsList = isLead
      ? `<b>Available Commands (QA Lead):</b>\n` +
        `• /status — Overall QA & project readiness\n` +
        `• /team — Team members and their current status\n` +
        `• /project — Manage and switch active QA project\n` +
        `• /blocker &lt;reason&gt; — View or report blockers\n` +
        `• /resolve — Resolve active blockers\n` +
        `• /risks — View QA risks & defect exposures\n` +
        `• /report — Generate daily/weekly QA reports\n` +
        `• /profile — View and update your profile\n` +
        `• /role [title] — Switch your QA role (e.g. /role QA Engineer)\n` +
        `• /cancel — Cancel an active operation`
      : `<b>Available Commands:</b>\n` +
        `• /checkin — Submit daily QA standup\n` +
        `• /project — Switch active project\n` +
        `• /blocker &lt;reason&gt; — Report urgent blocker\n` +
        `• /resolve — Resolve active blocker\n` +
        `• /profile — View and update profile\n` +
        `• /status — View relevant QA status\n` +
        `• /role [title] — Switch your QA role\n` +
        `• /cancel — Cancel current operation`;

    await sendMessage(
      chatId,
      `🛡️ <b>Welcome to AegisQA, ${escapeHtml(profile.fullName)}!</b>\n\n` +
      `👤 <b>Role:</b> ${escapeHtml(profile.role)}\n` +
      `🚀 <b>Active Project:</b> ${escapeHtml(profile.projectName)}\n` +
      `💬 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
      commandsList
    );
    return;
  }

  // Active Session handling
  if (userSessions.has(chatId) && !rawText.startsWith('/')) {
    const session = userSessions.get(chatId);
    if (session.type === 'onboarding') {
      const handled = await handleOnboardingStep(chatId, user, rawText);
      if (handled) return;
    } else if (session.type === 'checkin') {
      const handled = await handleCheckinStep(chatId, user, rawText);
      if (handled) return;
    } else if (session.type === 'switch_project') {
      const handled = await handleProjectSwitch(chatId, rawText);
      if (handled) return;
    }
  }

  // Active Session cancellation
  if (text === '/cancel' || text === 'cancel') {
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

  if (text === '/profile') {
    if (!profile) {
      await startOnboarding(chatId, user, false);
      return;
    }

    const isLead = isQALead(profile);
    const profileQuickCommands = isLead
      ? `<b>Quick Commands (QA Lead):</b>\n` +
        `• /status — Overall QA & project readiness\n` +
        `• /team — Team members and their current status\n` +
        `• /project — Manage/switch project\n` +
        `• /blocker — View/report blockers\n` +
        `• /resolve — Resolve blockers\n` +
        `• /risks — View QA risks\n` +
        `• /report — Generate daily/weekly QA reports\n` +
        `• /role — Switch role`
      : `<b>Quick Commands:</b>\n` +
        `• /checkin — Submit daily standup\n` +
        `• /project — Switch active project\n` +
        `• /blocker — Report urgent blocker\n` +
        `• /resolve — Resolve active blocker\n` +
        `• /status — View relevant QA status\n` +
        `• /role — Switch role`;

    await sendMessage(
      chatId,
      `👤 <b>AegisQA Profile</b>\n\n` +
      `• <b>Full Name:</b> ${escapeHtml(profile.fullName)}\n` +
      `• <b>QA Role:</b> ${escapeHtml(profile.role)}\n` +
      `• <b>Active Project:</b> ${escapeHtml(profile.projectName)}\n` +
      `• <b>Telegram:</b> @${escapeHtml(user.username || 'n/a')}\n` +
      `• <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
      profileQuickCommands
    );
    return;
  }

  if (text === '/project' || text === '/projects' || text === '/switch' || text === '/switchproject') {
    await startProjectSwitch(chatId);
    return;
  }

  if (text === '/checkin') {
    if (isQALead(profile)) {
      await sendMessage(
        chatId,
        `ℹ️ <b>QA Lead Role Active</b>\n\n` +
        `As a <b>QA Lead</b>, you monitor team progress rather than submitting individual daily check-ins.\n\n` +
        `• Use <code>/status</code> for overall QA readiness & defect metrics\n` +
        `• Use <code>/team</code> to view team daily updates & testing progress\n` +
        `• Use <code>/report</code> for detailed team standup rollup\n` +
        `• Use <code>/risks</code> to view active QA risks & blockers\n\n` +
        `<i>If you want to submit individual testing check-ins, switch your role using <code>/role QA Engineer</code>.</i>`
      );
      return;
    }
    await startCheckin(chatId, user);
    return;
  }

  if (text.startsWith('/blocker')) {
    const reason = rawText.replace(/^\/blocker/i, '').trim();
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

    // Proactively notify QA Lead(s) directly in Telegram!
    notifyQALeadsOfBlocker({
      senderChatId: chatId,
      memberName,
      username: user.username || user.first_name,
      projectName,
      projectId,
      reason,
      severity: 'Critical',
      createdAt: blockerItem.createdAt,
    }).catch((err) => console.error('[Notify Lead Error]', err.message));

    await sendMessage(
      chatId,
      `🚨 <b>CRITICAL BLOCKER LOGGED</b>\n\n` +
      `📁 <b>Project:</b> ${escapeHtml(projectName)}\n` +
      `👤 <b>Reported by:</b> ${escapeHtml(memberName)} (@${escapeHtml(user.username || user.first_name)})\n` +
      `⚠️ <b>Issue:</b> ${escapeHtml(reason)}\n` +
      `🕒 <b>Time:</b> ${new Date().toLocaleTimeString()}\n\n` +
      `<i>The QA Lead Command Center has been alerted.</i>`
    );
    return;
  }

  const isResolveCommand =
    text === '/resolve' ||
    text === '/unblock' ||
    text.startsWith('/resolve') ||
    text.startsWith('/unblock') ||
    text === 'resolved' ||
    text === 'the bug is resolved' ||
    text === 'bug resolved' ||
    text === 'the blocker is resolved' ||
    text === 'blocker resolved' ||
    text === 'it is resolved' ||
    text.includes('is resolved') ||
    text.includes('mark resolved');

  if (isResolveCommand) {
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

    // Proactively notify QA Lead(s) of resolved blocker(s)
    const activeProj = profile ? profile.projectName : (openBlockers[0]?.projectName || 'QA Project');
    const activeProjId = profile ? profile.projectId : (openBlockers[0]?.projectId || '');
    notifyQALeadsOfBlockerResolved({
      senderChatId: chatId,
      memberName: profile ? profile.fullName : (user.first_name || 'QA Member'),
      username: user.username || user.first_name,
      projectName: activeProj,
      projectId: activeProjId,
      resolvedBlockers: openBlockers,
      resolvedAt: new Date().toISOString(),
    }).catch((err) => console.error('[Notify Lead Error]', err.message));

    await sendMessage(
      chatId,
      `✅ <b>Blocker(s) Resolved!</b>\n\n` +
      `The following blocker(s) have been marked as <b>Resolved</b>:\n` +
      openBlockers.map((b) => `• <b>${escapeHtml(b.title)}</b> (${escapeHtml(b.description)})`).join('\n') +
      `\n\nThey have been removed from the blocked tasks on the QA Command Center Dashboard!`
    );
    return;
  }

  if (text === '/status') {
    const isLead = isQALead(profile);
    const projects = await refreshProjectsFromCloud();
    const activeProjName = profile ? profile.projectName : 'Banking SuperApp';
    const activeProjId = profile ? profile.projectId : 'prj-banking';
    const selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
      id: activeProjId,
      name: activeProjName,
      qa_progress: 74,
      regression_progress: 62,
    };

    const allReports = await fetchDailyReports(selectedProject.id);
    const dedupedReports = deduplicateMemberReports(allReports);
    const allBlockers = await fetchProjectBlockers(selectedProject.id, selectedProject.name);

    if (isLead) {
      const allBugs = await fetchProjectBugs(selectedProject.id);
      const leadStatusText = formatQALeadStatusText(selectedProject, dedupedReports, allBlockers, allBugs);
      await sendLongMessage(chatId, leadStatusText);
    } else {
      const myReport = dedupedReports.find((r) => String(r.chatId) === String(chatId) || (profile && r.memberName === profile.fullName));
      const memberStatusText = formatQAMemberStatusText(selectedProject, myReport);
      await sendMessage(chatId, memberStatusText);
    }
    return;
  }

  if (text === '/report' || text.startsWith('/report ') || text === '/reports' || text.startsWith('/reports ') || text === '/dailyreport' || text.startsWith('/dailyreport ')) {
    const isLead = isQALead(profile);

    if (!isLead) {
      await sendMessage(
        chatId,
        `⚠️ <b>Access Restricted: QA Lead Only</b>\n\n` +
        `The <code>/report</code> command generates consolidated daily standup reports from all team members and is reserved for <b>QA Leads</b>.\n\n` +
        `👤 <b>Your Current Profile:</b>\n` +
        `• Name: ${escapeHtml(profile ? profile.fullName : 'QA Member')}\n` +
        `• Role: <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n` +
        `• Project: ${escapeHtml(profile ? profile.projectName : 'None')}\n\n` +
        `💡 <i>If you are the QA Lead, reply with:</i>\n` +
        `<code>/role QA Lead</code> to update your role, or <code>/register</code> to re-configure.`
      );
      return;
    }

    const rawArg = rawText.replace(/^\/(report|reports|dailyreport)\s*/i, '').trim();
    const arg = rawArg.toLowerCase();
    const projects = await refreshProjectsFromCloud();
    const allReports = await fetchDailyReports();
    const allBlockers = await fetchProjectBlockers();
    const todayStr = new Date().toISOString().split('T')[0];

    // CASE 1: /report all -> Grouped by project across all projects
    if (arg === 'all') {
      const projectMap = new Map();
      projects.forEach((p) => {
        projectMap.set(p.id, { id: p.id, name: p.name, reports: [], blockers: [] });
      });

      // Distribute reports to projects
      allReports.forEach((r) => {
        const pId = r.projectId || 'prj-unknown';
        if (!projectMap.has(pId)) {
          projectMap.set(pId, { id: pId, name: r.projectName || 'General Project', reports: [], blockers: [] });
        }
        projectMap.get(pId).reports.push(r);
      });

      // Distribute blockers to projects
      allBlockers.forEach((b) => {
        const pId = b.projectId || 'prj-unknown';
        if (!projectMap.has(pId)) {
          projectMap.set(pId, { id: pId, name: b.projectName || 'General Project', reports: [], blockers: [] });
        }
        projectMap.get(pId).blockers.push(b);
      });

      const activeProjects = Array.from(projectMap.values()).filter(
        (p) => p.reports.length > 0 || p.blockers.length > 0
      );

      if (activeProjects.length === 0) {
        await sendMessage(
          chatId,
          `📋 <b>QA LEAD - ALL PROJECTS DAILY REPORT</b>\n` +
          `📅 <b>Date:</b> <code>${todayStr}</code>\n\n` +
          `ℹ️ No team daily reports have been submitted yet today.\n\n` +
          `<i>Team members can submit their updates using <code>/checkin</code>.</i>`
        );
        return;
      }

      let fullMsg = `📊 <b>QA LEAD - CONSOLIDATED DAILY TEAM REPORTS</b>\n`;
      fullMsg += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
      fullMsg += `📋 <b>Total Active Projects:</b> ${activeProjects.length}\n\n`;

      activeProjects.forEach((proj) => {
        const deduped = deduplicateMemberReports(proj.reports);
        fullMsg += `==============================\n`;
        fullMsg += formatProjectReportText(proj.name, deduped, proj.blockers, { isAllView: true }) + '\n';
      });

      fullMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      fullMsg += `💡 <i>Filter by specific project: <code>/report &lt;name or number&gt;</code></i>`;

      await sendLongMessage(chatId, fullMsg);
      return;
    }

    // CASE 2: Specific project requested (/report <name or number>) or Active Project (/report)
    let selectedProject = null;

    if (rawArg) {
      const num = parseInt(rawArg, 10);
      if (!isNaN(num) && num >= 1 && num <= projects.length) {
        selectedProject = projects[num - 1];
      } else {
        selectedProject = projects.find(
          (p) => p.name.toLowerCase() === arg || p.id.toLowerCase() === arg
        ) || projects.find(
          (p) => p.name.toLowerCase().includes(arg) || p.id.toLowerCase().includes(arg)
        );

        if (!selectedProject) {
          const reportMatch = allReports.find(
            (r) => (r.projectName && r.projectName.toLowerCase().includes(arg)) || (r.projectId && r.projectId.toLowerCase().includes(arg))
          );
          if (reportMatch) {
            selectedProject = {
              id: reportMatch.projectId,
              name: reportMatch.projectName,
            };
          }
        }
      }

      if (!selectedProject) {
        let availableList = projects.map((p, idx) => `${NUMBER_EMOJIS[idx] || `[${idx + 1}]`} ${p.name}`).join('\n');
        await sendMessage(
          chatId,
          `⚠️ <b>Project "${escapeHtml(rawArg)}" not found.</b>\n\n` +
          `<b>Available Projects:</b>\n` +
          availableList + '\n\n' +
          `<i>Reply <code>/report &lt;project name or number&gt;</code> or <code>/report all</code></i>`
        );
        return;
      }
    } else {
      const activeProjName = profile.projectName || 'Banking SuperApp';
      const activeProjId = profile.projectId || 'prj-banking';
      selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
        id: activeProjId,
        name: activeProjName,
      };
    }

    const projReports = allReports.filter(
      (r) => r.projectId === selectedProject.id || (r.projectName && r.projectName.toLowerCase() === selectedProject.name.toLowerCase())
    );
    const dedupedReports = deduplicateMemberReports(projReports);
    const projBlockers = allBlockers.filter(
      (b) => b.projectId === selectedProject.id || (b.projectName && b.projectName.toLowerCase() === selectedProject.name.toLowerCase())
    );

    let reportMsg = formatProjectReportText(selectedProject.name, dedupedReports, projBlockers, { isAllView: false });

    // Show quick list of other projects with reports
    const otherProjects = [];
    const otherProjNames = new Set();
    allReports.forEach((r) => {
      const pName = r.projectName || 'General';
      if (pName.toLowerCase() !== selectedProject.name.toLowerCase() && !otherProjNames.has(pName.toLowerCase())) {
        otherProjNames.add(pName.toLowerCase());
        otherProjects.push(pName);
      }
    });

    reportMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    reportMsg += `💡 <b>Quick Commands:</b>\n`;
    if (otherProjects.length > 0) {
      reportMsg += `• Other projects: ` + otherProjects.map((op) => `<code>/report ${escapeHtml(op)}</code>`).join(', ') + `\n`;
    }
    reportMsg += `• View all projects: <code>/report all</code>\n`;
    reportMsg += `• Switch active project: <code>/project</code>\n`;

    await sendLongMessage(chatId, reportMsg);
    return;
  }

  // /team Command for QA Lead (team daily report & testing progress)
  if (text === '/team' || text.startsWith('/team ') || text === '/progress' || text.startsWith('/progress ') || text === '/teamreport' || text.startsWith('/teamreport ')) {
    const isLead = isQALead(profile);

    if (!isLead) {
      await sendMessage(
        chatId,
        `⚠️ <b>Access Restricted: QA Lead Only</b>\n\n` +
        `The <code>/team</code> command provides team daily standup updates and testing progress and is reserved for <b>QA Leads</b>.\n\n` +
        `👤 <b>Your Current Profile:</b>\n` +
        `• Name: ${escapeHtml(profile ? profile.fullName : 'QA Member')}\n` +
        `• Role: <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n` +
        `• Project: ${escapeHtml(profile ? profile.projectName : 'None')}\n\n` +
        `💡 <i>If you are the QA Lead, reply with:</i>\n` +
        `<code>/role QA Lead</code> to update your role, or <code>/register</code> to re-configure.`
      );
      return;
    }

    const rawArg = rawText.replace(/^\/(team|progress|teamreport)\s*/i, '').trim();
    const arg = rawArg.toLowerCase();
    const projects = await refreshProjectsFromCloud();
    const allReports = await fetchDailyReports();
    const allBlockers = await fetchProjectBlockers();
    const todayStr = new Date().toISOString().split('T')[0];

    // CASE 1: /team all
    if (arg === 'all') {
      let fullMsg = `👥 <b>QA LEAD - ALL PROJECTS TEAM PROGRESS</b>\n`;
      fullMsg += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
      fullMsg += `📋 <b>Total Projects:</b> ${projects.length}\n\n`;

      projects.forEach((proj) => {
        const projReports = allReports.filter(
          (r) => r.projectId === proj.id || (r.projectName && r.projectName.toLowerCase() === proj.name.toLowerCase())
        );
        const deduped = deduplicateMemberReports(projReports);
        const projBlockers = allBlockers.filter(
          (b) => b.projectId === proj.id || (b.projectName && b.projectName.toLowerCase() === proj.name.toLowerCase())
        );

        fullMsg += `==============================\n`;
        fullMsg += formatTeamProgressText(proj, deduped, projBlockers, { isAllView: true }) + '\n';
      });

      fullMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      fullMsg += `💡 <i>View specific project: <code>/team &lt;name or number&gt;</code> • QA Risks: <code>/risks</code></i>`;

      await sendLongMessage(chatId, fullMsg);
      return;
    }

    // CASE 2: Specific Project or Active Project
    let selectedProject = null;

    if (rawArg) {
      const num = parseInt(rawArg, 10);
      if (!isNaN(num) && num >= 1 && num <= projects.length) {
        selectedProject = projects[num - 1];
      } else {
        selectedProject = projects.find(
          (p) => p.name.toLowerCase() === arg || p.id.toLowerCase() === arg
        ) || projects.find(
          (p) => p.name.toLowerCase().includes(arg) || p.id.toLowerCase().includes(arg)
        );

        if (!selectedProject) {
          const reportMatch = allReports.find(
            (r) => (r.projectName && r.projectName.toLowerCase().includes(arg)) || (r.projectId && r.projectId.toLowerCase().includes(arg))
          );
          if (reportMatch) {
            selectedProject = {
              id: reportMatch.projectId,
              name: reportMatch.projectName,
            };
          }
        }
      }

      if (!selectedProject) {
        let availableList = projects.map((p, idx) => `${NUMBER_EMOJIS[idx] || `[${idx + 1}]`} ${p.name}`).join('\n');
        await sendMessage(
          chatId,
          `⚠️ <b>Project "${escapeHtml(rawArg)}" not found.</b>\n\n` +
          `<b>Available Projects:</b>\n` +
          availableList + '\n\n' +
          `<i>Reply <code>/team &lt;project name or number&gt;</code> or <code>/team all</code></i>`
        );
        return;
      }
    } else {
      const activeProjName = profile.projectName || 'Banking SuperApp';
      const activeProjId = profile.projectId || 'prj-banking';
      selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
        id: activeProjId,
        name: activeProjName,
      };
    }

    const projReports = allReports.filter(
      (r) => r.projectId === selectedProject.id || (r.projectName && r.projectName.toLowerCase() === selectedProject.name.toLowerCase())
    );
    const dedupedReports = deduplicateMemberReports(projReports);
    const projBlockers = allBlockers.filter(
      (b) => b.projectId === selectedProject.id || (b.projectName && b.projectName.toLowerCase() === selectedProject.name.toLowerCase())
    );

    let teamMsg = formatTeamProgressText(selectedProject, dedupedReports, projBlockers, { isAllView: false });

    teamMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    teamMsg += `💡 <b>Quick Navigation:</b>\n`;
    teamMsg += `• View active QA risks: <code>/risks</code>\n`;
    teamMsg += `• Detailed standup rollup: <code>/report</code>\n`;
    teamMsg += `• View all projects: <code>/team all</code>\n`;
    teamMsg += `• Switch active project: <code>/project</code>\n`;

    await sendLongMessage(chatId, teamMsg);
    return;
  }

  // /risks Command for QA Lead (view QA risks, blockers & defect exposures)
  if (text === '/risks' || text.startsWith('/risks ') || text === '/risk' || text.startsWith('/risk ') || text === '/qarisk' || text.startsWith('/qarisk ')) {
    const isLead = isQALead(profile);

    if (!isLead) {
      await sendMessage(
        chatId,
        `⚠️ <b>Access Restricted: QA Lead Only</b>\n\n` +
        `The <code>/risks</code> command provides release risk exposure, blockers, and defect metrics and is reserved for <b>QA Leads</b>.\n\n` +
        `👤 <b>Your Current Profile:</b>\n` +
        `• Name: ${escapeHtml(profile ? profile.fullName : 'QA Member')}\n` +
        `• Role: <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n` +
        `• Project: ${escapeHtml(profile ? profile.projectName : 'None')}\n\n` +
        `💡 <i>If you are the QA Lead, reply with:</i>\n` +
        `<code>/role QA Lead</code> to update your role, or <code>/register</code> to re-configure.`
      );
      return;
    }

    const rawArg = rawText.replace(/^\/(risks|risk|qarisk)\s*/i, '').trim();
    const arg = rawArg.toLowerCase();
    const projects = await refreshProjectsFromCloud();
    const allReports = await fetchDailyReports();
    const allBlockers = await fetchProjectBlockers();
    const todayStr = new Date().toISOString().split('T')[0];

    // CASE 1: /risks all
    if (arg === 'all') {
      let fullMsg = `⚠️ <b>QA LEAD - ALL PROJECTS RISK OVERVIEW</b>\n`;
      fullMsg += `📅 <b>Date:</b> <code>${todayStr}</code>\n\n`;

      for (const proj of projects) {
        const projReports = allReports.filter(
          (r) => r.projectId === proj.id || (r.projectName && r.projectName.toLowerCase() === proj.name.toLowerCase())
        );
        const deduped = deduplicateMemberReports(projReports);
        const projBlockers = allBlockers.filter(
          (b) => b.projectId === proj.id || (b.projectName && b.projectName.toLowerCase() === proj.name.toLowerCase())
        );
        const projBugs = await fetchProjectBugs(proj.id);

        fullMsg += `==============================\n`;
        fullMsg += formatQARisksText(proj, projBlockers, deduped, projBugs, { isAllView: true }) + '\n';
      }

      fullMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      fullMsg += `💡 <i>Detailed project risks: <code>/risks &lt;name or number&gt;</code> • Team status: <code>/team</code></i>`;

      await sendLongMessage(chatId, fullMsg);
      return;
    }

    // CASE 2: Specific Project or Active Project
    let selectedProject = null;

    if (rawArg) {
      const num = parseInt(rawArg, 10);
      if (!isNaN(num) && num >= 1 && num <= projects.length) {
        selectedProject = projects[num - 1];
      } else {
        selectedProject = projects.find(
          (p) => p.name.toLowerCase() === arg || p.id.toLowerCase() === arg
        ) || projects.find(
          (p) => p.name.toLowerCase().includes(arg) || p.id.toLowerCase().includes(arg)
        );

        if (!selectedProject) {
          const reportMatch = allReports.find(
            (r) => (r.projectName && r.projectName.toLowerCase().includes(arg)) || (r.projectId && r.projectId.toLowerCase().includes(arg))
          );
          if (reportMatch) {
            selectedProject = {
              id: reportMatch.projectId,
              name: reportMatch.projectName,
            };
          }
        }
      }

      if (!selectedProject) {
        let availableList = projects.map((p, idx) => `${NUMBER_EMOJIS[idx] || `[${idx + 1}]`} ${p.name}`).join('\n');
        await sendMessage(
          chatId,
          `⚠️ <b>Project "${escapeHtml(rawArg)}" not found.</b>\n\n` +
          `<b>Available Projects:</b>\n` +
          availableList + '\n\n' +
          `<i>Reply <code>/risks &lt;project name or number&gt;</code> or <code>/risks all</code></i>`
        );
        return;
      }
    } else {
      const activeProjName = profile.projectName || 'Banking SuperApp';
      const activeProjId = profile.projectId || 'prj-banking';
      selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
        id: activeProjId,
        name: activeProjName,
      };
    }

    const projReports = allReports.filter(
      (r) => r.projectId === selectedProject.id || (r.projectName && r.projectName.toLowerCase() === selectedProject.name.toLowerCase())
    );
    const dedupedReports = deduplicateMemberReports(projReports);
    const projBlockers = allBlockers.filter(
      (b) => b.projectId === selectedProject.id || (b.projectName && b.projectName.toLowerCase() === selectedProject.name.toLowerCase())
    );
    const projBugs = await fetchProjectBugs(selectedProject.id);

    let risksMsg = formatQARisksText(selectedProject, projBlockers, dedupedReports, projBugs, { isAllView: false });

    risksMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    risksMsg += `💡 <b>Quick Actions:</b>\n`;
    risksMsg += `• Resolve blockers: <code>/resolve</code>\n`;
    risksMsg += `• View team daily report: <code>/team</code>\n`;
    risksMsg += `• View all project risks: <code>/risks all</code>\n`;
    risksMsg += `• Switch active project: <code>/project</code>\n`;

    await sendLongMessage(chatId, risksMsg);
    return;
  }

  // /role Command to view or switch role
  if (text === '/role') {
    await sendMessage(
      chatId,
      `👤 <b>QA Role Management</b>\n\n` +
      `• <b>Your Current Role:</b> <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n\n` +
      `To change your role, reply:\n` +
      `• <code>/role QA Lead</code>\n` +
      `• <code>/role QA Engineer / Tester</code>\n` +
      `• <code>/role Automation QA Engineer</code>\n` +
      `• <code>/role Manual / Performance QA</code>\n\n` +
      `<i>QA Leads have access to <code>/team</code>, <code>/report</code>, and <code>/risks</code>.</i>`
    );
    return;
  }

  if (text.startsWith('/role ')) {
    let newRole = rawText.replace(/^\/role\s+/i, '').trim();
    if (newRole === '1') newRole = DEFAULT_ROLES[0];
    else if (newRole === '2') newRole = DEFAULT_ROLES[1];
    else if (newRole === '3') newRole = DEFAULT_ROLES[2];
    else if (newRole === '4') newRole = DEFAULT_ROLES[3];

    saveProfile(chatId, {
      fullName: profile ? profile.fullName : (user.first_name || 'QA Tester'),
      role: newRole,
      projectId: profile ? profile.projectId : 'prj-banking',
      projectName: profile ? profile.projectName : 'Banking SuperApp',
    });

    const isNowLead = isQALead({ role: newRole });

    await sendMessage(
      chatId,
      `✅ <b>Role Updated!</b>\n\n` +
      `Your role is now set to: <b>${escapeHtml(newRole)}</b>.\n\n` +
      (isNowLead
        ? `🎉 <b>QA Lead Privileges Activated!</b>\nYou now have access to:\n• <code>/team</code> — Team daily report & progress\n• <code>/report</code> — Detailed standup rollup\n• <code>/risks</code> — View active QA risks & blockers`
        : `You can submit your daily updates using <code>/checkin</code>.`)
    );
    return;
  }

  // Fallback
  const isLead = isQALead(profile);
  const fallbackMsg = isLead
    ? `I didn't recognize that command.\n` +
      `• Type /team to view team daily report & progress\n` +
      `• Type /report to view detailed standup rollup\n` +
      `• Type /risks to view QA risks & blockers\n` +
      `• Type /project to change project\n` +
      `• Type /role to update your role\n` +
      `• Type /help for all commands.`
    : `I didn't recognize that command.\n` +
      `• Type /checkin to start your daily standup\n` +
      `• Type /project to change project\n` +
      `• Type /role to update your role\n` +
      `• Type /profile to view your profile\n` +
      `• Type /help for all commands.`;

  await sendMessage(chatId, fallbackMsg);
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
          try {
            await handleMessage(update.message);
          } catch (handlerErr) {
            console.error('[Message Handler Error]', handlerErr);
          }
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

// Sync Telegram commands for bot menu (/ command autocomplete)
async function syncTelegramCommands(chatId = null, role = null) {
  try {
    const isLead = role && (role.toLowerCase().includes('lead') || role.toLowerCase().includes('manager'));

    if (chatId) {
      const commands = isLead ? [
        { command: 'status', description: 'Overall QA & project readiness' },
        { command: 'team', description: 'Team members and their current status' },
        { command: 'project', description: 'Manage and switch active QA project' },
        { command: 'blocker', description: 'View or report blockers' },
        { command: 'resolve', description: 'Resolve active blockers' },
        { command: 'risks', description: 'View QA risks & defect exposures' },
        { command: 'report', description: 'Generate daily/weekly QA reports' },
        { command: 'profile', description: 'View and update profile' },
        { command: 'role', description: 'View or switch QA role' },
        { command: 'help', description: 'Show all commands' },
        { command: 'cancel', description: 'Cancel current operation' },
      ] : [
        { command: 'checkin', description: 'Submit daily QA standup' },
        { command: 'project', description: 'Switch active QA project' },
        { command: 'blocker', description: 'Report urgent blocker' },
        { command: 'resolve', description: 'Resolve active blocker' },
        { command: 'profile', description: 'View and update profile' },
        { command: 'status', description: 'View relevant QA status' },
        { command: 'role', description: 'View or switch QA role' },
        { command: 'help', description: 'Show all commands' },
        { command: 'cancel', description: 'Cancel current operation' },
      ];

      await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands,
          scope: { type: 'chat', chat_id: String(chatId) },
        }),
      });
    } else {
      const defaultCommands = [
        { command: 'checkin', description: 'Submit daily QA standup' },
        { command: 'status', description: 'View relevant QA status' },
        { command: 'project', description: 'Switch active QA project' },
        { command: 'blocker', description: 'Report urgent blocker' },
        { command: 'resolve', description: 'Resolve active blocker' },
        { command: 'profile', description: 'View and update profile' },
        { command: 'role', description: 'View or switch QA role' },
        { command: 'help', description: 'Show all commands' },
        { command: 'cancel', description: 'Cancel current operation' },
      ];

      await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: defaultCommands,
          scope: { type: 'default' },
        }),
      });
    }
  } catch (err) {
    console.error('[syncTelegramCommands Error]', err.message);
  }
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

    // Register Telegram command menus
    console.log('✓ Registering Telegram command menus...');
    await syncTelegramCommands();
    const existingProfiles = loadProfiles();
    for (const [cId, prof] of Object.entries(existingProfiles)) {
      await syncTelegramCommands(cId, prof.role);
    }
    console.log(`✓ Synchronized command menus for ${Object.keys(existingProfiles).length} user profiles.`);

    console.log('✓ Listening for messages, onboarding, /project, and /checkin...\n');

    pollUpdates();
  } catch (err) {
    console.error('❌ Network error connecting to Telegram API:', err.message);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('telegramQABot.js') || process.argv[1].endsWith('telegramQABot'));
if (isDirectRun) {
  init();
}

export {
  isQALead,
  parseBugCounts,
  fetchDailyReports,
  fetchProjectBlockers,
  fetchProjectBugs,
  deduplicateMemberReports,
  formatProjectReportText,
  formatTeamProgressText,
  formatQARisksText,
  formatQALeadStatusText,
  formatQAMemberStatusText,
  makeProgressBar,
  sendLongMessage,
  syncTelegramCommands,
  findQALeadsForProject,
  notifyQALeadsOfBlocker,
  notifyQALeadsOfStandupIssue,
  notifyQALeadsOfBlockerResolved,
};
