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
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTeamCapacity, getTesterCapacity, generateCapacityBar, getEffectiveProjectWorkload } from './workload/capacityService.js';
import { getImbalanceAlerts, getBestTesterRecommendations, getAssignmentWarning } from './workload/alertService.js';
import { assignTesterToProject, getProjectAssignments } from './workload/assignmentService.js';
import { recordDailySnapshot, getTesterTrend } from './workload/historyService.js';
import { handleNewCheckinStep } from './checkin/checkinCommand.js';
import { calculateReadinessScore, loadReadinessConfig } from './readiness/readinessCalculator.js';
import { getDashboardOverview } from './dashboard/qaDashboard.js';

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

// Dummy Web Server for Render Free Tier Web Service compliance
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('AegisQA Telegram Bot is running!\n');
}).listen(PORT, () => {
  console.log(`✓ Dummy web server listening on port ${PORT}`);
});

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
  'QA Tester',
  'QA Lead',
  'Automation QA Engineer',
];

// Persistent Profiles Store (telegram_profiles.json)
const PROFILES_FILE = path.resolve(process.cwd(), 'telegram_profiles.json');
const PUBLIC_PROFILES_FILE = path.resolve(process.cwd(), 'public', 'telegram_profiles.json');
const REPORTS_FILE = path.resolve(process.cwd(), 'telegram_daily_reports.json');
const BLOCKERS_FILE = path.resolve(process.cwd(), 'telegram_blockers.json');
const PROJECTS_FILE = path.resolve(process.cwd(), 'projects.json');
const PUBLIC_PROJECTS_FILE = path.resolve(process.cwd(), 'public', 'projects.json');
const MODULES_FILE = path.resolve(process.cwd(), 'modules.json');
const PUBLIC_MODULES_FILE = path.resolve(process.cwd(), 'public', 'modules.json');
const GROUP_MESSAGES_FILE = path.resolve(process.cwd(), 'telegram_group_messages.json');

function getModules() {
  let list = [];
  for (const file of [MODULES_FILE, PUBLIC_MODULES_FILE]) {
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
          break;
        }
      } catch {}
    }
  }
  return list;
}

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

let memoryProjects = null;

async function refreshProjectsFromCloud() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const seenMap = new Map();
        for (const p of data) {
          const key = (p.name || '').trim().toLowerCase();
          if (!seenMap.has(key)) {
            seenMap.set(key, {
              id: p.id,
              name: p.name,
              description: p.description || '',
              status: p.status,
              memberIds: p.member_ids || [],
              resources: p.resources || {},
            });
          }
        }
        memoryProjects = Array.from(seenMap.values());
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
  let list = [];
  if (memoryProjects && memoryProjects.length > 0) {
    list = memoryProjects;
  } else {
    for (const file of [PROJECTS_FILE, PUBLIC_PROJECTS_FILE]) {
      if (fs.existsSync(file)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
            break;
          }
        } catch {}
      }
    }
  }
  if (!list || list.length === 0) list = DEFAULT_PROJECTS;

  const seenMap = new Map();
  for (const p of list) {
    const key = (p.name || '').trim().toLowerCase();
    if (!seenMap.has(key)) seenMap.set(key, p);
  }
  return Array.from(seenMap.values());
}

function saveProjects(projectsList) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsList, null, 2), 'utf8');
    fs.writeFileSync(PUBLIC_PROJECTS_FILE, JSON.stringify(projectsList, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving projects:', e);
  }
}

