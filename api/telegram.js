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

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '');
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deduplicateProjects(projectsList) {
  if (!Array.isArray(projectsList)) return [];
  const seen = new Map();
  for (const p of projectsList) {
    const key = (p.name || '').trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, p);
    } else {
      const existing = seen.get(key);
      const pCount = Object.keys(p.resources || {}).length;
      const existCount = Object.keys(existing.resources || {}).length;
      if (pCount > existCount) {
        seen.set(key, p);
      }
    }
  }
  return Array.from(seen.values());
}

function isQALead(profile) {
  if (!profile || !profile.role) return false;
  const r = String(profile.role).toLowerCase();
  return r.includes('lead') || r.includes('manager') || r === 'qa_lead' || r === 'admin';
}

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

  const commaNums = text.split(/[,/ ]+/).map((s) => s.trim()).filter(Boolean);
  if (commaNums.length === 4 && commaNums.every((n) => !isNaN(parseInt(n, 10)))) {
    critical = parseInt(commaNums[0], 10) || 0;
    high = parseInt(commaNums[1], 10) || 0;
    medium = parseInt(commaNums[2], 10) || 0;
    low = parseInt(commaNums[3], 10) || 0;
  } else {
    const critMatch = lower.match(/(\d+)\s*(?:crit|critical)/i) || lower.match(/(?:crit|critical)[\s:]*(\d+)/i);
    const highMatch = lower.match(/(\d+)\s*(?:high)/i) || lower.match(/(?:high)[\s:]*(\d+)/i);
    const medMatch = lower.match(/(\d+)\s*(?:med|medium)/i) || lower.match(/(?:med|medium)[\s:]*(\d+)/i);
    const lowMatch = lower.match(/(\d+)\s*(?:low)/i) || lower.match(/(?:low)[\s:]*(\d+)/i);

    if (critMatch) critical = parseInt(critMatch[1], 10) || 0;
    if (highMatch) high = parseInt(highMatch[1], 10) || 0;
    if (medMatch) medium = parseInt(medMatch[1], 10) || 0;
    if (lowMatch) low = parseInt(lowMatch[1], 10) || 0;

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

function deduplicateMemberReports(reportsList) {
  const byMember = new Map();
  const sorted = [...reportsList].sort((a, b) => {
    const timeA = new Date(a.submitted_at || a.submittedAt || 0).getTime();
    const timeB = new Date(b.submitted_at || b.submittedAt || 0).getTime();
    return timeB - timeA;
  });

  for (const r of sorted) {
    const key = (r.member_id || r.memberId || r.chat_id || r.chatId || r.member_name || r.memberName || '').toLowerCase();
    if (!byMember.has(key)) {
      byMember.set(key, r);
    }
  }
  return Array.from(byMember.values());
}

function unpackReportMeta(r) {
  let workStatus = (r.is_blocked || r.isBlocked) ? 'Blocked' : 'On Track';
  let statusEmoji = (r.is_blocked || r.isBlocked) ? '🔴' : '🟢';
  let bugsSummary = 'None';
  let bugsFound = { critical: 0, high: 0, medium: 0, low: 0, total: 0, summary: 'None' };
  let risks = 'None';

  const exp = r.expected_completion || r.expectedCompletion || '';
  if (exp.includes('Blocked')) {
    workStatus = 'Blocked';
    statusEmoji = '🔴';
  } else if (exp.includes('Risk') || exp.includes('At Risk')) {
    workStatus = 'At Risk';
    statusEmoji = '🟡';
  } else if (exp.includes('Track') || exp.includes('On Track')) {
    workStatus = 'On Track';
    statusEmoji = '🟢';
  }

  const rawNotes = r.notes || '';
  if (rawNotes) {
    try {
      const parsed = JSON.parse(rawNotes);
      if (parsed.workStatus) workStatus = parsed.workStatus;
      if (parsed.statusEmoji) statusEmoji = parsed.statusEmoji;
      if (parsed.bugsSummary) bugsSummary = parsed.bugsSummary;
      if (parsed.bugsBreakdown) bugsFound = parsed.bugsBreakdown;
      if (parsed.risks) risks = parsed.risks;
    } catch {}
  }

  if (r.workStatus) workStatus = r.workStatus;
  if (r.statusEmoji) statusEmoji = r.statusEmoji;
  if (r.bugsSummary) bugsSummary = r.bugsSummary;
  if (r.risks) risks = r.risks;

  return { workStatus, statusEmoji, bugsSummary, bugsFound, risks };
}

function formatProjectReportText(projectName, memberReports, openBlockers = [], options = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const totalMembers = memberReports.length;
  const blockedCount = memberReports.filter((r) => {
    const meta = unpackReportMeta(r);
    return r.is_blocked || r.isBlocked || meta.workStatus === 'Blocked';
  }).length;
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
    const meta = unpackReportMeta(r);
    const rDate = r.date;
    const rName = r.member_name || r.memberName || 'QA Member';
    const rRole = r.role || 'QA Engineer';
    const rYesterday = r.yesterday_completed || r.yesterdayCompleted || 'No tasks recorded';
    const rToday = r.today_working_on || r.todayWorkingOn || 'In progress';
    const isBlocked = r.is_blocked || r.isBlocked || meta.workStatus === 'Blocked';
    const rBlockers = r.blockers;

    const dateTag = (rDate && rDate !== todayStr) ? ` <i>(${rDate})</i>` : '';
    const blockerTag = isBlocked && rBlockers && rBlockers.toLowerCase() !== 'none'
      ? `🚨 <b>Blocker:</b> ${escapeHtml(rBlockers)}`
      : `🟢 <b>Blockers:</b> None`;

    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `👤 <b>${escapeHtml(rName)}</b> <i>(${escapeHtml(rRole)})</i>${dateTag}\n`;
    out += `• <b>Status:</b> ${meta.statusEmoji} ${escapeHtml(meta.workStatus)}\n`;
    out += `• <b>Yesterday:</b> ${escapeHtml(rYesterday)}\n`;
    out += `• <b>Today:</b> ${escapeHtml(rToday)}\n`;
    if (meta.bugsSummary && meta.bugsSummary !== 'None') {
      out += `• <b>Bugs:</b> ${escapeHtml(meta.bugsSummary.replace(/\n/g, ', '))}\n`;
    }
    out += `• ${blockerTag}\n`;
    if (meta.risks && meta.risks.toLowerCase() !== 'none') {
      out += `• <b>Risk:</b> <i>${escapeHtml(meta.risks)}</i>\n`;
    }
  });

  if (openBlockers.length > 0 && !isAllView) {
    out += `\n🚨 <b>ACTIVE PROJECT BLOCKERS (${openBlockers.length}):</b>\n`;
    openBlockers.forEach((b, i) => {
      out += `${i + 1}. <b>${escapeHtml(b.title || 'Blocker')}</b>\n`;
      if (b.description) out += `   <i>"${escapeHtml(b.description)}"</i>\n`;
      out += `   👤 Reported by: ${escapeHtml(b.reported_by || b.reportedBy || 'Team Member')}\n`;
    });
  }

  return out;
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
    const meta = unpackReportMeta(r);
    const status = meta.workStatus.toLowerCase();
    if (status.includes('block') || r.is_blocked || r.isBlocked) {
      blockedCount++;
    } else if (status.includes('risk')) {
      atRiskCount++;
    } else {
      onTrackCount++;
    }

    if (meta.bugsFound) {
      repCritical += meta.bugsFound.critical || 0;
      repHigh += meta.bugsFound.high || 0;
      repMedium += meta.bugsFound.medium || 0;
      repLow += meta.bugsFound.low || 0;
    }

    if (meta.risks && meta.risks.toLowerCase() !== 'none' && meta.risks.trim().length > 0) {
      activeRisksList.push({ member: r.member_name || r.memberName || 'QA Member', risk: meta.risks });
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
        out += `• <b>${escapeHtml(b.title || 'Blocker')}</b>: <i>"${escapeHtml(b.description || 'Impacting testing')}"</i> (by ${escapeHtml(b.reported_by || b.reportedBy || 'Team')})\n`;
      });
      if (openBlockers.length > 3) out += `  <i>+ ${openBlockers.length - 3} more blockers</i>\n`;
    }
    if (blockedCount > 0 && openBlockers.length === 0) {
      const blockedMembers = memberReports.filter((r) => {
        const meta = unpackReportMeta(r);
        return r.is_blocked || r.isBlocked || meta.workStatus === 'Blocked';
      });
      blockedMembers.forEach((m) => {
        out += `• 👤 <b>${escapeHtml(m.member_name || m.memberName)}:</b> <i>"${escapeHtml(m.blockers || 'Marked blocked in standup')}"</i>\n`;
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
    const meta = unpackReportMeta(memberReport);
    out += `👤 <b>Your Latest Standup:</b>\n`;
    out += `• <b>Status:</b> ${meta.statusEmoji} ${escapeHtml(meta.workStatus)}\n`;
    out += `• <b>Today:</b> ${escapeHtml(memberReport.today_working_on || memberReport.todayWorkingOn || 'In progress')}\n`;
    if (memberReport.blockers && memberReport.blockers.toLowerCase() !== 'none') {
      out += `• 🚨 <b>Blocker:</b> ${escapeHtml(memberReport.blockers)}\n`;
    }
    if (meta.bugsSummary && meta.bugsSummary !== 'None') {
      out += `• 🐞 <b>Bugs:</b> ${escapeHtml(meta.bugsSummary.replace(/\n/g, ', '))}\n`;
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
    const meta = unpackReportMeta(r);
    const st = meta.workStatus.toLowerCase();
    if (st.includes('block') || r.is_blocked || r.isBlocked) blocked++;
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
    const meta = unpackReportMeta(r);
    const isToday = r.date === todayStr;
    const dateTag = !isToday && r.date ? ` <i>(${r.date})</i>` : '';

    out += `${meta.statusEmoji} <b>${escapeHtml(r.member_name || r.memberName || 'QA Member')}</b> <i>(${escapeHtml(r.role || 'QA Engineer')})</i>${dateTag}\n`;
    out += `• <b>Status:</b> ${meta.statusEmoji} ${escapeHtml(meta.workStatus)}\n`;
    out += `• <b>Yesterday:</b> ${escapeHtml(r.yesterday_completed || r.yesterdayCompleted || 'None recorded')}\n`;
    out += `• <b>Today:</b> ${escapeHtml(r.today_working_on || r.todayWorkingOn || 'In progress')}\n`;
    if (meta.bugsSummary && meta.bugsSummary !== 'None') {
      out += `• 🐞 <b>Bugs:</b> ${escapeHtml(meta.bugsSummary.replace(/\n/g, ', '))}\n`;
    }
    if (r.blockers && r.blockers.toLowerCase() !== 'none') {
      out += `• 🚨 <b>Blocker:</b> <i>${escapeHtml(r.blockers)}</i>\n`;
    }
    if (meta.risks && meta.risks.toLowerCase() !== 'none') {
      out += `• ⚠️ <b>Risk:</b> <i>${escapeHtml(meta.risks)}</i>\n`;
    }
    if (idx < memberReports.length - 1) {
      out += `\n`;
    }
  });

  return out;
}

// Format formatted text for QA Lead /risks command (QA risks, blockers & defect exposures)
function formatQARisksText(project, openBlockers = [], memberReports = [], bugs = [], options = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const isAllView = Boolean(options.isAllView);
  const blockedMembers = memberReports.filter((r) => (r.is_blocked || r.isBlocked) && r.blockers);
  const criticalBugs = bugs.filter((b) => b.severity === 'Critical' && b.status !== 'Closed');
  const highBugs = bugs.filter((b) => b.severity === 'High' && b.status !== 'Closed');
  const qaProgress = project.qa_progress ?? project.qaProgress ?? 74;

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

  if (openBlockers.length > 0) {
    hasRisks = true;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🚨 <b>Active Project Blockers (${openBlockers.length}):</b>\n`;
    openBlockers.forEach((b, i) => {
      out += `${i + 1}. <b>${escapeHtml(b.title || 'Blocker')}</b>\n`;
      if (b.description) out += `   <i>"${escapeHtml(b.description)}"</i>\n`;
      out += `   👤 Reported by: ${escapeHtml(b.reported_by || b.reportedBy || 'Team Member')} • Status: <b>${escapeHtml(b.status || 'Open')}</b>\n`;
    });
  }

  if (blockedMembers.length > 0) {
    hasRisks = true;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `👥 <b>Blocked Team Members (${blockedMembers.length}):</b>\n`;
    blockedMembers.forEach((m) => {
      out += `• <b>${escapeHtml(m.member_name || m.memberName || 'QA Member')}:</b> <i>"${escapeHtml(m.blockers)}"</i>\n`;
    });
  }

  if (criticalBugs.length > 0 || highBugs.length > 0) {
    hasRisks = true;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🐛 <b>Defect Exposure (${criticalBugs.length} Critical, ${highBugs.length} High):</b>\n`;
    criticalBugs.forEach((b) => {
      out += `• 🔴 [${escapeHtml(b.id)}] <b>${escapeHtml(b.title)}</b>\n`;
      out += `  Severity: <b>Critical</b> • Status: ${escapeHtml(b.status)} • Module: ${escapeHtml(b.module || 'General')}\n`;
    });
    highBugs.slice(0, 3).forEach((b) => {
      out += `• 🟡 [${escapeHtml(b.id)}] <b>${escapeHtml(b.title)}</b>\n`;
      out += `  Severity: <b>High</b> • Status: ${escapeHtml(b.status)} • Module: ${escapeHtml(b.module || 'General')}\n`;
    });
    if (highBugs.length > 3) {
      out += `  <i>+ ${highBugs.length - 3} more high severity bugs</i>\n`;
    }
  }

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

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return;
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('Telegram sendMessage HTML rejected:', data.description);
      if (data.description && (data.description.includes('parse entities') || data.description.includes('tag'))) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: stripHtml(text),
          }),
        });
      }
    }
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

