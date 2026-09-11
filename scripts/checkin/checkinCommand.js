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
    
    // Auto-associate with QA Lead, Core Project, Project
    const qaLead = session.qaLeadName || 'Sarah Jenkins';
    const coreProjectName = session.coreProjectName || 'Unknown';

    saveCheckin({
      testerId: `usr-${chatId}`,
      projectId: session.profile?.projectId || 'unknown',
      moduleId: session.moduleId || null,
      moduleName: session.moduleName || null,
      coreProjectId: session.coreProjectId || 'unknown',
      qaLeadId: session.qaLeadId || 'unknown',
      workedToday: session.workedToday,
      blocker: session.blocker,
      nextPlan: session.nextPlan,
      achievement: session.achievement,
      executed: session.executed,
      passed: session.passed,
      failed: session.failed,
      blocked: session.blocked,
      passRate: stats.passRate
    });

    let summary = `✅ Daily QA Check-in Recorded\n\n`;
    summary += `📁 Project: ${session.profile?.projectName || 'N/A'}\n`;
    if (session.moduleName) {
      summary += `📦 Module: ${session.moduleName}\n`;
    }
    summary += `👩‍💼 QA Lead: ${qaLead}\n`;
    summary += `👤 Tester: ${session.profile?.fullName || 'N/A'}\n\n`;
    
    summary += `📝 Worked Today\n• ${session.workedToday}\n\n`;
    summary += `🚧 Blocker\n• ${session.blocker ? session.blocker : 'No blocker'}\n\n`;
    summary += `📌 Next Plan\n• ${session.nextPlan}\n\n`;
    summary += `🏆 Achievement\n• ${session.achievement}\n\n`;

    summary += `📊 Testing Summary\n`;
    summary += `• Executed: ${session.executed}\n`;
    summary += `• Passed: ${session.passed}\n`;
    summary += `• Failed: ${session.failed}\n`;
    summary += `• Blocked: ${session.blocked}\n`;
    summary += `• Pass Rate: ${stats.passRate}%\n\n`;

    if (session.executed > 0 && stats.passRate === 100 && stats.failRate === 0 && stats.blockRate === 0) {
      if (notifyCallbacks.notifyAchievement) {
        const moduleText = session.moduleName ? ` on module ${session.moduleName}` : ``;
        const autoAchievement = `Achieved 100% Pass Rate (${session.executed}/${session.executed} passed)${moduleText}!`;
        await notifyCallbacks.notifyAchievement({
          senderChatId: chatId,
          memberName: session.profile?.fullName || 'Tester',
          username: session.profile?.username || '',
          projectName: session.profile?.projectName || 'unknown',
          projectId: session.profile?.projectId || 'unknown',
          achievementText: autoAchievement
        });
        summary += `🌟 <b>Auto-Achievement Triggered:</b> 100% Pass Rate! Great job!\n`;
      }
    }

    await sendMessage(chatId, summary);
    return { done: true };
  }

  return { done: false };
}