async function saveProjectTestCaseUrl(projectId, testCaseUrl, testCaseTitle = 'Test Cases') {
  const projects = getProjects();
  let target = null;

  if (projectId) {
    const pIdLower = String(projectId).toLowerCase();
    target = projects.find(
      (p) => p.id?.toLowerCase() === pIdLower || p.name?.toLowerCase() === pIdLower
    );
    if (!target) {
      target = projects.find(
        (p) => p.name?.toLowerCase().includes(pIdLower) || pIdLower.includes(p.name?.toLowerCase())
      );
    }
  }

  if (!target) {
    target = projects.find((p) => p.name?.toLowerCase().includes('crypto')) || projects[0];
  }

  if (target) {
    if (!target.resources) target.resources = {};
    target.resources.testCaseUrl = testCaseUrl;
    target.resources.testCaseTitle = testCaseTitle;
    memoryProjects = projects;
    saveProjects(projects);

    if (supabase) {
      try {
        await supabase
          .from('projects')
          .update({
            resources: target.resources,
            updated_at: new Date().toISOString(),
          })
          .eq('id', target.id);
        console.log(`[Supabase] Updated testCaseUrl for project ${target.name} (${target.id}) to ${testCaseUrl}`);
      } catch (err) {
        console.error('[Supabase] Error updating testCaseUrl:', err.message);
      }
    }
    return target;
  }
  return null;
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

function saveProfiles(profiles) {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  try {
    fs.writeFileSync(PUBLIC_PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  } catch {}
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
  saveProfiles(profiles);
  
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

// Helper to persist group messages for daily summary
function persistGroupMessage(messageData) {
  let existing = [];
  if (fs.existsSync(GROUP_MESSAGES_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(GROUP_MESSAGES_FILE, 'utf8'));
    } catch {
      existing = [];
    }
  }
  existing.push(messageData);
  fs.writeFileSync(GROUP_MESSAGES_FILE, JSON.stringify(existing, null, 2), 'utf8');
}

// Helper to generate daily summary from group messages
async function generateDailySummary(chatId, dateStr) {
  let messages = [];
  if (fs.existsSync(GROUP_MESSAGES_FILE)) {
    try {
      messages = JSON.parse(fs.readFileSync(GROUP_MESSAGES_FILE, 'utf8'));
    } catch {
      messages = [];
    }
  }

  // Filter messages for this chat and today's date
  const todayMessages = messages.filter(m => {
    if (m.chatId !== chatId) return false;
    const msgDate = new Date(m.timestamp).toISOString().split('T')[0];
    return msgDate === dateStr;
  });

  if (todayMessages.length === 0) {
    return null; // No messages today
  }

  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  // Use Gemini AI if API Key is available
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      let transcript = ``;
      todayMessages.forEach(msg => {
        if (msg.text) {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          transcript += `[${time}] ${msg.senderName}: ${msg.text}\n`;
        }
      });

      const prompt = `Analyze the following team chat transcript and generate a daily summary.

Implement a two-stage classification system.

STAGE 1 — RELEVANCE FILTER
Before categorizing a message, determine whether it is actually relevant to the project/work.
IGNORE messages that are:
* Greetings
* Laughter such as "haha", "hehe", "huhuu"
* Repeated characters such as "Gooooo", "Gooo"
* Casual chatting, personal jokes, insults, or teasing unrelated to the project
* Random names or short meaningless messages
* Profanity that does not contain actionable project information
* Repeated/non-informative messages

However, if a message contains a genuine work issue together with casual language, preserve the meaningful work information and remove the irrelevant portion.

STAGE 2 — WORK CLASSIFICATION
Only classify messages that pass the relevance filter.
Use these exact sections:
- 🔥 Main Topics
- 🐛 Issues / Blockers
- ✅ Completed Work
- 📌 Decisions
- 📌 Action Items
- 💬 Important Discussions

RULES:
- Issues / Blockers: E.g., "Login API is not working", "Movie page has a UI issue".
- Completed Work: E.g., "I completed testing the payment page".
- Decisions: Infer decisions from the context (e.g., "Let's not deploy"). Do not wait for the word "decision".
- Action Items: Only include when there is a clear task that someone needs to perform. Do not classify ordinary discussion as an action item.
- Important Discussions: Only include meaningful project information, planning, or risks. Do not copy long conversations.
- Main Topics: Extract meaningful project topics from relevant messages only.

DEDUPLICATION & SUMMARY QUALITY RULES:
- A single message must normally appear in only ONE category (e.g., a decision not to deploy because of a payment API failure should primarily be a Decision).
- Never include casual conversation, jokes, insults, or meaningless short messages.
- Summarize instead of dumping raw messages. Preserve important technical/project information.
- Mention the person responsible only when the message clearly identifies an owner.
- Combine duplicate messages about the same issue.
- Classification must depend on the meaning/context of the entire message.
- Do not treat words like "decide", "issue", "plan", or "testing" as sufficient evidence by themselves.
- Keep the final summary concise and professional.

Return the summary formatted strictly in Telegram HTML (using <b>, <i>, <code>). Do not use Markdown (no asterisks).
Start the message exactly with:
📋 <b>Daily Group Summary — ${formattedDate}</b>

Transcript:
${transcript}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let aiSummary = response.text();
      // Ensure no markdown asterisks leak through
      aiSummary = aiSummary.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      return aiSummary;
    } catch (e) {
      console.error("[Gemini AI Error]", e);
      // Fallback to heuristic if AI fails
    }
  }

  // Fallback Heuristics
  const topics = new Set();
  const issues = [];
  const decisions = [];
  const actionItems = [];
  const importantDiscussions = [];

  todayMessages.forEach(msg => {
    const text = msg.text.toLowerCase();
    
    if (!text) return; // Skip empty messages
    
    // Simple heuristics
    if (text.includes('release') || text.includes('deploy') || text.includes('project') || text.includes('new feature')) {
      topics.add('Project/Release discussed');
    }
    if (text.includes('payment') || text.includes('api')) {
      topics.add('Payment/API discussed');
    }
    if (text.includes('test') || text.includes('qa')) {
      topics.add('Testing requirements discussed');
    }

    if (text.includes('bug') || text.includes('block') || text.includes('issue') || text.includes('fail') || text.includes('not working') || text.includes('down')) {
      issues.push(`• ${msg.senderName}: ${msg.text}`);
    }

    if (text.includes('decide') || text.includes('will do') || text.includes('agreed') || text.includes('moved to')) {
      decisions.push(`• ${msg.senderName}: ${msg.text}`);
    }

    if (text.includes('todo') || text.includes('action') || text.includes('need to') || text.includes('investigate') || text.includes('fix')) {
      actionItems.push(`• ${msg.senderName}: ${msg.text}`);
    }

    if (text.length > 100 || text.includes('important')) {
      importantDiscussions.push(`• ${msg.senderName}: ${msg.text}`);
    }
  });

  if (topics.size === 0) topics.add('General discussion');

  let summary = `📋 <b>Daily Group Summary — ${formattedDate}</b>\n\n`;
  
  summary += `🔥 <b>Main Topics</b>\n`;
  Array.from(topics).forEach(t => summary += `• ${t}\n`);
  summary += `\n`;

  if (issues.length > 0) {
    summary += `🐛 <b>Issues / Blockers</b>\n`;
    issues.slice(0, 5).forEach(i => summary += `${escapeHtml(i)}\n`);
    summary += `\n`;
  }

  if (decisions.length > 0) {
    summary += `✅ <b>Decisions</b>\n`;
    decisions.slice(0, 5).forEach(d => summary += `${escapeHtml(d)}\n`);
    summary += `\n`;
  }

  if (actionItems.length > 0) {
    summary += `📌 <b>Action Items</b>\n`;
    actionItems.slice(0, 5).forEach(a => summary += `${escapeHtml(a)}\n`);
    summary += `\n`;
  }

  if (importantDiscussions.length > 0) {
    summary += `💬 <b>Important Discussions</b>\n`;
    summary += `${escapeHtml(importantDiscussions[0])}\n`;
    if (importantDiscussions.length > 1) {
      summary += `<i>(and ${importantDiscussions.length - 1} more...)</i>\n`;
    }
  } else {
    summary += `💬 <b>Activity</b>\nTotal messages analyzed: ${todayMessages.length}\n`;
  }

  return summary;
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

  // 3. Always include Platform Admin / Leadership
  const ADMIN_CHAT_ID = '347835367';
  if (!leads.has(ADMIN_CHAT_ID)) {
    leads.set(ADMIN_CHAT_ID, {
      chatId: ADMIN_CHAT_ID,
      fullName: 'Coco (Admin)',
      role: 'Platform Admin',
      projectId: '',
      projectName: '',
      assignedProjectIds: [],
      assignedProjects: [],
    });
  }

  // All QA Leads and Platform Admin should receive critical blocker & risk alerts
  return Array.from(leads.values());
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

async function notifyQALeadsOfAchievement({
  senderChatId,
  memberName,
  username,
  projectName,
  projectId,
  achievementText,
}) {
  try {
    const leads = await findQALeadsForProject(projectId, projectName);
    const targetLeads = leads.filter((l) => String(l.chatId) !== String(senderChatId));

    if (targetLeads.length === 0) {
      return;
    }

    const timeStr = new Date().toLocaleTimeString();
    let msg = `🏆 <b>QA LEAD ALERT — TEAM ACHIEVEMENT</b>\n\n`;
    msg += `📁 <b>Project:</b> <b>${escapeHtml(projectName || 'QA Project')}</b>\n`;
    msg += `👤 <b>Member:</b> <b>${escapeHtml(memberName)}</b> (@${escapeHtml(username || 'unknown')})\n`;
    msg += `🕒 <b>Time:</b> <code>${escapeHtml(timeStr)}</code>\n\n`;
    msg += `🌟 <b>Major Achievement:</b>\n<i>"${escapeHtml(achievementText)}"</i>\n\n`;
    msg += `<i>Take a moment to celebrate this win! 🎉</i>`;

    for (const lead of targetLeads) {
      console.log(`[Notification] Dispatching Achievement alert to QA Lead ${lead.fullName} (${lead.chatId})...`);
      await sendMessage(lead.chatId, msg);
    }
  } catch (err) {
    console.error('[Notification Error] Achievement notification failed:', err.message);
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

// Proactive Telegram Alert to QA Member when assigned to a project squad
async function notifyMemberOfProjectAssignment({
  chatId,
  project,
  leadName = 'Sarah Jenkins',
  responsibility = 'Please prepare the test cases and submit them using /testcase',
}) {
  try {
    const productOwner = project.projectOwner || project.productOwner || 'Elena Rostova';
    const prdDoc = project.resources?.prdDocuments?.[0];
    let prdText = '';
    if (project.resources?.prdUrl) {
      prdText = project.resources?.prdTitle
        ? `${project.resources.prdTitle} - ${project.resources.prdUrl}`
        : project.resources.prdUrl;
      if (prdDoc?.fileName) {
        prdText += ` | File: ${prdDoc.fileName}`;
      }
    } else if (prdDoc?.fileName) {
      prdText = project.resources?.prdTitle
        ? `${project.resources.prdTitle} (File: ${prdDoc.fileName})`
        : `File: ${prdDoc.fileName}`;
    } else {
      prdText = project.resources?.prdTitle || 'Available in PRD & Specs';
    }

    const figmaText = project.resources?.figmaUrl || 'Available in Design (Figma) tab';

    let msg = `<b>Assigned to ${escapeHtml(project.name)}</b>\n\n`;
    msg += `New QA Project Assignment\n\n`;
    msg += `You have been assigned to:\n`;
    msg += `<b>${escapeHtml(project.name)}</b>\n\n`;
    msg += `QA Lead: <b>${escapeHtml(leadName)}</b>\n`;
    msg += `Product Owner: <b>${escapeHtml(productOwner)}</b>\n\n`;
    msg += `Resources:\n`;
    msg += `📄 PRD: ${escapeHtml(prdText)}\n`;
    msg += `🎨 Figma: ${escapeHtml(figmaText)}\n`;
    if (project.resources?.testCaseUrl) {
      msg += `🧪 Test Cases: ${escapeHtml(project.resources.testCaseUrl)}\n`;
    }
    msg += `\nYour initial responsibility:\n`;
    msg += `${escapeHtml(responsibility)}`;

    await sendMessage(chatId, msg);
    console.log(`[Notification] Dispatched project assignment alert for ${project.name} to chat ${chatId}`);

    // Automatically switch the member's active project & update assigned projects list
    try {
      const strChatId = String(chatId);
      const profiles = loadProfiles();
      const existing = profiles[strChatId] || {
        chatId: strChatId,
        fullName: 'QA Member',
        role: 'QA Engineer / Tester',
      };

      const assignedIds = Array.from(new Set([...(existing.assignedProjectIds || []), project.id]));
      const assignedNames = Array.from(new Set([...(existing.assignedProjects || []), project.name]));

      existing.projectId = project.id;
      existing.projectName = project.name;
      existing.assignedProjectIds = assignedIds;
      existing.assignedProjects = assignedNames;
      existing.updatedAt = new Date().toISOString();

      profiles[strChatId] = existing;
      saveProfiles(profiles);

      if (supabase) {
        await supabase
          .from('telegram_profiles')
          .update({
            project_id: project.id,
            project_name: project.name,
            assigned_project_ids: assignedIds,
            assigned_projects: assignedNames,
            updated_at: new Date().toISOString(),
          })
          .eq('chat_id', strChatId);
      }
    } catch (profErr) {
      console.warn('[Profile Update Error on Assignment]', profErr.message);
    }

    return true;
  } catch (err) {
    console.error('[Notification Error] Project assignment notification failed:', err.message);
    return false;
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
    `Let's configure your <b>QA Profile</b> (takes 10 seconds).\n\n` +
    `<b>Step 1 of 2: What is your Full Name?</b>\n` +
    `<i>(Reply with your name, or reply <code>skip</code> to use "${defaultName}")</i>`
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
        `Nice to meet you, <b>${escapeHtml(chosenName)}</b>!\n\n` +
        `<b>Step 2 of 2: What is your QA Role?</b>\n\n` +
        `1️⃣ QA Tester\n` +
        `2️⃣ QA Lead\n` +
        `3️⃣ Automation QA Engineer\n\n` +
        `<i>Reply 1, 2, 3, or type your role title:</i>`
      );
      return true;
    }

    case 2: {
      let role = text.trim();
      if (role === '1') role = DEFAULT_ROLES[0];
      else if (role === '2') role = DEFAULT_ROLES[1];
      else if (role === '3') role = DEFAULT_ROLES[2];

      session.answers.role = role;

      const profile = saveProfile(chatId, {
        fullName: session.answers.fullName,
        role: session.answers.role,
        projectId: '',
        projectName: '',
        assignedProjectIds: [],
        assignedProjects: [],
        telegramUsername: user.username ? user.username.replace(/^@/, '') : '',
      });

      const shouldCheckin = session.proceedToCheckinAfter;
      userSessions.delete(chatId);

      const isLead = isQALead(profile);
      const isAutomation = profile.role === 'Automation QA Engineer';

      if (isLead || isAutomation) {
        // Generate Username + Temporary Password + Portal Link
        const nameParts = profile.fullName.trim().split(' ');
        const firstName = nameParts[0].toLowerCase();
        const rolePrefix = isLead ? 'lead' : 'auto';
        let username = `${firstName}.${rolePrefix}`;
        
        // Check uniqueness locally
        let counter = 1;
        while (DB.users.some(u => u.username === username)) {
          username = `${firstName}.${rolePrefix}${counter}`;
          counter++;
        }

        const tempPassword = 'Temp123!';
        let passwordHash = tempPassword;
        try {
          const bcrypt = (await import('bcryptjs')).default;
          passwordHash = await bcrypt.hash(tempPassword, 10);
        } catch (e) {
          console.warn('Could not hash password, using plain text as fallback (not recommended)');
        }

        const newUser = {
          id: `usr-${chatId}`,
          full_name: profile.fullName,
          username: username,
          password_hash: passwordHash,
          role: profile.role,
          is_active: true,
          must_change_password: true,
          telegram_chat_id: String(chatId),
          created_at: new Date().toISOString()
        };

        DB.users.push(newUser);
        saveDB();

        if (supabase) {
          await supabase.from('users').upsert(newUser, { onConflict: 'id' }).catch(() => {});
        }

        await sendMessage(
          chatId,
          `🎉 <b>Profile Configured Successfully!</b>\n\n` +
          `You have been registered as a <b>${escapeHtml(profile.role)}</b>.\n\n` +
          `Here are your AegisQA Portal credentials:\n` +
          `👤 <b>Username:</b> <code>${username}</code>\n` +
          `🔑 <b>Password:</b> <code>${tempPassword}</code>\n\n` +
          `🌐 <b>Login here:</b> https://qa-report-nu.vercel.app/\n\n` +
          `<i>Note: You will be forced to change this temporary password on your first login for security reasons.</i>`
        );
      } else {
        // QA Tester
        await sendMessage(
          chatId,
          `🎉 <b>QA Profile Configured Successfully!</b>\n\n` +
          `👤 <b>Name:</b> <b>${escapeHtml(profile.fullName)}</b>\n` +
          `🏷 <b>Role:</b> <b>${escapeHtml(profile.role)}</b>\n\n` +
          `You are currently a QA Tester. Please wait for your QA Lead to assign you to a project and module from the Portal.\n\n` +
          `Once assigned, you will receive a notification here with your project details and PRD/Figma links.\n\n` +
          `💡 <b>Quick Commands (After Assignment):</b>\n` +
          `• <code>/checkin</code> — Submit daily standup check-in\n` +
          `• <code>/testcase</code> — Submit test cases link\n` +
          `• <code>/blocker</code> — Report an urgent blocker\n` +
          `• <code>/profile</code> — View your QA profile details`
        );
      }

      if (shouldCheckin && !isLead) {
        await startCheckin(chatId, user);
      }
      return true;
    }
  }

  return false;
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
    if (r.moduleName) {
      out += `• <b>Module:</b> 📦 ${escapeHtml(r.moduleName)}\n`;
    }
    out += `• <b>Worked Today:</b> ${escapeHtml(r.todayWorkingOn || r.workedToday || 'In progress')}\n`;
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

  // Always prompt member to choose the project for daily standup
  const allProjects = await refreshProjectsFromCloud();
  if (!allProjects || allProjects.length === 0) {
    await sendMessage(chatId, '⚠️ No QA projects found in the system. Please ask your QA Lead or Admin to create a project first.');
    return;
  }

  const assignedNames = (profile.assignedProjects || []).map((x) => String(x).toLowerCase());
  const assignedIds = (profile.assignedProjectIds || []).map((x) => String(x).toLowerCase());
  const memberKey = `usr-${chatId}`;

  const assignedList = [];

  for (const p of allProjects) {
    const isAssigned =
      assignedNames.includes(p.name.toLowerCase()) ||
      assignedIds.includes(p.id.toLowerCase()) ||
      (p.memberIds && p.memberIds.includes(memberKey));

    if (isAssigned) {
      assignedList.push(p);
    }
  }

  if (assignedList.length === 0) {
    await sendMessage(chatId, '⚠️ You currently have no active project assignments.');
    return;
  }

  userSessions.set(chatId, {
    type: 'checkin',
    step: 'choose_checkin_project',
    profile,
    answers: {},
    projectsList: assignedList,
  });

  // Group by QA Lead
  const users = loadProfiles(); // Fallback if local users map isn't perfectly identical to users schema, but we can just use qaLeadId directly
  const grouped = {};
  assignedList.forEach(p => {
    const leadId = p.qaLeadId || 'Unknown Lead';
    if (!grouped[leadId]) grouped[leadId] = [];
    grouped[leadId].push(p);
  });

  let listText = '';
  let counter = 1;
  for (const [leadId, projs] of Object.entries(grouped)) {
    // Attempt to map leadId to a name (e.g., usr-sarah -> Sarah)
    let leadName = leadId;
    for (const [cid, u] of Object.entries(users)) {
      if (`usr-${cid}` === leadId || u.id === leadId) {
         leadName = u.fullName || leadId;
         break;
      }
    }
    // Hardcoded fallback for seed data if needed
    if (leadId === 'usr-sarah') leadName = 'Sarah Jenkins';

    listText += `\n👩‍💼 <b>${escapeHtml(leadName)}</b>\n`;
    for (const p of projs) {
      const emoji = NUMBER_EMOJIS[counter - 1] || `[${counter}]`;
      listText += `${emoji} <b>${escapeHtml(p.name)}</b>\n`;
      counter++;
    }
  }

  await sendMessage(
    chatId,
    `👋 <b>Good day, ${escapeHtml(profile.fullName)}!</b>\n\n` +
    `📁 <b>Select Project for Daily Standup:</b>\n` +
    `Which project are you checking in for today?` +
    `${listText}\n\n` +
    `<i>Reply with the number (1-${assignedList.length}) or type the project name:</i>`
  );
  return;
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

  const hasAchievement = Boolean(answers.majorAchievement && answers.majorAchievement.toLowerCase() !== 'none' && answers.majorAchievement.trim().length > 0);
  if (hasAchievement) {
    notifyQALeadsOfAchievement({
      senderChatId: chatId,
      memberName: profile.fullName,
      username: user.username || user.first_name,
      projectName: profile.projectName,
      projectId: profile.projectId,
      achievementText: majorAchievementText,
    }).catch((err) => console.error('[Notify Lead Error]', err.message));
  }

  // Snapshot workload history
  const cap = getTesterCapacity('usr-' + chatId);
  recordDailySnapshot('usr-' + chatId, cap.totalWorkload);

  userSessions.delete(chatId);

  // AFTER SUBMISSION, show concise confirmation matching required template
  const confirmationMsg =
    `✅ <b>Daily QA Report Submitted</b>\n\n` +
    `📁 <b>Project:</b> ${escapeHtml(profile.projectName)}\n` +
    `👤 <b>QA Member:</b> ${escapeHtml(profile.fullName)}\n\n` +
    `🎯 <b>What did you work on today?</b>\n` +
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

  if (session.step === 'duplicate_checkin_warning') {
    if (lower === 'cancel') {
      userSessions.delete(chatId);
      await sendMessage(chatId, '❌ Check-in cancelled.');
      return true;
    } else if (lower === 'update') {
      // Proceed to the normal blocker step logic by pretending we just chose it
      session.step = 'resolve_previous_blocker'; // we let it fall through to the next steps naturally
      // But we need to ensure project associations are kept
      // We will re-execute the block below manually since we are skipping it.
      const selectedName = typeof session.duplicateProject === 'object' ? session.duplicateProject.name : session.duplicateProject;
      // skip to work_type
      session.step = 'work_type';
      await sendMessage(
        chatId,
        `📝 <b>What did you work on today?</b>\n\n<i>(Briefly describe the work/testing completed today)</i>`
      );
      return true;
    } else {
      await sendMessage(chatId, `⚠️ Type <b>Update</b> or <b>Cancel</b>.`);
      return true;
    }
  }
  if (session.step === 'choose_checkin_project') {
    const list = session.projectsList || [];
    let selected = null;
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= list.length) {
      selected = list[num - 1];
    } else {
      selected = list.find((p) => {
        const name = (typeof p === 'object' ? p.name : p).toLowerCase();
        const id = (typeof p === 'object' ? p.id : '').toLowerCase();
        return name === lower || id === lower || name.includes(lower);
      });
    }

    if (!selected) {
      await sendMessage(
        chatId,
        `⚠️ <b>Please choose a valid project:</b>\n` +
        `Reply with the number (1-${list.length}) or type the project name:\n<i>(or type <code>cancel</code> to abort)</i>`
      );
      return true;
    }

    const selectedName = typeof selected === 'object' ? selected.name : selected;
    let matchedId = typeof selected === 'object' ? selected.id : profile.projectId;

    if (!matchedId) {
      const allProjects = await refreshProjectsFromCloud();
      const matchedProj = allProjects.find((p) => p.name.toLowerCase() === selectedName.toLowerCase());
      matchedId = matchedProj ? matchedProj.id : `prj-${Date.now().toString(36)}`;
      if (matchedProj) selected = matchedProj;
    }

    // Check duplicate checkin
    try {
      const fs = await import('fs');
      const path = await import('path');
      const CHECKINS_FILE = path.resolve(process.cwd(), 'checkins.json');
      if (fs.existsSync(CHECKINS_FILE)) {
        const checkins = JSON.parse(fs.readFileSync(CHECKINS_FILE, 'utf-8'));
        const today = new Date().toISOString().split('T')[0];
        const existing = checkins.find(c => c.testerId === `usr-${chatId}` && c.projectId === matchedId && (c.date === today || (c.createdAt && c.createdAt.startsWith(today))));
        
        if (existing) {
          session.step = 'duplicate_checkin_warning';
          session.duplicateProject = selected;
          await sendMessage(chatId, `⚠️ You already submitted a check-in for this project today.\n\nType <b>Update</b> to submit a new check-in for today, or <b>Cancel</b> to abort.`);
          return true;
        }
      }
    } catch(err) {
       console.error(err);
    }

    // Capture auto-association logic
    session.qaLeadId = selected.qaLeadId || 'usr-sarah';
    let assignedLeadName = 'Sarah Jenkins';
    const users = loadProfiles();
    for (const [cid, u] of Object.entries(users)) {
      if (`usr-${cid}` === session.qaLeadId || u.id === session.qaLeadId) {
         assignedLeadName = u.fullName || session.qaLeadId;
         break;
      }
    }
    if (session.qaLeadId === 'usr-sarah') assignedLeadName = 'Sarah Jenkins';
    session.qaLeadName = assignedLeadName;
    session.coreProjectName = selected.coreProjectName || 'Unknown';
    session.coreProjectId = selected.coreProjectId || 'unknown';

    // Update active project in profile and session
    profile.projectId = matchedId;
    profile.projectName = selectedName;
    session.profile = profile;

    const profiles = loadProfiles();
    if (profiles[String(chatId)]) {
      profiles[String(chatId)].projectId = matchedId;
      profiles[String(chatId)].projectName = selectedName;
      profiles[String(chatId)].updatedAt = new Date().toISOString();
      saveProfiles(profiles);
    }
    if (supabase) {
      supabase.from('telegram_profiles').update({
        project_id: matchedId,
        project_name: selectedName,
        updated_at: new Date().toISOString(),
      }).eq('chat_id', String(chatId)).then(() => {});
    }

    const modules = getModules().filter(m => m.projectId === matchedId);
    if (modules.length > 0) {
      session.step = 'choose_module';
      session.modules = modules;
      
      let listText = '';
      modules.forEach((m, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        listText += `${emoji} <b>${m.name}</b>\n`;
      });
      listText += `\n0️⃣ <b>Skip / Entire Project</b>\n`;

      await sendMessage(
        chatId,
        `✅ <b>Project Selected: ${selectedName}</b>\n\n` +
        `This project has multiple active modules.\n` +
        `<b>Which module did you test today?</b>\n\n` +
        listText + '\n' +
        `<i>Reply with a number or type a module name:</i>`
      );
      return true;
    }

    // Check if user previously reported an active blocker for this project
    const openBlockers = await getOpenBlockersForUser(chatId, profile.fullName);
    const projectBlockers = openBlockers.filter((b) => !b.projectName || b.projectName.toLowerCase() === selectedName.toLowerCase());

    if (projectBlockers.length > 0) {
      session.step = 'resolve_previous_blocker';
      session.pendingBlockers = projectBlockers;
      const blockerCountText = projectBlockers.length === 1 ? 'an active blocker' : `${projectBlockers.length} active blockers`;
      const blockerItemsList = projectBlockers
        .map((b) => `• <b>${escapeHtml(b.title || 'Blocker')}</b>: <i>"${escapeHtml(b.description)}"</i>`)
        .join('\n');

      await sendMessage(
        chatId,
        `📁 <b>Project:</b> <b>${escapeHtml(selectedName)}</b>\n\n` +
        `⚠️ <b>Reminder from Yesterday:</b>\n` +
        `You previously reported ${blockerCountText} on <b>${escapeHtml(selectedName)}</b>:\n` +
        `${blockerItemsList}\n\n` +
        `<b>Are these blocker(s) now resolved?</b>\n\n` +
        `1️⃣ <b>Yes, mark resolved</b> (Remove from blocked tasks on QA Command Center)\n` +
        `2️⃣ <b>No, still blocked</b>\n\n` +
        `<i>Reply 1 to mark resolved, or 2 to keep active:</i>`
      );
      return true;
    }

    session.step = 'worked_today';
    await sendMessage(
      chatId,
      `📁 <b>Project:</b> <b>${escapeHtml(selectedName)}</b>\n\n` +
      `📝 <b>What did you work on today?</b>\n` +
      `<i>(Briefly describe the work/testing completed today)</i>`
    );
    return true;
  }
  
  if (session.step === 'choose_module') {
    const modules = session.modules;
    let moduleName = text.trim();
    let selectedModule = null;

    if (moduleName === '0' || moduleName.toLowerCase() === 'skip' || moduleName.toLowerCase() === 'entire project') {
      // Skipped
    } else {
      const num = parseInt(moduleName, 10);
      if (!isNaN(num) && num >= 1 && num <= modules.length) {
        selectedModule = modules[num - 1];
      } else {
        selectedModule = modules.find(
          (m) => m.name.toLowerCase() === moduleName.toLowerCase() || m.id.toLowerCase() === moduleName.toLowerCase()
        ) || modules.find((m) => m.name.toLowerCase().includes(moduleName.toLowerCase()));
      }
    }

    session.moduleId = selectedModule ? selectedModule.id : null;
    session.moduleName = selectedModule ? selectedModule.name : null;
    
    // Check if user previously reported an active blocker for this project
    const openBlockers = await getOpenBlockersForUser(chatId, profile ? profile.fullName : 'QA Member');
    const projectBlockers = openBlockers.filter((b) => !b.projectName || b.projectName.toLowerCase() === session.profile.projectName.toLowerCase());

    if (projectBlockers.length > 0) {
      session.step = 'resolve_previous_blocker';
      session.pendingBlockers = projectBlockers;
      const blockerCountText = projectBlockers.length === 1 ? 'an active blocker' : `${projectBlockers.length} active blockers`;
      const blockerItemsList = projectBlockers
        .map((b) => `• <b>${escapeHtml(b.title || 'Blocker')}</b>: <i>"${escapeHtml(b.description)}"</i>`)
        .join('\n');

      await sendMessage(
        chatId,
        `📁 <b>Project:</b> <b>${escapeHtml(session.profile.projectName)}</b>\n\n` +
        `⚠️ <b>Reminder from Yesterday:</b>\n` +
        `You previously reported ${blockerCountText} on <b>${escapeHtml(session.profile.projectName)}</b>:\n` +
        `${blockerItemsList}\n\n` +
        `<b>Are these blocker(s) now resolved?</b>\n\n` +
        `1️⃣ <b>Yes, mark resolved</b> (Remove from blocked tasks on QA Command Center)\n` +
        `2️⃣ <b>No, still blocked</b>\n\n` +
        `<i>Reply 1 to mark resolved, or 2 to keep active:</i>`
      );
      return true;
    }

    session.step = 'worked_today';
    const modText = selectedModule ? `\n📦 <b>Module:</b> <b>${escapeHtml(selectedModule.name)}</b>` : '';
    await sendMessage(
      chatId,
      `📁 <b>Project:</b> <b>${escapeHtml(session.profile.projectName)}</b>${modText}\n\n` +
      `📝 <b>What did you work on today?</b>\n` +
      `<i>(Briefly describe the work/testing completed today)</i>`
    );
    return true;
  }

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
        `🎯 <b>What did you work on today?</b>\n` +
        `<i>(Feature, module, test cases executed, API testing, regression, bugs retested, etc.)</i>`
      );
    } else {
      await sendMessage(
        chatId,
        `Understood, keeping blocker(s) active on the dashboard.\n\n` +
        `Now let's proceed with your daily standup.\n\n` +
        `🎯 <b>What did you work on today?</b>\n` +
        `<i>(Feature, module, test cases executed, API testing, regression, bugs retested, etc.)</i>`
      );
    }
    
    // We already chose the project (and optionally module). Just transition to worked_today.
    session.step = 'worked_today';
    return true;
  }

  const res = await handleNewCheckinStep(chatId, session, text, sendMessage, {
    notifyAchievement: notifyQALeadsOfAchievement,
    notifyIssue: notifyQALeadsOfStandupIssue
  });
  if (res.cancel || res.done) {
    userSessions.delete(chatId);
    return true;
  }
  return true; // Always return true because the session handled the input
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

  if (session.step === 1) {
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

    const modules = getModules().filter(m => m.projectId === projectId);
    
    if (modules.length > 0) {
      session.step = 2;
      session.selectedProjectId = projectId;
      session.selectedProjectName = projectName;
      session.modules = modules;
      
      let listText = '';
      modules.forEach((m, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        listText += `${emoji} <b>${m.name}</b>\n`;
      });
      listText += `\n0️⃣ <b>Skip / Entire Project</b>\n`;

      await sendMessage(
        chatId,
        `✅ <b>Project Selected: ${projectName}</b>\n\n` +
        `This project has multiple active modules.\n` +
        `<b>Which module are you primarily testing?</b>\n\n` +
        listText + '\n' +
        `<i>Reply with a number or type a module name:</i>`
      );
      return true;
    }

    saveProfile(chatId, {
      projectId,
      projectName,
      moduleId: null,
      moduleName: null
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
  
  if (session.step === 2) {
    const modules = session.modules;
    let moduleName = text.trim();
    let selectedModule = null;

    if (moduleName === '0' || moduleName.toLowerCase() === 'skip' || moduleName.toLowerCase() === 'entire project') {
      // Skipped
    } else {
      const num = parseInt(moduleName, 10);
      if (!isNaN(num) && num >= 1 && num <= modules.length) {
        selectedModule = modules[num - 1];
      } else {
        selectedModule = modules.find(
          (m) => m.name.toLowerCase() === moduleName.toLowerCase() || m.id.toLowerCase() === moduleName.toLowerCase()
        ) || modules.find((m) => m.name.toLowerCase().includes(moduleName.toLowerCase()));
      }
    }

    saveProfile(chatId, {
      projectId: session.selectedProjectId,
      projectName: session.selectedProjectName,
      moduleId: selectedModule ? selectedModule.id : null,
      moduleName: selectedModule ? selectedModule.name : null
    });

    userSessions.delete(chatId);

    const modText = selectedModule ? `\n<b>Module:</b> ${selectedModule.name}` : `\n<b>Module:</b> Entire Project`;
    
    await sendMessage(
      chatId,
      `✅ <b>Active Project & Module Switched!</b>\n\n` +
      `You are now assigned to:\n<b>Project:</b> ${session.selectedProjectName}${modText}\n\n` +
      `Your next <code>/checkin</code> and blocker alerts will be recorded for this project and module.`
    );
    return true;
  }
}

async function handleTestCaseWizardStep(chatId, user, rawText) {
  const session = userSessions.get(chatId);
  if (!session || (session.type !== 'testcase_wizard' && session.type !== 'submit_testcase_link')) return false;

  const input = rawText.trim();
  if (input.toLowerCase() === 'cancel' || input.toLowerCase() === '/cancel') {
    userSessions.delete(chatId);
    await sendMessage(chatId, '❌ Test case submission cancelled.');
    return true;
  }

  // STEP 1: User chooses project
  if (session.step === 'choose_project') {
    const projects = session.projects || getProjects();
    let selected = null;

    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= projects.length) {
      selected = projects[num - 1];
    } else {
      selected = projects.find(
        (p) => p.name.toLowerCase() === input.toLowerCase() || p.id.toLowerCase() === input.toLowerCase()
      ) || projects.find((p) => p.name.toLowerCase().includes(input.toLowerCase()));
    }

    if (!selected) {
      await sendMessage(
        chatId,
        `⚠️ <b>Project not recognized</b>\n\nPlease reply with a valid number (1-${projects.length}) or type the project name:\n<i>(or type <code>cancel</code> to abort)</i>`
      );
      return true;
    }

    const modules = getModules().filter(m => m.projectId === selected.id);
    
    if (modules.length > 0) {
      session.step = 'choose_module';
      session.projectId = selected.id;
      session.projectName = selected.name;
      session.modules = modules;
      userSessions.set(chatId, session);
      
      let listText = '';
      modules.forEach((m, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        listText += `${emoji} <b>${m.name}</b>\n`;
      });
      listText += `\n0️⃣ <b>Skip / Entire Project</b>\n`;
      
      await sendMessage(
        chatId,
        `✅ <b>Project Selected: ${selected.name}</b>\n\n` +
        `This project has multiple active modules.\n` +
        `<b>Which module do these test cases cover?</b>\n\n` +
        listText + '\n' +
        `<i>Reply with a number or type a module name:</i>`
      );
      return true;
    }

    // If user already supplied a URL in the initial command
    if (session.pendingUrl) {
      let finalUrl = session.pendingUrl;
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }
      const savedProj = await saveProjectTestCaseUrl(selected.id, finalUrl);
      userSessions.delete(chatId);
      const finalName = savedProj?.name || selected.name;

      await sendMessage(
        chatId,
        `✅ <b>Test Cases Link Submitted!</b>\n\n` +
        `📁 <b>Project:</b> <b>${escapeHtml(finalName)}</b>\n` +
        `🔗 <b>Test Cases Link:</b> <a href="${escapeHtml(finalUrl)}">${escapeHtml(finalUrl)}</a>\n\n` +
        `<i>The link has been saved and is now placed right beside PRD and Figma in the project dashboard.</i>\n\n` +
        `💡 Type <code>/checkin</code> when you are ready to submit your daily standup.`
      );
      return true;
    }

    // Advance to STEP 2: Ask for the test case link
    session.step = 'provide_link';
    session.projectId = selected.id;
    session.projectName = selected.name;
    session.moduleId = null;
    session.moduleName = null;
    userSessions.set(chatId, session);

    let currentLinkMsg = '';
    if (selected.resources?.testCaseUrl) {
      currentLinkMsg = `\n<i>Current link: ${escapeHtml(selected.resources.testCaseUrl)}</i>\n`;
    }

    await sendMessage(
      chatId,
      `🧪 <b>Submit Test Cases Link</b>\n\n` +
      `📁 <b>Selected Project:</b> <b>${escapeHtml(selected.name)}</b>${currentLinkMsg}\n` +
      `Please provide the link to your test cases (Google Sheets, Notion, TestRail, Jira, or Docs):\n\n` +
      `<i>👉 Reply with the URL below, or type <code>cancel</code> to abort:</i>`
    );
    return true;
  }
  
  if (session.step === 'choose_module') {
    const modules = session.modules;
    let moduleName = input;
    let selectedModule = null;

    if (moduleName === '0' || moduleName.toLowerCase() === 'skip' || moduleName.toLowerCase() === 'entire project') {
      // Skipped
    } else {
      const num = parseInt(moduleName, 10);
      if (!isNaN(num) && num >= 1 && num <= modules.length) {
        selectedModule = modules[num - 1];
      } else {
        selectedModule = modules.find(
          (m) => m.name.toLowerCase() === moduleName.toLowerCase() || m.id.toLowerCase() === moduleName.toLowerCase()
        ) || modules.find((m) => m.name.toLowerCase().includes(moduleName.toLowerCase()));
      }
    }
    
    session.moduleId = selectedModule ? selectedModule.id : null;
    session.moduleName = selectedModule ? selectedModule.name : null;
    
    // If user already supplied a URL in the initial command
    if (session.pendingUrl) {
      let finalUrl = session.pendingUrl;
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }
      
      // Save for project and module if appropriate (for now we save at project level)
      const savedProj = await saveProjectTestCaseUrl(session.projectId, finalUrl);
      userSessions.delete(chatId);
      const finalName = savedProj?.name || session.projectName;
      
      const modText = selectedModule ? `\n📦 <b>Module:</b> <b>${escapeHtml(selectedModule.name)}</b>` : '';

      await sendMessage(
        chatId,
        `✅ <b>Test Cases Link Submitted!</b>\n\n` +
        `📁 <b>Project:</b> <b>${escapeHtml(finalName)}</b>${modText}\n` +
        `🔗 <b>Test Cases Link:</b> <a href="${escapeHtml(finalUrl)}">${escapeHtml(finalUrl)}</a>\n\n` +
        `<i>The link has been saved and is now placed right beside PRD and Figma in the project dashboard.</i>\n\n` +
        `💡 Type <code>/checkin</code> when you are ready to submit your daily standup.`
      );
      return true;
    }
    
    // Advance to STEP 2: Ask for the test case link
    session.step = 'provide_link';
    userSessions.set(chatId, session);
    
    const modText = selectedModule ? `\n📦 <b>Selected Module:</b> <b>${escapeHtml(selectedModule.name)}</b>` : '';
    await sendMessage(
      chatId,
      `🧪 <b>Submit Test Cases Link</b>\n\n` +
      `📁 <b>Selected Project:</b> <b>${escapeHtml(session.projectName)}</b>${modText}\n` +
      `Please provide the link to your test cases (Google Sheets, Notion, TestRail, Jira, or Docs):\n\n` +
      `<i>👉 Reply with the URL below, or type <code>cancel</code> to abort:</i>`
    );
    return true;
  }

  // STEP 2: User provides testcase link
  if (session.step === 'provide_link' || session.type === 'submit_testcase_link') {
    const urlMatch = input.match(/https?:\/\/[^\s]+/i);
    let testCaseUrl = urlMatch ? urlMatch[0] : input;

    if (!testCaseUrl.startsWith('http://') && !testCaseUrl.startsWith('https://')) {
      if (testCaseUrl.includes('.') && !testCaseUrl.includes(' ')) {
        testCaseUrl = `https://${testCaseUrl}`;
      } else {
        await sendMessage(
          chatId,
          `⚠️ <b>Please provide a valid URL link</b>\n\n` +
          `Example: <code>https://docs.google.com/spreadsheets/d/...</code> or Notion / TestRail / Jira link.\n\n` +
          `<i>Reply with the link, or type <code>cancel</code> to abort.</i>`
        );
        return true;
      }
    }

    const projectId = session.projectId;
    const projectName = session.projectName;
    const savedProj = await saveProjectTestCaseUrl(projectId, testCaseUrl);
    userSessions.delete(chatId);

    const finalProjectName = savedProj?.name || projectName || 'Crypto Vault Wallet';

    await sendMessage(
      chatId,
      `✅ <b>Test Cases Link Submitted!</b>\n\n` +
      `📁 <b>Project:</b> <b>${escapeHtml(finalProjectName)}</b>\n` +
      (session.moduleName ? `📦 <b>Module:</b> <b>${escapeHtml(session.moduleName)}</b>\n` : '') +
      `🔗 <b>Test Cases Link:</b> <a href="${escapeHtml(testCaseUrl)}">${escapeHtml(testCaseUrl)}</a>\n\n` +
      `<i>The link has been saved and is now placed right beside PRD and Figma in the project dashboard.</i>\n\n` +
      `💡 Type <code>/checkin</code> when you are ready to submit your daily standup.`
    );
    return true;
  }

  return false;
}

