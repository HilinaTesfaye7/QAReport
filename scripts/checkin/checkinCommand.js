import { saveCheckin } from './checkinService.js';
import { calculateExecutionStats, parseMetricsString, validateTestExecution } from './checkinValidation.js';

export async function handleNewCheckinStep(chatId, session, text, sendMessage, notifyCallbacks = {}) {
  const rawText = text.trim();
  const lower = rawText.toLowerCase();

  if (lower === '/cancel') {
    return { done: true, cancel: true };
  }

  // STEP 1: WORKED TODAY
  if (session.step === 'work_type' || session.step === 'worked_today') {
    session.workedToday = rawText;
    session.step = 'blocker';
    await sendMessage(
      chatId, 
      `🚧 <b>Any Blocker?</b>\n\n<i>(Reply with any blockers or challenges, or type <b>No</b> if all clear)</i>`,
      { reply_markup: { remove_keyboard: true } }
    );
    return { done: false };
  }

  // STEP 2: BLOCKER
  if (session.step === 'blocker') {
    const isNone = lower === 'none' || lower === 'no' || lower === '0' || lower === 'clear';
    session.blocker = isNone ? null : rawText;
    
    if (session.blocker && notifyCallbacks.notifyIssue) {
      await notifyCallbacks.notifyIssue(
        session.profile?.projectName || 'unknown',
        session.profile?.fullName || 'Tester',
        chatId,
        'Blocker',
        session.blocker
      );
    }

    session.step = 'next_plan';
    await sendMessage(
      chatId, 
      `📌 <b>Next Plan?</b>\n\n<i>(What is your primary testing task or plan next?)</i>`
    );
    return { done: false };
  }

  // STEP 3: NEXT PLAN
  if (session.step === 'next_plan') {
    session.nextPlan = rawText;
    session.step = 'achievement';
    await sendMessage(
      chatId, 
      `🏆 <b>Major achievement today?</b>\n\n<i>(Key accomplishment, milestone, critical bug found/verified, or type <b>None</b>)</i>`
    );
    return { done: false };
  }

  // STEP 4: ACHIEVEMENT
  if (session.step === 'achievement') {
    const isNone = lower === 'none' || lower === 'no' || lower === '0' || lower === 'nothing';
    session.achievement = isNone ? 'None' : rawText;

    if (session.achievement !== 'None' && notifyCallbacks.notifyAchievement) {
      await notifyCallbacks.notifyAchievement(
        session.profile?.projectName || 'unknown',
        session.profile?.fullName || 'Tester',
        chatId,
        session.achievement
      );
    }

    session.step = 'metrics';
    await sendMessage(
      chatId, 
      `📊 <b>Testing Summary</b>\n\nEnter your testing numbers in this exact format:\n<b>Executed / Passed / Failed / Blocked</b>\n\n<i>Example: 20/15/3/2</i>`
    );
    return { done: false };
  }

  // STEP 5: METRICS
  if (session.step === 'metrics') {
    const metrics = parseMetricsString(rawText);
    
    if (!metrics) {
      await sendMessage(chatId, `⚠️ <b>Invalid format.</b>\nPlease enter 4 numbers separated by slashes (e.g. <b>20/15/3/2</b>)\nExecuted / Passed / Failed / Blocked`);
      return { done: false };
    }

    if (!validateTestExecution(metrics.executed, metrics.passed, metrics.failed, metrics.blocked)) {
      await sendMessage(chatId, `⚠️ <b>Validation Failed:</b> Passed (${metrics.passed}) + Failed (${metrics.failed}) + Blocked (${metrics.blocked}) exceeds total Executed (${metrics.executed}).\n\nPlease try again (e.g. 20/15/3/2):`);
      return { done: false };
    }

    session.executed = metrics.executed;
    session.passed = metrics.passed;
    session.failed = metrics.failed;
    session.blocked = metrics.blocked;

    const stats = calculateExecutionStats(session.executed, session.passed, session.failed, session.blocked);
    
    saveCheckin({
      testerId: `usr-${chatId}`,
      projectId: session.profile?.projectId || 'unknown',
      workedToday: session.workedToday,
      blocker: session.blocker,
      nextPlan: session.nextPlan,
      achievement: session.achievement,
      executed: session.executed,
      passed: session.passed,
      failed: session.failed,
      blocked: session.blocked,
    });

    let summary = `✅ <b>Daily QA Check-in Recorded</b>\n\n`;
    summary += `📁 Project: ${session.profile?.projectName || 'N/A'}\n`;
    summary += `👤 Tester: ${session.profile?.fullName || 'N/A'}\n\n`;
    
    summary += `📝 <b>Worked Today</b>\n• ${session.workedToday}\n\n`;
    summary += `🚧 <b>Blocker</b>\n• ${session.blocker ? session.blocker : 'None'}\n\n`;
    summary += `📌 <b>Next Plan</b>\n• ${session.nextPlan}\n\n`;
    summary += `🏆 <b>Achievement</b>\n• ${session.achievement}\n\n`;

    summary += `📊 <b>Testing Summary</b>\n`;
    summary += `• Executed: ${session.executed}\n`;
    summary += `• Passed: ${session.passed}\n`;
    summary += `• Failed: ${session.failed}\n`;
    summary += `• Blocked: ${session.blocked}\n`;
    summary += `• Pass Rate: ${stats.passRate}%\n\n`;

    await sendMessage(chatId, summary);
    return { done: true };
  }

  return { done: false };
}