async function notifyQALeadsOfBlockerWebhook({
  senderChatId,
  memberName,
  username,
  projectName,
  projectId,
  reason,
  severity = 'Critical',
}) {
  if (!supabase) return;
  try {
    const { data: leadProfiles } = await supabase
      .from('telegram_profiles')
      .select('*');
    if (!leadProfiles || leadProfiles.length === 0) return;

    const leads = leadProfiles.filter((p) => {
      const isLead = isQALead(p);
      const notSender = String(p.chat_id) !== String(senderChatId);
      return isLead && notSender;
    });

    if (leads.length === 0) return;

    const timeStr = new Date().toLocaleTimeString();
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

    for (const lead of leads) {
      await sendTelegramMessage(lead.chat_id, msg);
    }
  } catch (err) {
    console.error('Error notifying QA Leads of blocker:', err);
  }
}

async function notifyQALeadsOfBlockerResolvedWebhook({
  senderChatId,
  memberName,
  username,
  projectName,
  projectId,
  resolvedBlockers = [],
}) {
  if (!supabase) return;
  try {
    const { data: leadProfiles } = await supabase
      .from('telegram_profiles')
      .select('*');
    if (!leadProfiles || leadProfiles.length === 0) return;

    const leads = leadProfiles.filter((p) => {
      const isLead = isQALead(p);
      const notSender = String(p.chat_id) !== String(senderChatId);
      return isLead && notSender;
    });

    if (leads.length === 0) return;

    const timeStr = new Date().toLocaleTimeString();
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

    for (const lead of leads) {
      await sendTelegramMessage(lead.chat_id, msg);
    }
  } catch (err) {
    console.error('Error notifying QA Leads of resolved blocker:', err);
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

  // Support direct outbound notification dispatch from the web portal (bypasses browser CORS)
  if (req.body && (req.body.action === 'send_message' || req.body.action === 'send_notification')) {
    const { chatId, text, parse_mode } = req.body;
    if (chatId && text) {
      await sendTelegramMessage(chatId, text, parse_mode || 'HTML');
      return res.status(200).json({ ok: true });
    }
  }

  const update = req.body;
  if (!update || !update.message) {
    return res.status(200).json({ ok: true });
  }

  const message = update.message;
  const chatId = message.chat?.id;
  const rawText = message.text?.trim() || '';
  const text = rawText.toLowerCase();
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
    if (text === '/start' || text === 'start' || text === '/help' || text === 'help') {
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
          `• /role [title] — Switch your QA role (e.g. /role QA Engineer)`
        : `<b>Available Commands:</b>\n` +
          `• /checkin — Submit daily QA standup\n` +
          `• /project — Switch active project\n` +
          `• /blocker &lt;reason&gt; — Report urgent blocker\n` +
          `• /resolve — Resolve active blocker\n` +
          `• /profile — View and update profile\n` +
          `• /status — View relevant QA status\n` +
          `• /role [title] — Switch your QA role`;

      const welcome = profile
        ? `🛡️ <b>Welcome to AegisQA, ${profile.full_name}!</b>\n\n` +
          `👤 <b>Role:</b> ${profile.role}\n` +
          `🚀 <b>Active Project:</b> ${profile.project_name}\n\n` +
          commandsList
        : `🛡️ <b>Welcome to AegisQA Telegram Bot!</b>\n\n` +
          `You are connected to the cloud QA command center.\n` +
          `Your Chat ID is: <code>${chatId}</code>\n\n` +
          `• Type /status to view QA & project status\n` +
          `• Type /team to view team members & progress (QA Lead)\n` +
          `• Type /project to view or select projects\n` +
          `• Type /role to set your role\n` +
          `• Type /blocker &lt;reason&gt; to alert QA Leads of an issue`;

      await sendTelegramMessage(chatId, welcome);
      return res.status(200).json({ ok: true });
    }

    // 2b. /profile Command
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

      await sendTelegramMessage(
        chatId,
        `👤 <b>AegisQA Profile</b>\n\n` +
        `• <b>Full Name:</b> ${escapeHtml(profile ? profile.full_name : (fromUser.first_name || 'QA Tester'))}\n` +
        `• <b>QA Role:</b> ${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}\n` +
        `• <b>Active Project:</b> ${escapeHtml(profile ? profile.project_name : 'Banking SuperApp')}\n` +
        `• <b>Telegram:</b> @${escapeHtml(fromUser.username || 'n/a')}\n` +
        `• <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
        profileQuickCommands
      );
      return res.status(200).json({ ok: true });
    }

    // 3. /project Command
    if (text === '/project' || text === '/projects') {
      let projects = [];
      if (supabase) {
        const { data } = await supabase.from('projects').select('id, name, member_ids').order('created_at', { ascending: false });
        projects = deduplicateProjects(data || []);
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
        const { data } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });
        projects = deduplicateProjects(data || []);
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

    // 4b. /testcase command
    if (text === '/testcase' || text === 'testcase' || text === '/testcases' || text.startsWith('/testcase ') || text.startsWith('/testcases ')) {
      let projects = [];
      if (supabase) {
        const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        projects = deduplicateProjects(data || []);
      }

      const rawArg = text.replace(/^\/testcases?\s*/i, '').trim();

      // If user provided: /testcase <Project Name> - <URL>
      if (rawArg.includes(' - ') && (rawArg.includes('http://') || rawArg.includes('https://'))) {
        const [projPart, ...urlParts] = rawArg.split(' - ');
        const candidateUrl = urlParts.join(' - ').trim();
        const matched = projects.find(
          (p) => p.name.toLowerCase() === projPart.trim().toLowerCase() || p.id.toLowerCase() === projPart.trim().toLowerCase()
        ) || projects.find((p) => p.name.toLowerCase().includes(projPart.trim().toLowerCase()));

        if (matched) {
          let finalUrl = candidateUrl;
          if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) finalUrl = `https://${finalUrl}`;
          const updatedRes = { ...(matched.resources || {}), testCaseUrl: finalUrl, testCaseTitle: `${matched.name} Test Cases` };
          if (supabase) {
            await supabase.from('projects').update({ resources: updatedRes, updated_at: new Date().toISOString() }).eq('id', matched.id);
          }
          await sendTelegramMessage(
            chatId,
            `✅ <b>Test Cases Link Submitted!</b>\n\n` +
            `📁 <b>Project:</b> <b>${escapeHtml(matched.name)}</b>\n` +
            `🔗 <b>Test Cases Link:</b> <a href="${escapeHtml(finalUrl)}">${escapeHtml(finalUrl)}</a>\n\n` +
            `<i>The link has been saved and is now placed right beside PRD and Figma in the project dashboard.</i>`
          );
          return res.status(200).json({ ok: true });
        }
      }

      // If just URL provided and user is currently assigned to a project
      if ((rawArg.startsWith('http://') || rawArg.startsWith('https://')) && profile && profile.project_id) {
        const matched = projects.find((p) => p.id === profile.project_id) || projects[0];
        if (matched) {
          const finalUrl = rawArg.trim();
          const updatedRes = { ...(matched.resources || {}), testCaseUrl: finalUrl, testCaseTitle: `${matched.name} Test Cases` };
          if (supabase) {
            await supabase.from('projects').update({ resources: updatedRes, updated_at: new Date().toISOString() }).eq('id', matched.id);
          }
          await sendTelegramMessage(
            chatId,
            `✅ <b>Test Cases Link Submitted!</b>\n\n` +
            `📁 <b>Project:</b> <b>${escapeHtml(matched.name)}</b>\n` +
            `🔗 <b>Test Cases Link:</b> <a href="${escapeHtml(finalUrl)}">${escapeHtml(finalUrl)}</a>\n\n` +
            `<i>The link has been saved and is now placed right beside PRD and Figma in the project dashboard.</i>`
          );
          return res.status(200).json({ ok: true });
        }
      }

      // Prompt to choose project first
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
        else if (isAssigned) tag = ' 🟢 <i>(Assigned)</i>';

        listText += `${emoji} <b>${escapeHtml(p.name)}</b>${tag}\n`;
      });

      await sendTelegramMessage(
        chatId,
        `🧪 <b>Submit Test Cases Link</b>\n\n` +
        `<b>Please choose the project:</b>\n\n` +
        listText + '\n' +
        `<i>Reply with format:</i>\n<code>/testcase &lt;Project Name&gt; - &lt;URL&gt;</code>\n\n` +
        `<i>Example:</i> <code>/testcase Crypto Vault Wallet - https://docs.google.com/spreadsheets/d/...</code>`
      );
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

      // Proactively notify QA Lead(s)
      notifyQALeadsOfBlockerWebhook({
        senderChatId: chatId,
        memberName,
        username: fromUser.username || fromUser.first_name,
        projectName,
        projectId,
        reason,
        severity: 'Critical',
      }).catch((err) => console.error('Blocker notification error:', err));

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

    // 6. /resolve or /unblock or "the bug is resolved"
    const isResolveIntent =
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

    if (isResolveIntent) {
      if (supabase) {
        const { data: openBlockers } = await supabase
          .from('blockers')
          .select('*')
          .eq('chat_id', String(chatId))
          .neq('status', 'Resolved');

        if (!openBlockers || openBlockers.length === 0) {
          await sendTelegramMessage(chatId, `🎉 <b>No Active Blockers Found!</b>\n\nYou currently have no open blockers in the system.`);
          return res.status(200).json({ ok: true });
        }

        await supabase
          .from('blockers')
          .update({
            status: 'Resolved',
          })
          .eq('chat_id', String(chatId))
          .neq('status', 'Resolved');

        // Proactively notify QA Lead(s) of resolved blocker(s)
        notifyQALeadsOfBlockerResolvedWebhook({
          senderChatId: chatId,
          memberName: profile ? profile.full_name : (fromUser.first_name || 'QA Member'),
          username: fromUser.username || fromUser.first_name,
          projectName: profile ? profile.project_name : (openBlockers[0]?.project_name || 'QA Project'),
          projectId: profile ? profile.project_id : (openBlockers[0]?.project_id || ''),
          resolvedBlockers: openBlockers,
        }).catch((err) => console.error('Blocker resolved notification error:', err));

        await sendTelegramMessage(
          chatId,
          `✅ <b>Blocker(s) Resolved!</b>\n\n` +
          `The following blocker(s) have been marked as <b>Resolved</b>:\n` +
          openBlockers.map(b => `• <b>${b.title}</b> (${b.description})`).join('\n') +
          `\n\nThey have been removed from the blocked tasks on the QA Command Center Dashboard!`
        );
        return res.status(200).json({ ok: true });
      }
    }

    // 7. /report [project] Command for QA Lead
    if (text === '/report' || text.startsWith('/report ') || text === '/reports' || text.startsWith('/reports ') || text === '/dailyreport' || text.startsWith('/dailyreport ')) {
      const isLead = isQALead(profile);

      if (!isLead) {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Access Restricted: QA Lead Only</b>\n\n` +
          `The <code>/report</code> command generates consolidated daily standup reports from all team members and is reserved for <b>QA Leads</b>.\n\n` +
          `👤 <b>Your Current Profile:</b>\n` +
          `• Name: ${escapeHtml(profile ? profile.full_name : (fromUser.first_name || 'QA Member'))}\n` +
          `• Role: <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n` +
          `• Project: ${escapeHtml(profile ? profile.project_name : 'None')}\n\n` +
          `💡 <i>If you are the QA Lead, reply with:</i>\n` +
          `<code>/role QA Lead</code> to update your role.`
        );
        return res.status(200).json({ ok: true });
      }

      const rawArg = rawText.replace(/^\/(report|reports|dailyreport)\s*/i, '').trim();
      const arg = rawArg.toLowerCase();
      const todayStr = new Date().toISOString().split('T')[0];

      let projects = [];
      let allReports = [];
      let allBlockers = [];

      if (supabase) {
        const [projRes, repRes, blkRes] = await Promise.all([
          supabase.from('projects').select('id, name'),
          supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }),
          supabase.from('blockers').select('*').neq('status', 'Resolved').order('created_at', { ascending: false }),
        ]);
        projects = deduplicateProjects(projRes.data || []);
        allReports = repRes.data || [];
        allBlockers = blkRes.data || [];
      }

      if (projects.length === 0) {
        projects = [
          { id: 'prj-banking', name: 'Banking SuperApp' },
          { id: 'prj-mobile', name: 'Mobile Banking iOS & Android' },
          { id: 'prj-merchant', name: 'Merchant Payment Gateway' },
          { id: 'prj-nextgen', name: 'NextGen Mobile Banking' },
        ];
      }

      // CASE 1: /report all
      if (arg === 'all') {
        const projectMap = new Map();
        projects.forEach((p) => {
          projectMap.set(p.id, { id: p.id, name: p.name, reports: [], blockers: [] });
        });

        allReports.forEach((r) => {
          const pId = r.project_id || 'prj-unknown';
          if (!projectMap.has(pId)) {
            projectMap.set(pId, { id: pId, name: r.project_name || 'General Project', reports: [], blockers: [] });
          }
          projectMap.get(pId).reports.push(r);
        });

        allBlockers.forEach((b) => {
          const pId = b.project_id || 'prj-unknown';
          if (!projectMap.has(pId)) {
            projectMap.set(pId, { id: pId, name: b.project_name || 'General Project', reports: [], blockers: [] });
          }
          projectMap.get(pId).blockers.push(b);
        });

        const activeProjects = Array.from(projectMap.values()).filter(
          (p) => p.reports.length > 0 || p.blockers.length > 0
        );

        if (activeProjects.length === 0) {
          await sendTelegramMessage(
            chatId,
            `📋 <b>QA LEAD - ALL PROJECTS DAILY REPORT</b>\n` +
            `📅 <b>Date:</b> <code>${todayStr}</code>\n\n` +
            `ℹ️ No team daily reports have been submitted yet today.\n\n` +
            `<i>Team members can submit their updates via Telegram standup bot.</i>`
          );
          return res.status(200).json({ ok: true });
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

        await sendTelegramMessage(chatId, fullMsg);
        return res.status(200).json({ ok: true });
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
              (r) => (r.project_name && r.project_name.toLowerCase().includes(arg)) || (r.project_id && r.project_id.toLowerCase().includes(arg))
            );
            if (reportMatch) {
              selectedProject = {
                id: reportMatch.project_id,
                name: reportMatch.project_name,
              };
            }
          }
        }

        if (!selectedProject) {
          let availableList = projects.map((p, idx) => `${NUMBER_EMOJIS[idx] || `[${idx + 1}]`} ${p.name}`).join('\n');
          await sendTelegramMessage(
            chatId,
            `⚠️ <b>Project "${escapeHtml(rawArg)}" not found.</b>\n\n` +
            `<b>Available Projects:</b>\n` +
            availableList + '\n\n' +
            `<i>Reply <code>/report &lt;project name or number&gt;</code> or <code>/report all</code></i>`
          );
          return res.status(200).json({ ok: true });
        }
      } else {
        const activeProjName = profile ? profile.project_name : 'Banking SuperApp';
        const activeProjId = profile ? profile.project_id : 'prj-banking';
        selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
          id: activeProjId,
          name: activeProjName,
        };
      }

      const projReports = allReports.filter(
        (r) => r.project_id === selectedProject.id || (r.project_name && r.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );
      const dedupedReports = deduplicateMemberReports(projReports);
      const projBlockers = allBlockers.filter(
        (b) => b.project_id === selectedProject.id || (b.project_name && b.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );

      let reportMsg = formatProjectReportText(selectedProject.name, dedupedReports, projBlockers, { isAllView: false });

      const otherProjects = [];
      const otherProjNames = new Set();
      allReports.forEach((r) => {
        const pName = r.project_name || 'General';
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

      await sendTelegramMessage(chatId, reportMsg);
      return res.status(200).json({ ok: true });
    }

    // 8. /team Command for QA Lead (team daily report & testing progress)
    if (text === '/team' || text.startsWith('/team ') || text === '/progress' || text.startsWith('/progress ') || text === '/teamreport' || text.startsWith('/teamreport ')) {
      const isLead = isQALead(profile);

      if (!isLead) {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Access Restricted: QA Lead Only</b>\n\n` +
          `The <code>/team</code> command provides team daily standup updates and testing progress and is reserved for <b>QA Leads</b>.\n\n` +
          `👤 <b>Your Current Profile:</b>\n` +
          `• Name: ${escapeHtml(profile ? profile.full_name : (fromUser.first_name || 'QA Member'))}\n` +
          `• Role: <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n` +
          `• Project: ${escapeHtml(profile ? profile.project_name : 'None')}\n\n` +
          `💡 <i>If you are the QA Lead, reply with:</i>\n` +
          `<code>/role QA Lead</code> to update your role.`
        );
        return res.status(200).json({ ok: true });
      }

      const rawArg = rawText.replace(/^\/(team|progress|teamreport)\s*/i, '').trim();
      const arg = rawArg.toLowerCase();
      const todayStr = new Date().toISOString().split('T')[0];

      let projects = [];
      let allReports = [];
      let allBlockers = [];

      if (supabase) {
        const [projRes, repRes, blkRes] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }),
          supabase.from('blockers').select('*').neq('status', 'Resolved').order('created_at', { ascending: false }),
        ]);
        projects = deduplicateProjects(projRes.data || []);
        allReports = repRes.data || [];
        allBlockers = blkRes.data || [];
      }

      if (projects.length === 0) {
        projects = [
          { id: 'prj-banking', name: 'Banking SuperApp', qa_progress: 74, regression_progress: 62 },
          { id: 'prj-mobile', name: 'Mobile Banking iOS & Android', qa_progress: 81, regression_progress: 78 },
          { id: 'prj-merchant', name: 'Merchant Payment Gateway', qa_progress: 35, regression_progress: 15 },
          { id: 'prj-nextgen', name: 'NextGen Mobile Banking', qa_progress: 20, regression_progress: 10 },
        ];
      }

      // CASE 1: /team all
      if (arg === 'all') {
        let fullMsg = `👥 <b>QA LEAD - ALL PROJECTS TEAM PROGRESS</b>\n`;
        fullMsg += `📅 <b>Date:</b> <code>${todayStr}</code>\n`;
        fullMsg += `📋 <b>Total Projects:</b> ${projects.length}\n\n`;

        projects.forEach((proj) => {
          const projReports = allReports.filter(
            (r) => r.project_id === proj.id || (r.project_name && r.project_name.toLowerCase() === proj.name.toLowerCase())
          );
          const deduped = deduplicateMemberReports(projReports);
          const projBlockers = allBlockers.filter(
            (b) => b.project_id === proj.id || (b.project_name && b.project_name.toLowerCase() === proj.name.toLowerCase())
          );

          fullMsg += `==============================\n`;
          fullMsg += formatTeamProgressText(proj, deduped, projBlockers, { isAllView: true }) + '\n';
        });

        fullMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
        fullMsg += `💡 <i>View specific project: <code>/team &lt;name or number&gt;</code> • QA Risks: <code>/risks</code></i>`;

        await sendTelegramMessage(chatId, fullMsg);
        return res.status(200).json({ ok: true });
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
              (r) => (r.project_name && r.project_name.toLowerCase().includes(arg)) || (r.project_id && r.project_id.toLowerCase().includes(arg))
            );
            if (reportMatch) {
              selectedProject = {
                id: reportMatch.project_id,
                name: reportMatch.project_name,
                qa_progress: 70,
                regression_progress: 60,
              };
            }
          }
        }

        if (!selectedProject) {
          let availableList = projects.map((p, idx) => `${NUMBER_EMOJIS[idx] || `[${idx + 1}]`} ${p.name}`).join('\n');
          await sendTelegramMessage(
            chatId,
            `⚠️ <b>Project "${escapeHtml(rawArg)}" not found.</b>\n\n` +
            `<b>Available Projects:</b>\n` +
            availableList + '\n\n' +
            `<i>Reply <code>/team &lt;project name or number&gt;</code> or <code>/team all</code></i>`
          );
          return res.status(200).json({ ok: true });
        }
      } else {
        const activeProjName = profile ? profile.project_name : 'Banking SuperApp';
        const activeProjId = profile ? profile.project_id : 'prj-banking';
        selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
          id: activeProjId,
          name: activeProjName,
          qa_progress: 74,
          regression_progress: 62,
        };
      }

      const projReports = allReports.filter(
        (r) => r.project_id === selectedProject.id || (r.project_name && r.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );
      const dedupedReports = deduplicateMemberReports(projReports);
      const projBlockers = allBlockers.filter(
        (b) => b.project_id === selectedProject.id || (b.project_name && b.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );

      let teamMsg = formatTeamProgressText(selectedProject, dedupedReports, projBlockers, { isAllView: false });

      teamMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      teamMsg += `💡 <b>Quick Navigation:</b>\n`;
      teamMsg += `• View active QA risks: <code>/risks</code>\n`;
      teamMsg += `• Detailed standup rollup: <code>/report</code>\n`;
      teamMsg += `• View all projects: <code>/team all</code>\n`;
      teamMsg += `• Switch active project: <code>/project</code>\n`;

      await sendTelegramMessage(chatId, teamMsg);
      return res.status(200).json({ ok: true });
    }

    // 9. /risks Command for QA Lead (view QA risks, blockers & defect exposures)
    if (text === '/risks' || text.startsWith('/risks ') || text === '/risk' || text.startsWith('/risk ') || text === '/qarisk' || text.startsWith('/qarisk ')) {
      const isLead = isQALead(profile);

      if (!isLead) {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Access Restricted: QA Lead Only</b>\n\n` +
          `The <code>/risks</code> command provides release risk exposure, blockers, and defect metrics and is reserved for <b>QA Leads</b>.\n\n` +
          `👤 <b>Your Current Profile:</b>\n` +
          `• Name: ${escapeHtml(profile ? profile.full_name : (fromUser.first_name || 'QA Member'))}\n` +
          `• Role: <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n` +
          `• Project: ${escapeHtml(profile ? profile.project_name : 'None')}\n\n` +
          `💡 <i>If you are the QA Lead, reply with:</i>\n` +
          `<code>/role QA Lead</code> to update your role.`
        );
        return res.status(200).json({ ok: true });
      }

      const rawArg = rawText.replace(/^\/(risks|risk|qarisk)\s*/i, '').trim();
      const arg = rawArg.toLowerCase();
      const todayStr = new Date().toISOString().split('T')[0];

      let projects = [];
      let allReports = [];
      let allBlockers = [];
      let allBugs = [];

      if (supabase) {
        const [projRes, repRes, blkRes, bugRes] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }),
          supabase.from('blockers').select('*').neq('status', 'Resolved').order('created_at', { ascending: false }),
          supabase.from('qa_bugs').select('*').neq('status', 'Closed').order('created_at', { ascending: false }),
        ]);
        projects = deduplicateProjects(projRes.data || []);
        allReports = repRes.data || [];
        allBlockers = blkRes.data || [];
        allBugs = bugRes.data || [];
      }

      if (projects.length === 0) {
        projects = [
          { id: 'prj-banking', name: 'Banking SuperApp', qa_progress: 74, regression_progress: 62 },
          { id: 'prj-mobile', name: 'Mobile Banking iOS & Android', qa_progress: 81, regression_progress: 78 },
          { id: 'prj-merchant', name: 'Merchant Payment Gateway', qa_progress: 35, regression_progress: 15 },
          { id: 'prj-nextgen', name: 'NextGen Mobile Banking', qa_progress: 20, regression_progress: 10 },
        ];
      }

      if (allBugs.length === 0) {
        allBugs = [
          {
            id: 'BUG-142',
            title: 'Payment Gateway 500 error on zero-decimal currencies',
            severity: 'Critical',
            status: 'Retest',
            project_id: 'prj-banking',
            module: 'Payment Module',
          },
          {
            id: 'BUG-140',
            title: 'KYC Document upload silently fails on high-res PNGs',
            severity: 'Critical',
            status: 'In Progress',
            project_id: 'prj-banking',
            module: 'KYC / Onboarding',
          },
          {
            id: 'BUG-138',
            title: 'Biometric FaceID unlock bypass on background resume',
            severity: 'High',
            status: 'In Progress',
            project_id: 'prj-mobile',
            module: 'Biometrics Core',
          },
        ];
      }

      // CASE 1: /risks all
      if (arg === 'all') {
        let fullMsg = `⚠️ <b>QA LEAD - ALL PROJECTS RISK OVERVIEW</b>\n`;
        fullMsg += `📅 <b>Date:</b> <code>${todayStr}</code>\n\n`;

        for (const proj of projects) {
          const projReports = allReports.filter(
            (r) => r.project_id === proj.id || (r.project_name && r.project_name.toLowerCase() === proj.name.toLowerCase())
          );
          const deduped = deduplicateMemberReports(projReports);
          const projBlockers = allBlockers.filter(
            (b) => b.project_id === proj.id || (b.project_name && b.project_name.toLowerCase() === proj.name.toLowerCase())
          );
          const projBugs = allBugs.filter((b) => b.project_id === proj.id);

          fullMsg += `==============================\n`;
          fullMsg += formatQARisksText(proj, projBlockers, deduped, projBugs, { isAllView: true }) + '\n';
        }

        fullMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
        fullMsg += `💡 <i>Detailed project risks: <code>/risks &lt;name or number&gt;</code> • Team status: <code>/team</code></i>`;

        await sendTelegramMessage(chatId, fullMsg);
        return res.status(200).json({ ok: true });
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
              (r) => (r.project_name && r.project_name.toLowerCase().includes(arg)) || (r.project_id && r.project_id.toLowerCase().includes(arg))
            );
            if (reportMatch) {
              selectedProject = {
                id: reportMatch.project_id,
                name: reportMatch.project_name,
                qa_progress: 70,
              };
            }
          }
        }

        if (!selectedProject) {
          let availableList = projects.map((p, idx) => `${NUMBER_EMOJIS[idx] || `[${idx + 1}]`} ${p.name}`).join('\n');
          await sendTelegramMessage(
            chatId,
            `⚠️ <b>Project "${escapeHtml(rawArg)}" not found.</b>\n\n` +
            `<b>Available Projects:</b>\n` +
            availableList + '\n\n' +
            `<i>Reply <code>/risks &lt;project name or number&gt;</code> or <code>/risks all</code></i>`
          );
          return res.status(200).json({ ok: true });
        }
      } else {
        const activeProjName = profile ? profile.project_name : 'Banking SuperApp';
        const activeProjId = profile ? profile.project_id : 'prj-banking';
        selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
          id: activeProjId,
          name: activeProjName,
          qa_progress: 74,
        };
      }

      const projReports = allReports.filter(
        (r) => r.project_id === selectedProject.id || (r.project_name && r.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );
      const dedupedReports = deduplicateMemberReports(projReports);
      const projBlockers = allBlockers.filter(
        (b) => b.project_id === selectedProject.id || (b.project_name && b.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );
      const projBugs = allBugs.filter((b) => b.project_id === selectedProject.id);

      let risksMsg = formatQARisksText(selectedProject, projBlockers, dedupedReports, projBugs, { isAllView: false });

      risksMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      risksMsg += `💡 <b>Quick Actions:</b>\n`;
      risksMsg += `• Resolve blockers: <code>/resolve</code>\n`;
      risksMsg += `• View team daily report: <code>/team</code>\n`;
      risksMsg += `• View all project risks: <code>/risks all</code>\n`;
      risksMsg += `• Switch active project: <code>/project</code>\n`;

      await sendTelegramMessage(chatId, risksMsg);
      return res.status(200).json({ ok: true });
    }

    // 9b. /status Command (role-based)
    if (text === '/status') {
      const isLead = isQALead(profile);

      let projects = [];
      let allReports = [];
      let allBlockers = [];
      let allBugs = [];

      if (supabase) {
        const [projRes, repRes, blkRes, bugRes] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('daily_reports').select('*').order('submitted_at', { ascending: false }),
          supabase.from('blockers').select('*').neq('status', 'Resolved').order('created_at', { ascending: false }),
          supabase.from('qa_bugs').select('*').neq('status', 'Closed').order('created_at', { ascending: false }),
        ]);
        projects = deduplicateProjects(projRes.data || []);
        allReports = repRes.data || [];
        allBlockers = blkRes.data || [];
        allBugs = bugRes.data || [];
      }

      const activeProjName = profile ? profile.project_name : 'Banking SuperApp';
      const activeProjId = profile ? profile.project_id : 'prj-banking';
      const selectedProject = projects.find((p) => p.id === activeProjId || p.name.toLowerCase() === activeProjName.toLowerCase()) || {
        id: activeProjId,
        name: activeProjName,
        qa_progress: 74,
        regression_progress: 62,
      };

      const projReports = allReports.filter(
        (r) => r.project_id === selectedProject.id || (r.project_name && r.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );
      const dedupedReports = deduplicateMemberReports(projReports);
      const projBlockers = allBlockers.filter(
        (b) => b.project_id === selectedProject.id || (b.project_name && b.project_name.toLowerCase() === selectedProject.name.toLowerCase())
      );

      if (isLead) {
        const projBugs = allBugs.filter((b) => b.project_id === selectedProject.id);
        const leadStatusText = formatQALeadStatusText(selectedProject, dedupedReports, projBlockers, projBugs);
        await sendTelegramMessage(chatId, leadStatusText);
      } else {
        const myReport = dedupedReports.find((r) => String(r.chat_id || r.chatId) === String(chatId) || (profile && (r.member_name || r.memberName) === profile.full_name));
        const memberStatusText = formatQAMemberStatusText(selectedProject, myReport);
        await sendTelegramMessage(chatId, memberStatusText);
      }
      return res.status(200).json({ ok: true });
    }

    // 10. /checkin command intercept for QA Lead
    if (text === '/checkin') {
      const isLead = isQALead(profile);
      if (isLead) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ <b>QA Lead Role Active</b>\n\n` +
          `As a <b>QA Lead</b>, you monitor team progress rather than submitting individual daily check-ins.\n\n` +
          `• Use <code>/status</code> for overall QA readiness & defect metrics\n` +
          `• Use <code>/team</code> to view team daily updates & testing progress\n` +
          `• Use <code>/report</code> for detailed team standup rollup\n` +
          `• Use <code>/risks</code> to view active QA risks & blockers\n\n` +
          `<i>If you want to submit individual testing check-ins, switch your role using <code>/role QA Engineer</code>.</i>`
        );
        return res.status(200).json({ ok: true });
      }
      // Non-lead checkin message
      await sendTelegramMessage(
        chatId,
        `👋 To complete your standup check-in, please interact with the active bot terminal session or AegisQA Command Center web application.`
      );
      return res.status(200).json({ ok: true });
    }

    // 11. /role Command to view or switch role
    if (text === '/role') {
      await sendTelegramMessage(
        chatId,
        `👤 <b>QA Role Management</b>\n\n` +
        `• <b>Your Current Role:</b> <b>${escapeHtml(profile ? profile.role : 'QA Engineer / Tester')}</b>\n\n` +
        `To update your role, reply:\n` +
        `• <code>/role QA Lead</code>\n` +
        `• <code>/role QA Engineer / Tester</code>\n` +
        `• <code>/role Automation QA Engineer</code>\n` +
        `• <code>/role Manual / Performance QA</code>\n\n` +
        `<i>QA Leads have access to <code>/team</code>, <code>/report</code>, and <code>/risks</code>.</i>`
      );
      return res.status(200).json({ ok: true });
    }

    if (text.startsWith('/role ')) {
      let newRole = rawText.replace(/^\/role\s+/i, '').trim();
      const DEFAULT_ROLES = ['QA Engineer / Tester', 'QA Lead', 'Automation QA Engineer', 'Manual / Performance QA'];
      if (newRole === '1') newRole = DEFAULT_ROLES[0];
      else if (newRole === '2') newRole = DEFAULT_ROLES[1];
      else if (newRole === '3') newRole = DEFAULT_ROLES[2];
      else if (newRole === '4') newRole = DEFAULT_ROLES[3];

      if (supabase) {
        await supabase.from('telegram_profiles').upsert({
          chat_id: String(chatId),
          full_name: profile ? profile.full_name : (fromUser.first_name || 'QA Tester'),
          role: newRole,
          project_id: profile ? profile.project_id : 'prj-banking',
          project_name: profile ? profile.project_name : 'Banking SuperApp',
          telegram_username: fromUser.username || '',
          updated_at: new Date().toISOString(),
        });
      }

      const isNowLead = isQALead({ role: newRole });

      await sendTelegramMessage(
        chatId,
        `✅ <b>Role Updated!</b>\n\n` +
        `Your role is now set to: <b>${escapeHtml(newRole)}</b>.\n\n` +
        (isNowLead
          ? `🎉 <b>QA Lead Privileges Activated!</b>\nYou now have access to:\n• <code>/team</code> — Team daily report & progress\n• <code>/report</code> — Detailed standup rollup\n• <code>/risks</code> — View active QA risks & blockers`
          : `You can submit your daily updates via standup.`)
      );
      return res.status(200).json({ ok: true });
    }

    // Default response
    const isLeadUser = isQALead(profile);
    const fallbackResponse = isLeadUser
      ? `Command received.\n• Type /team to view team progress & standups\n• Type /report for detailed standup rollup\n• Type /risks to view QA risks & blockers\n• Type /project to view projects\n• Type /role to update your role\n• Type /help for assistance.`
      : `Command received.\n• Type /checkin to submit daily standup\n• Type /project to view projects\n• Type /role to update your role\n• Type /blocker &lt;text&gt; to report an issue\n• Type /help for assistance.`;

    await sendTelegramMessage(chatId, fallbackResponse);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