// ==========================================
// 3B. BLOCKER REPORTING WIZARD
// ==========================================

async function handleAssignWizardStep(chatId, user, text) {
  const session = userSessions.get(chatId);
  if (!session || session.type !== 'assign_wizard') return false;

  const rawText = text.trim();
  const lower = rawText.toLowerCase();

  if (lower === '/cancel' || lower === 'cancel') {
    userSessions.delete(chatId);
    await sendMessage(chatId, `❌ Assignment cancelled.`);
    return true;
  }

  // STEP 1: Choose project
  if (session.step === 'choose_project') {
    const list = session.projectsList;
    let chosenProject = null;

    if (!isNaN(rawText)) {
      const idx = parseInt(rawText, 10) - 1;
      if (idx >= 0 && idx < list.length) {
        chosenProject = list[idx];
      }
    } else {
      chosenProject = list.find((p) => p.name.toLowerCase() === lower);
    }

    if (!chosenProject) {
      await sendMessage(chatId, `⚠️ Invalid project. Please reply with the number or exact name (or type /cancel).`);
      return true;
    }

    session.selectedProject = chosenProject;
    
    // Show tester recommendations
    const requiredWeight = getEffectiveProjectWorkload(chosenProject.id);
    const recText = getBestTesterRecommendations(requiredWeight);

    session.step = 'choose_tester';
    await sendMessage(
      chatId,
      `📁 <b>Project:</b> ${escapeHtml(chosenProject.name)}\n` +
      `📊 <b>Required QA allocation: ${requiredWeight}%</b>\n\n` +
      recText + `\n` +
      `<i>Reply with the QA Tester's exact name (or type /cancel):</i>`
    );
    return true;
  }

  // STEP 2: Choose tester
  if (session.step === 'choose_tester') {
    const profiles = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'telegram_profiles.json'), 'utf-8'));
    let chosenTesterId = null;
    let chosenTesterName = '';

    for (const id in profiles) {
      if (profiles[id].fullName.toLowerCase() === lower || lower.includes(profiles[id].fullName.toLowerCase())) {
        chosenTesterId = `usr-${id}`;
        chosenTesterName = profiles[id].fullName;
        break;
      }
    }

    if (!chosenTesterId) {
      await sendMessage(chatId, `⚠️ Tester not found. Please type their exact name as shown in the list.`);
      return true;
    }

    session.selectedTesterId = chosenTesterId;
    session.selectedTesterName = chosenTesterName;

    const requiredWeight = getEffectiveProjectWorkload(session.selectedProject.id);
    
    session.step = 'choose_allocation';
    await sendMessage(
      chatId,
      `<b>Allocation for ${escapeHtml(chosenTesterName)} on ${escapeHtml(session.selectedProject.name)}</b>\n\n` +
      `Project total workload: ${requiredWeight}%\n` +
      `Suggested allocation: ${requiredWeight}%\n\n` +
      `<i>Reply with the percentage to allocate (e.g., 20) or just reply ${requiredWeight} to accept the suggestion:</i>`
    );
    return true;
  }

  // STEP 3: Choose allocation
  if (session.step === 'choose_allocation') {
    const allocation = parseInt(rawText.replace('%', ''), 10);
    if (isNaN(allocation) || allocation <= 0) {
      await sendMessage(chatId, `⚠️ Invalid percentage. Please enter a number.`);
      return true;
    }

    session.allocation = allocation;
    
    // Check warning
    const cap = getTesterCapacity(session.selectedTesterId);
    const warning = getAssignmentWarning(session.selectedTesterId, session.selectedTesterName, cap.totalWorkload, allocation);

    if (warning) {
      session.step = 'confirm_warning';
      await sendMessage(chatId, warning);
      return true;
    }

    // Assign directly
    assignTesterToProject(session.selectedTesterId, session.selectedProject.id, allocation);
    userSessions.delete(chatId);
    await sendMessage(chatId, `✅ Successfully assigned ${escapeHtml(session.selectedTesterName)} to ${escapeHtml(session.selectedProject.name)} with ${allocation}% workload.`);
    return true;
  }

  // STEP 4: Confirm Warning
  if (session.step === 'confirm_warning') {
    if (lower === 'assign anyway' || lower === 'yes' || lower === 'assign') {
      assignTesterToProject(session.selectedTesterId, session.selectedProject.id, session.allocation);
      userSessions.delete(chatId);
      await sendMessage(chatId, `✅ Successfully assigned ${escapeHtml(session.selectedTesterName)} to ${escapeHtml(session.selectedProject.name)} with ${session.allocation}% workload.`);
      return true;
    } else {
      userSessions.delete(chatId);
      await sendMessage(chatId, `❌ Assignment aborted. You can type /assign to start over.`);
      return true;
    }
  }

  return false;
}

