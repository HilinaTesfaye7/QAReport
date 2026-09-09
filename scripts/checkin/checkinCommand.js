import { saveCheckin } from './checkinService.js';
import { calculateExecutionStats, validateTestExecution } from './checkinValidation.js';

export async function handleNewCheckinStep(chatId, session, text, sendMessage) {
  const rawText = text.trim();
  const lower = rawText.toLowerCase();

  if (lower === '/cancel') {
    return { done: true, cancel: true };
  }

  // STEP 1: WORK TYPE
  if (session.step === 'work_type') {
    if (lower === 'done' || lower === 'next') {
      if (!session.workTypes || session.workTypes.length === 0) {
        await sendMessage(chatId, `⚠️ Please select at least one work type.`);
        return { done: false };
      }
      session.step = 'test_execution_executed';
      await sendMessage(chatId, `<b>How many test cases did you execute today?</b> (Enter a number)`);
      return { done: false };
    }

    session.workTypes = session.workTypes || [];
    if (!session.workTypes.includes(rawText)) {
      session.workTypes.push(rawText);
    }
    
    await sendMessage(chatId, `Added: ${rawText}. Select more or type "Next" to continue.`);
    return { done: false };
  }

  // STEP 2: TEST EXECUTION
  if (session.step === 'test_execution_executed') {
    const executed = parseInt(rawText, 10);
    if (isNaN(executed) || executed < 0) {
      await sendMessage(chatId, `⚠️ Please enter a valid number.`);
      return { done: false };
    }
    session.executed = executed;
    session.step = 'test_execution_passed';
    await sendMessage(chatId, `<b>How many passed?</b>`);
    return { done: false };
  }
  if (session.step === 'test_execution_passed') {
    session.passed = parseInt(rawText, 10) || 0;
    session.step = 'test_execution_failed';
    await sendMessage(chatId, `<b>How many failed?</b>`);
    return { done: false };
  }
  if (session.step === 'test_execution_failed') {
    session.failed = parseInt(rawText, 10) || 0;
    session.step = 'test_execution_blocked';
    await sendMessage(chatId, `<b>How many are blocked?</b>`);
    return { done: false };
  }
  if (session.step === 'test_execution_blocked') {
    session.blocked = parseInt(rawText, 10) || 0;
    
    if (!validateTestExecution(session.executed, session.passed, session.failed, session.blocked)) {
      await sendMessage(chatId, `⚠️ Validation Failed: passed + failed + blocked exceeds total executed. Let's try again. How many did you execute?`);
      session.step = 'test_execution_executed';
      return { done: false };
    }

    session.step = 'new_bugs';
    await sendMessage(chatId, `<b>Did you find any new bugs today?</b> (Yes/No)`);
    return { done: false };
  }

  // STEP 3: NEW BUGS
  if (session.step === 'new_bugs') {
    if (lower === 'yes') {
      session.step = 'new_bugs_critical';
      session.newBugs = { critical: 0, high: 0, medium: 0, low: 0 };
      await sendMessage(chatId, `<b>How many Critical bugs?</b>`);
    } else {
      session.step = 'blocker_ask';
      await sendMessage(chatId, `<b>Are you currently blocked?</b> (Yes/No)`);
    }
    return { done: false };
  }
  if (session.step === 'new_bugs_critical') {
    session.newBugs.critical = parseInt(rawText, 10) || 0;
    session.step = 'new_bugs_high';
    await sendMessage(chatId, `<b>How many High bugs?</b>`);
    return { done: false };
  }
  if (session.step === 'new_bugs_high') {
    session.newBugs.high = parseInt(rawText, 10) || 0;
    session.step = 'new_bugs_medium';
    await sendMessage(chatId, `<b>How many Medium bugs?</b>`);
    return { done: false };
  }
  if (session.step === 'new_bugs_medium') {
    session.newBugs.medium = parseInt(rawText, 10) || 0;
    session.step = 'new_bugs_low';
    await sendMessage(chatId, `<b>How many Low bugs?</b>`);
    return { done: false };
  }
  if (session.step === 'new_bugs_low') {
    session.newBugs.low = parseInt(rawText, 10) || 0;
    session.step = 'blocker_ask';
    await sendMessage(chatId, `<b>Are you currently blocked?</b> (Yes/No)`);
    return { done: false };
  }

  // STEP 4: BLOCKER
  if (session.step === 'blocker_ask') {
    if (lower === 'yes') {
      session.step = 'blocker_reason';
      await sendMessage(chatId, `<b>What is blocking you?</b>`);
    } else {
      session.blocker = null;
      session.step = 'remaining_work';
      await sendMessage(chatId, `<b>What remains?</b> (Type activities and reply "Next" when done)`);
    }
    return { done: false };
  }
  if (session.step === 'blocker_reason') {
    session.blocker = rawText;
    session.step = 'remaining_work';
    await sendMessage(chatId, `<b>What remains?</b> (Type activities and reply "Next" when done)`);
    return { done: false };
  }

  // STEP 5: REMAINING WORK
  if (session.step === 'remaining_work') {
    if (lower === 'done' || lower === 'next') {
      session.step = 'eta';
      await sendMessage(chatId, `<b>When do you expect to complete your current QA work?</b> (e.g. Today, Tomorrow)`);
      return { done: false };
    }
    session.remainingWork = session.remainingWork || [];
    session.remainingWork.push(rawText);
    await sendMessage(chatId, `Added. Type "Next" to continue.`);
    return { done: false };
  }

  // STEP 6: ETA
  if (session.step === 'eta') {
    session.eta = rawText;
    session.step = 'comment';
    await sendMessage(chatId, `<b>Anything else the QA Lead should know?</b> (Or type "Skip")`);
    return { done: false };
  }

  // STEP 7: COMMENT
  if (session.step === 'comment') {
    session.comment = lower === 'skip' ? '' : rawText;

    // SAVE CHECKIN
    const stats = calculateExecutionStats(session.executed, session.passed, session.failed, session.blocked);
    
    saveCheckin({
      testerId: `usr-${chatId}`,
      projectId: session.profile?.projectId || 'unknown',
      workTypes: session.workTypes,
      executed: session.executed,
      passed: session.passed,
      failed: session.failed,
      blocked: session.blocked,
      newBugs: session.newBugs || { critical: 0, high: 0, medium: 0, low: 0 },
      blocker: session.blocker,
      remainingWork: session.remainingWork || [],
      eta: session.eta,
      comment: session.comment
    });

    let summary = `✅ <b>Daily QA Check-in Recorded</b>\n\n`;
    summary += `Project: ${session.profile?.projectName || 'N/A'}\n`;
    summary += `Tester: ${session.profile?.fullName || 'N/A'}\n\n`;
    summary += `📊 <b>Testing</b>\n`;
    summary += `• Executed: ${session.executed}\n`;
    summary += `• Passed: ${session.passed}\n`;
    summary += `• Failed: ${session.failed}\n`;
    summary += `• Blocked: ${session.blocked}\n`;
    summary += `• Pass Rate: ${stats.passRate}%\n\n`;
    
    if (session.newBugs) {
      summary += `🐛 <b>Bugs</b>\n`;
      summary += `• Critical: ${session.newBugs.critical}\n`;
      summary += `• High: ${session.newBugs.high}\n`;
      summary += `• Medium: ${session.newBugs.medium}\n`;
      summary += `• Low: ${session.newBugs.low}\n\n`;
    }
    
    summary += `🚧 <b>Blockers</b>\n`;
    summary += `• ${session.blocker ? session.blocker : 'None'}\n\n`;

    summary += `📌 <b>Remaining</b>\n`;
    (session.remainingWork || []).forEach(w => summary += `• ${w}\n`);
    summary += `\n⏱ <b>ETA</b>\n• ${session.eta}\n`;

    await sendMessage(chatId, summary);
    return { done: true };
  }

  return { done: false };
}