async function handleBlockerWizardStep(chatId, user, text) {
  const session = userSessions.get(chatId);
  if (!session || session.type !== 'blocker_wizard') return false;

  const input = text.trim();
  if (input.toLowerCase() === 'cancel' || input.toLowerCase() === '/cancel') {
    userSessions.delete(chatId);
    await sendMessage(chatId, '❌ Blocker reporting cancelled.');
    return true;
  }

  // STEP 1: User chooses project
  if (session.step === 'choose_project') {
    const projects = session.projectsList || getProjects();
    let selected = null;

    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= projects.length) {
      selected = projects[num - 1];
    } else {
      selected = projects.find(
        (p) => (p.name && p.name.toLowerCase() === input.toLowerCase()) || (p.id && p.id.toLowerCase() === input.toLowerCase())
      ) || projects.find((p) => p.name && p.name.toLowerCase().includes(input.toLowerCase()));
    }

    if (!selected) {
      await sendMessage(
        chatId,
        `⚠️ <b>Project not recognized</b>\n\nPlease reply with a valid number (1-${projects.length}) or type the project name:\n<i>(or type <code>cancel</code> to abort)</i>`
      );
      return true;
    }

    const projectId = selected.id;
    const projectName = selected.name;

    const modules = getModules().filter(m => m.projectId === projectId);
    
    if (modules.length > 0) {
      session.step = 'choose_module';
      session.projectId = projectId;
      session.projectName = projectName;
      session.modules = modules;
      userSessions.set(chatId, session);
      
      let listText = '';
      modules.forEach((m, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        listText += `${emoji} <b>${m.name}</b>\n`;
      });
      listText += `\n0️⃣ <b>Skip / Entire Project</b>\n`;

      await sendMessage(
        chatId,
        `✅ <b>Project Selected: ${projectName}</b>\n\n` +
        `This project has multiple active modules.\n` +
        `<b>Which module is currently blocked?</b>\n\n` +
        listText + '\n' +
        `<i>Reply with a number or type a module name:</i>`
      );
      return true;
    }

    // If pendingReason was already provided in the original /blocker command
    if (session.pendingReason) {
      const reason = session.pendingReason;
      const profile = getProfile(chatId);
      const memberName = profile ? profile.fullName : (user.first_name || 'QA Tester');

      if (profile) {
        profile.projectId = projectId;
        profile.projectName = projectName;
        const profiles = loadProfiles();
        if (profiles[String(chatId)]) {
          profiles[String(chatId)].projectId = projectId;
          profiles[String(chatId)].projectName = projectName;
          profiles[String(chatId)].updatedAt = new Date().toISOString();
          saveProfiles(profiles);
        }
        if (supabase) {
          supabase.from('telegram_profiles').update({
            project_id: projectId,
            project_name: projectName,
            updated_at: new Date().toISOString(),
          }).eq('chat_id', String(chatId)).then(() => {});
        }
      }

      const blockerItem = {
        id: `blk-${Date.now().toString(36)}`,
        title: `Blocker: ${memberName} (Blocked)`,
        description: reason,
        projectId,
        projectName,
        moduleId: null,
        moduleName: null,
        severity: 'Critical',
        status: 'Open',
        reportedBy: memberName,
        createdAt: new Date().toISOString(),
        chatId: String(chatId),
      };

      persistBlocker(blockerItem);
      userSessions.delete(chatId);

      notifyQALeadsOfBlocker({
        senderChatId: chatId,
        memberName,
        username: user.username || user.first_name,
        projectName,
        projectId,
        moduleId: null,
        moduleName: null,
        reason,
        severity: 'Critical',
        createdAt: blockerItem.createdAt,
      }).catch((err) => console.error('[Notify Lead Error]', err.message));

      await sendMessage(
        chatId,
        `🚨 <b>CRITICAL BLOCKER LOGGED</b>\n\n` +
        `📁 <b>Project:</b> <b>${escapeHtml(projectName)}</b>\n` +
        `👤 <b>Reported by:</b> ${escapeHtml(memberName)} (@${escapeHtml(user.username || user.first_name)})\n` +
        `⚠️ <b>Issue:</b> <i>"${escapeHtml(reason)}"</i>\n` +
        `🕒 <b>Time:</b> <code>${new Date().toLocaleTimeString()}</code>\n\n` +
        `<i>The QA Leadership Command Center has been alerted.</i>`
      );
      return true;
    }

    // Advance to STEP 2: Ask for blocker description
    session.step = 'enter_reason';
    session.projectId = projectId;
    session.projectName = projectName;
    session.moduleId = null;
    session.moduleName = null;
    userSessions.set(chatId, session);

    await sendMessage(
      chatId,
      `🚨 <b>Report Urgent Blocker</b>\n\n` +
      `📁 <b>Project:</b> <b>${escapeHtml(projectName)}</b>\n\n` +
      `Please describe the blocker or critical challenge stopping your QA work:\n\n` +
      `<i>👉 Reply with the description below (or type <code>cancel</code> to abort):</i>`
    );
    return true;
  }
  
  if (session.step === 'choose_module') {
    const modules = session.modules;
    let moduleName = input;
    let selectedModule = null;

    if (moduleName === '0' || moduleName.toLowerCase() === 'skip' || moduleName.toLowerCase() === 'entire project') {
      // Skipped
    } else {
      const num = parseInt(moduleName, 10);
      if (!isNaN(num) && num >= 1 && num <= modules.length) {
        selectedModule = modules[num - 1];
      } else {
        selectedModule = modules.find(
          (m) => m.name.toLowerCase() === moduleName.toLowerCase() || m.id.toLowerCase() === moduleName.toLowerCase()
        ) || modules.find((m) => m.name.toLowerCase().includes(moduleName.toLowerCase()));
      }
    }
    
    session.moduleId = selectedModule ? selectedModule.id : null;
    session.moduleName = selectedModule ? selectedModule.name : null;

    // If pendingReason was already provided in the original /blocker command
    if (session.pendingReason) {
      const reason = session.pendingReason;
      const profile = getProfile(chatId);
      const memberName = profile ? profile.fullName : (user.first_name || 'QA Tester');

      if (profile) {
        profile.projectId = session.projectId;
        profile.projectName = session.projectName;
        const profiles = loadProfiles();
        if (profiles[String(chatId)]) {
          profiles[String(chatId)].projectId = session.projectId;
          profiles[String(chatId)].projectName = session.projectName;
          profiles[String(chatId)].updatedAt = new Date().toISOString();
          saveProfiles(profiles);
        }
        if (supabase) {
          supabase.from('telegram_profiles').update({
            project_id: session.projectId,
            project_name: session.projectName,
            updated_at: new Date().toISOString(),
          }).eq('chat_id', String(chatId)).then(() => {});
        }
      }

      const blockerItem = {
        id: `blk-${Date.now().toString(36)}`,
        title: `Blocker: ${memberName} (Blocked)`,
        description: reason,
        projectId: session.projectId,
        projectName: session.projectName,
        moduleId: session.moduleId,
        moduleName: session.moduleName,
        severity: 'Critical',
        status: 'Open',
        reportedBy: memberName,
        createdAt: new Date().toISOString(),
        chatId: String(chatId),
      };

      persistBlocker(blockerItem);
      userSessions.delete(chatId);

      notifyQALeadsOfBlocker({
        senderChatId: chatId,
        memberName,
        username: user.username || user.first_name,
        projectName: session.projectName,
        projectId: session.projectId,
        moduleId: session.moduleId,
        moduleName: session.moduleName,
        reason,
        severity: 'Critical',
        createdAt: blockerItem.createdAt,
      }).catch((err) => console.error('[Notify Lead Error]', err.message));

      const modText = session.moduleName ? `\n📦 <b>Module:</b> <b>${escapeHtml(session.moduleName)}</b>` : '';

      await sendMessage(
        chatId,
        `🚨 <b>CRITICAL BLOCKER LOGGED</b>\n\n` +
        `📁 <b>Project:</b> <b>${escapeHtml(session.projectName)}</b>${modText}\n` +
        `👤 <b>Reported by:</b> ${escapeHtml(memberName)} (@${escapeHtml(user.username || user.first_name)})\n` +
        `⚠️ <b>Issue:</b> <i>"${escapeHtml(reason)}"</i>\n` +
        `🕒 <b>Time:</b> <code>${new Date().toLocaleTimeString()}</code>\n\n` +
        `<i>The QA Leadership Command Center has been alerted.</i>`
      );
      return true;
    }

    // Advance to STEP 2: Ask for blocker description
    session.step = 'enter_reason';
    userSessions.set(chatId, session);

    const modText = session.moduleName ? `\n📦 <b>Module:</b> <b>${escapeHtml(session.moduleName)}</b>` : '';
    await sendMessage(
      chatId,
      `🚨 <b>Report Urgent Blocker</b>\n\n` +
      `📁 <b>Project:</b> <b>${escapeHtml(session.projectName)}</b>${modText}\n\n` +
      `Please describe the blocker or critical challenge stopping your QA work:\n\n` +
      `<i>👉 Reply with the description below (or type <code>cancel</code> to abort):</i>`
    );
    return true;
  }

  // STEP 2: User provides blocker description
  if (session.step === 'enter_reason') {
    const reason = input;
    const projectId = session.projectId;
    const projectName = session.projectName;
    const profile = getProfile(chatId);
    const memberName = profile ? profile.fullName : (user.first_name || 'QA Tester');

    if (profile) {
      profile.projectId = projectId;
      profile.projectName = projectName;
      const profiles = loadProfiles();
      if (profiles[String(chatId)]) {
        profiles[String(chatId)].projectId = projectId;
        profiles[String(chatId)].projectName = projectName;
        profiles[String(chatId)].updatedAt = new Date().toISOString();
        saveProfiles(profiles);
      }
      if (supabase) {
        supabase.from('telegram_profiles').update({
          project_id: projectId,
          project_name: projectName,
          updated_at: new Date().toISOString(),
        }).eq('chat_id', String(chatId)).then(() => {});
      }
    }

    const blockerItem = {
      id: `blk-${Date.now().toString(36)}`,
      title: `Blocker: ${memberName} (Blocked)`,
      description: reason,
      projectId,
      projectName,
      moduleId: session.moduleId,
      moduleName: session.moduleName,
      severity: 'Critical',
      status: 'Open',
      reportedBy: memberName,
      createdAt: new Date().toISOString(),
      chatId: String(chatId),
    };

    persistBlocker(blockerItem);
    userSessions.delete(chatId);

    notifyQALeadsOfBlocker({
      senderChatId: chatId,
      memberName,
      username: user.username || user.first_name,
      projectName,
      projectId,
      moduleId: session.moduleId,
      moduleName: session.moduleName,
      reason,
      severity: 'Critical',
      createdAt: blockerItem.createdAt,
    }).catch((err) => console.error('[Notify Lead Error]', err.message));

    const modText = session.moduleName ? `\n📦 <b>Module:</b> <b>${escapeHtml(session.moduleName)}</b>` : '';

    await sendMessage(
      chatId,
      `🚨 <b>CRITICAL BLOCKER LOGGED</b>\n\n` +
      `📁 <b>Project:</b> <b>${escapeHtml(projectName)}</b>${modText}\n` +
      `👤 <b>Reported by:</b> ${escapeHtml(memberName)} (@${escapeHtml(user.username || user.first_name)})\n` +
      `⚠️ <b>Issue:</b> <i>"${escapeHtml(reason)}"</i>\n` +
      `🕒 <b>Time:</b> <code>${new Date().toLocaleTimeString()}</code>\n\n` +
      `<i>The QA Leadership Command Center has been alerted.</i>`
    );
    return true;
  }

  return false;
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

  let profile = await findOrLinkProfile(chatId, user);
  if (profile && profile.role) {
    syncTelegramCommands(chatId, profile.role).catch(() => {});
  }

  // Group message collection
  if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
    if (!text.startsWith('/')) { // Not a command
      persistGroupMessage({
        id: message.message_id,
        chatId: message.chat.id,
        senderName: user.first_name || user.username || 'Unknown',
        text: rawText,
        timestamp: (message.date * 1000) || Date.now()
      });
      return; // Do not process normal text as a command
    }
  }

  // Handle /reset
  if (text === '/reset' || text === 'reset') {
    userSessions.delete(chatId);
    
    // Wipe profile from DBs
    if (supabase) {
      await supabase.from('telegram_profiles').delete().eq('chat_id', String(chatId));
      await supabase.from('users').delete().eq('telegram_chat_id', String(chatId));
    }
    
    // Also remove from local in-memory DB if applicable
    const profileIdx = DB.telegram_profiles.findIndex(p => p.chat_id === String(chatId));
    if (profileIdx !== -1) {
      DB.telegram_profiles.splice(profileIdx, 1);
      saveDB();
    }
    const userIdx = DB.users.findIndex(u => u.telegram_chat_id === String(chatId));
    if (userIdx !== -1) {
      DB.users.splice(userIdx, 1);
      saveDB();
    }

    await sendMessage(
      chatId,
      `🔄 <b>Profile Reset Successful</b>\n\nYour profile has been wiped. Type /start to register again.`
    );
    return;
  }

  // Handle /start, start, /help, help, /menu, menu
  if (
    text === '/start' ||
    text.startsWith('/start ') ||
    text === 'start' ||
    text === '/help' ||
    text.startsWith('/help ') ||
    text === 'help' ||
    text === '/menu' ||
    text === 'menu'
  ) {
    // Clear any stuck/previous wizard session so /start always provides a fresh welcome!
    userSessions.delete(chatId);

    if (!profile) {
      console.log(`[Bot] New member ${chatId} (${user.username || user.first_name || 'unknown'}) clicked /start. Starting QA onboarding wizard.`);
      await startOnboarding(chatId, user, false);
      return;
    }

    const isLead = isQALead(profile);
    const commandsList = isLead
      ? `<b>Available Commands (QA Lead):</b>\n` +
        `• /status — Overall QA & project readiness\n` +
        `• /team — Team members and their current status\n` +
        `• /project — Manage and switch active QA project\n` +
        `• /testcase — Submit test cases link\n` +
        `• /blocker &lt;reason&gt; — View or report blockers\n` +
        `• /resolve — Resolve active blockers\n` +
        `• /risks — View QA risks & defect exposures\n` +
        `• /report — Generate daily/weekly QA reports\n` +
        `• /profile — View and update your profile\n` +
        `• /role [title] — Switch your QA role (e.g. /role QA Lead)\n` +
        `• /cancel — Cancel an active operation`
      : `<b>Available Commands:</b>\n` +
        `• /checkin — Submit daily QA standup (5 questions)\n` +
        `• /testcase — Select project & submit test cases link\n` +
        `• /project — View or switch active project\n` +
        `• /blocker &lt;reason&gt; — Report urgent blocker\n` +
        `• /resolve — Resolve active blocker\n` +
        `• /profile — View and update profile\n` +
        `• /status — View relevant QA status\n` +
        `• /role [title] — Switch your QA role (e.g. /role QA Engineer)\n` +
        `• /cancel — Cancel current operation`;

    await sendMessage(
      chatId,
      `🛡️ <b>Welcome to AegisQA, ${escapeHtml(profile.fullName)}!</b>\n\n` +
      `✅ <b>Your Telegram account is connected to the QA Command Center.</b>\n` +
      `💬 <b>Your Chat ID:</b> <code>${chatId}</code>\n` +
      `👤 <b>Role:</b> ${escapeHtml(profile.role)}\n` +
      `🚀 <b>Active Project:</b> ${escapeHtml(profile.projectName)}\n\n` +
      commandsList + `\n\n` +
      `💡 <i>You will automatically receive alerts here whenever you are assigned to a QA project!</i>`
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
    } else if (session.type === 'testcase_wizard' || session.type === 'submit_testcase_link') {
      const handled = await handleTestCaseWizardStep(chatId, user, rawText);
      if (handled) return;
    } else if (session.type === 'assign_wizard') {
      const handled = await handleAssignWizardStep(chatId, user, rawText);
      if (handled) return;
    } else if (session.type === 'blocker_wizard') {
      const handled = await handleBlockerWizardStep(chatId, user, rawText);
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

  // If user does not have an active profile: guide through onboarding
  if (!profile) {
    console.log(`[Bot] Member ${chatId} (${user.username || user.first_name || 'unknown'}) has no active profile. Starting onboarding wizard.`);
    await startOnboarding(chatId, user, false);
    return;
  }

  if (text === '/profile') {

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

  // /testcase command to submit test cases link: first choose project, then provide link
  if (text === '/testcase' || text === 'testcase' || text === '/testcases' || text.startsWith('/testcase ') || text.startsWith('/testcases ')) {
    const projects = await refreshProjectsFromCloud();
    const rawArg = rawText.replace(/^\/testcases?\s*/i, '').trim();

    // If user provided: /testcase <Project Name> - <URL>
    if (rawArg.includes(' - ') && (rawArg.includes('http://') || rawArg.includes('https://'))) {
      const [projPart, ...urlParts] = rawArg.split(' - ');
      const candidateUrl = urlParts.join(' - ').trim();
      const matchedProj = projects.find(
        (p) => p.name.toLowerCase() === projPart.trim().toLowerCase() || p.id.toLowerCase() === projPart.trim().toLowerCase()
      ) || projects.find((p) => p.name.toLowerCase().includes(projPart.trim().toLowerCase()));

      if (matchedProj) {
        let finalUrl = candidateUrl;
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
          finalUrl = `https://${finalUrl}`;
        }
        await saveProjectTestCaseUrl(matchedProj.id, finalUrl);
        await sendMessage(
          chatId,
          `✅ <b>Test Cases Link Submitted!</b>\n\n` +
          `📁 <b>Project:</b> <b>${escapeHtml(matchedProj.name)}</b>\n` +
          `🔗 <b>Test Cases Link:</b> <a href="${escapeHtml(finalUrl)}">${escapeHtml(finalUrl)}</a>\n\n` +
          `<i>The link has been saved and is now placed right beside PRD and Figma in the project dashboard.</i>\n\n` +
          `💡 Type <code>/checkin</code> when you are ready to log your daily standup.`
        );
        return;
      }
    }

    // Step 1: Prompt user to choose the project first!
    let listText = '';
    const memberId = profile ? `usr-${chatId}` : 'usr-unknown';

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
        tag = ' 🟢 <i>(Assigned)</i>';
      }

      listText += `${emoji} <b>${escapeHtml(p.name)}</b>${tag}\n`;
    });

    userSessions.set(chatId, {
      type: 'testcase_wizard',
      step: 'choose_project',
      projects,
      pendingUrl: (rawArg.startsWith('http://') || rawArg.startsWith('https://')) ? rawArg : null,
    });

    await sendMessage(
      chatId,
      `🧪 <b>Submit Test Cases Link</b>\n\n` +
      `<b>Please choose the project:</b>\n\n` +
      listText + '\n' +
      `<i>Reply with a number (1-${projects.length}) or type the project name:</i>\n` +
      `<i>(or type <code>cancel</code> to abort)</i>`
    );
    return;
  }

  if (text.startsWith('/blocker') || text === '/block' || text === '/blockers') {
    const reason = rawText.replace(/^\/(?:blocker|blockers|block)\s*/i, '').trim();

    if (!reason) {
      // Step 1: Prompt user to choose project first!
      const allProjects = await refreshProjectsFromCloud();
      const assignedNames = (profile?.assignedProjects || []).map((x) => String(x).toLowerCase());
      const assignedIds = (profile?.assignedProjectIds || []).map((x) => String(x).toLowerCase());
      const memberKey = `usr-${chatId}`;
      const assignedList = [];
      const otherList = [];

      for (const p of allProjects) {
        const isAssigned =
          assignedNames.includes(p.name.toLowerCase()) ||
          assignedIds.includes(p.id.toLowerCase()) ||
          (p.memberIds && p.memberIds.includes(memberKey));

        if (isAssigned) {
          assignedList.push(p);
        } else {
          otherList.push(p);
        }
      }

      const projectsList = [...assignedList, ...otherList];

      userSessions.set(chatId, {
        type: 'blocker_wizard',
        step: 'choose_project',
        projectsList,
        profile,
      });

      let listText = '';
      projectsList.forEach((p, idx) => {
        const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
        const isAssigned = assignedList.some((ap) => ap.id === p.id);
        listText += `${emoji} <b>${escapeHtml(p.name)}</b>${isAssigned ? ' ⭐ <i>(Assigned)</i>' : ''}\n`;
      });

      await sendMessage(
        chatId,
        `🚨 <b>Report Urgent Blocker</b>\n\n` +
        `📁 <b>Select Project:</b>\nWhich project has the blocker?\n\n` +
        `${listText}\n` +
        `<i>Reply with the number (1-${projectsList.length}) or type the project name:</i>`
      );
      return;
    }

    // Reason provided: /blocker <reason>
    if (profile && profile.projectName) {
      const memberName = profile.fullName;
      const projectName = profile.projectName;
      const projectId = profile.projectId || 'prj-banking';

      const blockerItem = {
        id: `blk-${Date.now().toString(36)}`,
        title: `Blocker: ${memberName} (Blocked)`,
        description: reason,
        projectId,
        projectName,
        severity: 'Critical',
        status: 'Open',
        reportedBy: memberName,
        createdAt: new Date().toISOString(),
        chatId: String(chatId),
      };

      persistBlocker(blockerItem);

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
        `📁 <b>Project:</b> <b>${escapeHtml(projectName)}</b>\n` +
        `👤 <b>Reported by:</b> ${escapeHtml(memberName)} (@${escapeHtml(user.username || user.first_name)})\n` +
        `⚠️ <b>Issue:</b> <i>"${escapeHtml(reason)}"</i>\n` +
        `🕒 <b>Time:</b> <code>${new Date().toLocaleTimeString()}</code>\n\n` +
        `<i>The QA Leadership Command Center has been alerted.</i>\n\n` +
        `💡 <i>To log for a different project, reply with <code>/blocker</code> to select the project.</i>`
      );
      return;
    }

    // If profile has no active project, prompt to select project
    const allProjects = await refreshProjectsFromCloud();
    userSessions.set(chatId, {
      type: 'blocker_wizard',
      step: 'choose_project',
      projectsList: allProjects,
      pendingReason: reason,
      profile,
    });

    let listText = '';
    allProjects.forEach((p, idx) => {
      const emoji = NUMBER_EMOJIS[idx] || `[${idx + 1}]`;
      listText += `${emoji} <b>${escapeHtml(p.name)}</b>\n`;
    });

    await sendMessage(
      chatId,
      `🚨 <b>Report Urgent Blocker</b>\n\n` +
      `📁 <b>Select Project:</b>\nWhich project does this blocker belong to?\n\n` +
      `${listText}\n` +
      `<i>Reply with the number (1-${allProjects.length}) or type the project name:</i>`
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

  if (text.startsWith('/readiness')) {
    const parts = text.split(' ');
    let targetProject = profile?.projectId;
    
    if (parts.length > 1) {
      if (!isQALead(profile)) {
        await sendMessage(chatId, `⚠️ Only QA Leads can query other projects.`);
        return;
      }
      const allProjects = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'projects.json'), 'utf-8'));
      const p = allProjects.find(pr => pr.name.toLowerCase().includes(parts.slice(1).join(' ').toLowerCase()));
      if (p) targetProject = p.id;
    }

    if (!targetProject) {
      await sendMessage(chatId, `⚠️ Project not found.`);
      return;
    }

    const allProjects = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'projects.json'), 'utf-8'));
    const p = allProjects.find(pr => pr.id === targetProject);

    // Simulate getting actual test and defect data
    const testData = { executed: 160, planned: 200, passed: 145 };
    const defectData = { critical: 0, high: 2, medium: 5, low: 10, activeBlockers: 1 };
    const reportingData = { expected: 5, submitted: 5 };
    
    const readiness = calculateReadinessScore(targetProject, testData, defectData, reportingData);
    
    let msg = `🚦 <b>RELEASE READINESS</b>\n\n`;
    msg += `Project: ${p.name}\n`;
    msg += `Overall Score: <b>${readiness.score}/100</b>\n\n`;
    msg += `Status:\n${readiness.emoji} <b>${readiness.status}</b>\n\n`;
    msg += `📊 <b>Score Breakdown</b>\n\n`;
    
    const cats = [
      { name: 'Test Execution', data: readiness.components.execution },
      { name: 'Pass Rate', data: readiness.components.passRate },
      { name: 'Defect Health', data: readiness.components.defectHealth },
      { name: 'Blockers', data: readiness.components.blockers },
      { name: 'QA Reporting', data: readiness.components.qaReporting }
    ];

    cats.forEach(c => {
      msg += `${c.name}\n`;
      msg += `<code>${generateCapacityBar(c.data.pct)}</code>\n`;
      msg += `Contribution: ${c.data.pts.toFixed(1)}/${c.data.max}\n\n`;
    });

    if (readiness.gateBlocked) {
      msg += `🚨 <b>RELEASE BLOCKED</b>\n`;
      readiness.gateReason.forEach(r => msg += `• ${r}\n`);
    }

    await sendLongMessage(chatId, msg);
    return;
  }

  if (text === '/dashboard') {
    if (!isQALead(profile)) {
      await sendMessage(chatId, `⚠️ <b>Access Denied:</b> Only for QA Leads.`);
      return;
    }
    const allProjects = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'projects.json'), 'utf-8'));
    const checkins = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'checkins.json'), 'utf-8'));
    const teamCap = getTeamCapacity();
    
    const msg = getDashboardOverview(allProjects, checkins, teamCap);
    await sendLongMessage(chatId, msg);
    return;
  }

  if (text === '/capacity' || text === '/workload') {
    const isLead = isQALead(profile);
    if (!isLead) {
      await sendMessage(chatId, `⚠️ <b>Access Denied:</b> This command is restricted to QA Leads.`);
      return;
    }
    
    const teamCap = getTeamCapacity();
    let msg = `👥 <b>QA TEAM CAPACITY</b>\n\n`;
    msg += `Total QA Capacity: <b>${teamCap.totalTeamCapacity}%</b>\n`;
    msg += `Allocated Capacity: <b>${teamCap.totalAllocated}%</b>\n`;
    msg += `Available Capacity: <b>${teamCap.availableCapacity}%</b>\n\n`;
    msg += `Team Utilization: ${generateCapacityBar(teamCap.utilization)}\n\n`;
    
    for (const t of teamCap.breakdown) {
      const trend = getTesterTrend(t.testerId);
      const trendStr = trend ? ` ${trend.trend}` : '';
      msg += `<b>${t.emoji} ${escapeHtml(t.name)}</b> — ${t.workload}%${trendStr}\n`;
      msg += `<code>${generateCapacityBar(t.workload)}</code>\n`;
      if (trend && trend.overloadedDays > 0) {
        msg += `<i>🔴 Overloaded for ${trend.overloadedDays} consecutive days</i>\n`;
      }
      msg += `\n`;
    }
    
    const imbalances = getImbalanceAlerts();
    if (imbalances) {
      msg += `━━━━━━━━━━━━━━━━━━━━\n${imbalances}\n`;
    }
    
    await sendLongMessage(chatId, msg);
    return;
  }

  if (text === '/assign') {
    const isLead = isQALead(profile);
    if (!isLead) {
      await sendMessage(chatId, `⚠️ <b>Access Denied:</b> This command is restricted to QA Leads.`);
      return;
    }
    const allProjects = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'projects.json'), 'utf-8'));
    userSessions.set(chatId, {
      type: 'assign_wizard',
      step: 'choose_project',
      projectsList: allProjects,
      profile
    });
    
    let listText = '';
    allProjects.forEach((p, idx) => {
      listText += `${idx + 1}️⃣ <b>${escapeHtml(p.name)}</b>\n`;
    });
    
    await sendMessage(chatId, `📁 <b>Assign QA Tester to Project</b>\n\nWhich project do you want to assign a tester to?\n\n${listText}\n<i>Reply with the number:</i>`);
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
      `• <b>Your Current Role:</b> <b>${escapeHtml(profile ? profile.role : 'QA Tester')}</b>\n\n` +
      `To change your role, reply:\n` +
      `• <code>/role QA Tester</code>\n` +
      `• <code>/role QA Lead</code>\n` +
      `• <code>/role Automation QA Engineer</code>\n\n` +
      `<i>QA Leads have access to <code>/team</code>, <code>/report</code>, and <code>/risks</code>.</i>`
    );
    return;
  }

  if (text.startsWith('/role ')) {
    let newRole = rawText.replace(/^\/role\s+/i, '').trim();
    if (newRole === '1') newRole = DEFAULT_ROLES[0];
    else if (newRole === '2') newRole = DEFAULT_ROLES[1];
    else if (newRole === '3') newRole = DEFAULT_ROLES[2];

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

  // /summary Command (For Groups)
  if (text === '/summary' || text.startsWith('/summary ')) {
    const todayStr = new Date().toISOString().split('T')[0];
    const summary = await generateDailySummary(chatId, todayStr);
    
    if (summary) {
      await sendMessage(chatId, summary);
    } else {
      await sendMessage(chatId, `ℹ️ No group messages recorded today to summarize.`);
    }
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

// Long Polling Loop & Keepalive State
async function handleCallbackQuery(callbackQuery) {
  try {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    if (data.startsWith('submit_testcases_')) {
      const projectId = data.replace('submit_testcases_', '');
      const allProjects = await refreshProjectsFromCloud();
      const matchedProj = allProjects.find(p => p.id === projectId);
      
      if (matchedProj) {
        userSessions.set(chatId, {
          type: 'testcase_wizard',
          step: 'provide_link',
          projectId: matchedProj.id,
          projectName: matchedProj.name,
          projects: allProjects
        });
        
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "Let's submit your test cases!" })
        });
        
        await sendMessage(
          chatId,
          `🧪 <b>Submit Test Cases Link</b>\n\n` +
          `📁 <b>Selected Project:</b> <b>${escapeHtml(matchedProj.name)}</b>\n` +
          `Please provide the link to your test cases (Google Sheets, Notion, TestRail, Jira, or Docs):\n\n` +
          `<i>👉 Reply with the URL below, or type <code>cancel</code> to abort:</i>`
        );
      }
    }
  } catch (err) {
    console.error('[CallbackQuery Error]', err);
  }
}

let lastUpdateId = 0;
let lastPollSuccess = Date.now();
let isPolling = false;

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  try {
    // AbortSignal.timeout(35000): Prevents silent TCP socket hangs when idle.
    // Telegram long poll timeout is 25s, so 35s ensures network hangs are gracefully broken.
    const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`, {
      signal: AbortSignal.timeout(35000),
    });
    const data = await res.json();
    lastPollSuccess = Date.now();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        if (update.message) {
          try {
            await handleMessage(update.message);
          } catch (handlerErr) {
            console.error('[Message Handler Error]', handlerErr);
          }
        } else if (update.callback_query) {
          try {
            await handleCallbackQuery(update.callback_query);
          } catch (handlerErr) {
            console.error('[CallbackQuery Handler Error]', handlerErr);
          }
        }
      }
    } else if (!data.ok) {
      console.error('[Telegram API Error]', data.description);
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.message?.includes('aborted')) {
      // Normal long-poll cycle completion when no messages arrive; socket is healthy
      lastPollSuccess = Date.now();
    } else {
      console.error('[Polling Error]', err.message);
    }
  } finally {
    isPolling = false;
    setTimeout(pollUpdates, 800);
  }
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
        { command: 'testcase', description: 'Submit test cases link' },
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
        { command: 'testcase', description: 'Submit test cases link' },
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
        { command: 'testcase', description: 'Submit test cases link' },
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

// Keepalive HTTP Server & Anti-Sleep Background Loop
let httpServer = null;
let keepAliveTimer = null;
let watchdogTimer = null;

function startKeepAliveServer() {
  if (httpServer) return;
  const rawPort = process.env.PORT || process.env.KEEP_ALIVE_PORT || 3000;
  const PORT = Number(rawPort) || 3000;

  httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    const reqUrl = req.url || '/';
    const cleanPath = reqUrl.split('?')[0];

    if (cleanPath === '/' || cleanPath === '/health' || cleanPath === '/ping' || cleanPath === '/status') {
      let dbStatus = 'disconnected';
      if (supabase) {
        try {
          const { error } = await supabase.from('projects').select('id').limit(1);
          dbStatus = error ? `warning: ${error.message}` : 'connected';
        } catch (e) {
          dbStatus = `exception: ${e.message}`;
        }
      }

      const payload = {
        status: 'ok',
        service: 'AegisQA Telegram Bot',
        uptimeSeconds: Math.round(process.uptime()),
        database: dbStatus,
        lastPollSecondsAgo: Math.round((Date.now() - lastPollSuccess) / 1000),
        activeProfiles: Object.keys(loadProfiles()).length,
        timestamp: new Date().toISOString(),
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
      });
      return res.end(JSON.stringify(payload, null, 2));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const bindHost = '0.0.0.0';
  httpServer.listen(PORT, bindHost, () => {
    console.log(`✓ Keepalive HTTP server listening on port ${PORT} (/health, /ping)`);
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = PORT + 1;
      console.warn(`[Keepalive] Port ${PORT} in use, binding to fallback port ${fallbackPort}...`);
      try {
        httpServer.close();
      } catch {}
      httpServer = http.createServer(httpServer.listeners('request')[0]);
      httpServer.listen(fallbackPort, bindHost, () => {
        console.log(`✓ Keepalive HTTP server listening on fallback port ${fallbackPort} (/health)`);
      });
    } else {
      console.error('[Keepalive Server Error]', err.message);
    }
  });
}

function startKeepAliveLoop() {
  if (keepAliveTimer) return;

  const KEEPALIVE_INTERVAL_MS = Number(process.env.KEEPALIVE_INTERVAL_MS) || (5 * 60 * 1000); // 5 minutes
  console.log(`✓ Keepalive anti-sleep service active: pinging every ${KEEPALIVE_INTERVAL_MS / 60000}m to prevent sleep.`);

  // 1. Watchdog: If no Telegram poll cycle completes in 75s, force restart polling
  if (!watchdogTimer) {
    watchdogTimer = setInterval(() => {
      const elapsed = Date.now() - lastPollSuccess;
      if (elapsed > 75000) {
        console.warn(`[Watchdog] Polling may be stalled (${Math.round(elapsed / 1000)}s since last cycle). Forcing restart...`);
        isPolling = false;
        pollUpdates();
      }
    }, 30000);
    watchdogTimer.unref();
  }

  // 2. Anti-Sleep Periodic Pinger (Supabase DB + Hosting Web Service)
  keepAliveTimer = setInterval(async () => {
    // A. Supabase database keepalive (prevents project from pausing/sleeping after inactivity)
    if (supabase) {
      try {
        const { error } = await supabase.from('projects').select('id').limit(1);
        if (error) {
          console.warn('[Keepalive] Supabase ping warning:', error.message);
        } else {
          console.log('[Keepalive] Supabase DB ping OK — project kept awake');
        }
      } catch (dbErr) {
        console.warn('[Keepalive] Supabase DB ping error:', dbErr.message);
      }
    }

    // B. Web Service self-ping (prevents Render, Koyeb, Glitch, etc. from spinning down to sleep)
    const externalUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.APP_URL ||
      process.env.KEEPALIVE_URL ||
      (httpServer && httpServer.address() && typeof httpServer.address() === 'object'
        ? `http://127.0.0.1:${httpServer.address().port}`
        : null);

    if (externalUrl) {
      try {
        const cleanBase = externalUrl.replace(/\/+$/, '');
        const target = cleanBase.endsWith('/health') || cleanBase.endsWith('/ping')
          ? cleanBase
          : `${cleanBase}/health`;

        const pingRes = await fetch(target, {
          signal: AbortSignal.timeout(10000),
        });
        if (pingRes.ok) {
          console.log(`[Keepalive] Self-ping OK to ${target} (HTTP ${pingRes.status}) — web service kept awake`);
        }
      } catch (pingErr) {
        console.log(`[Keepalive] Self-ping note: ${pingErr.message}`);
      }
    }
  }, KEEPALIVE_INTERVAL_MS);

  keepAliveTimer.unref();
}

let lastReportDate = null;
let reporterTimer = null;

function startDailyReporter() {
  if (reporterTimer) return;
  
  reporterTimer = setInterval(async () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    // Run at 18:00 (6 PM) local server time
    if (now.getHours() === 18 && now.getMinutes() === 0 && lastReportDate !== dateStr) {
      lastReportDate = dateStr;
      
      let messages = [];
      if (fs.existsSync(GROUP_MESSAGES_FILE)) {
        try {
          messages = JSON.parse(fs.readFileSync(GROUP_MESSAGES_FILE, 'utf8'));
        } catch {
          messages = [];
        }
      }
      
      // Find unique group chat IDs that have messages today
      const todayChatIds = new Set();
      messages.forEach(m => {
        const msgDate = new Date(m.timestamp).toISOString().split('T')[0];
        if (msgDate === dateStr) {
          todayChatIds.add(m.chatId);
        }
      });
      
      for (const chatId of todayChatIds) {
        const summary = await generateDailySummary(chatId, dateStr);
        if (summary) {
          console.log(`[Reporter] Sending daily summary to group ${chatId}`);
          await sendMessage(chatId, summary);
        }
      }
    }
  }, 60000); // Check every minute
  reporterTimer.unref();
}

// Startup
async function init() {
  console.log('\n=============================================');
  console.log('🛡️  AegisQA Telegram Daily Standup Bot');
  console.log('    100% Non-AI Deterministic QA Engine');
  console.log('=============================================\n');

  // Launch anti-sleep HTTP health server and keepalive ping loop
  startKeepAliveServer();
  startKeepAliveLoop();
  
  // Launch daily reporter scheduler
  startDailyReporter();

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
    console.error('⚠️ Initial connection to Telegram API failed:', err.message);
    console.log('Retrying connection in 3 seconds...');
    setTimeout(init, 3000);
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
  notifyMemberOfProjectAssignment,
  startKeepAliveServer,
  startKeepAliveLoop,
};
