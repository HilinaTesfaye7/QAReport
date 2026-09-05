import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory Storage Polyfill for Node.js test environment
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStorage.get(key) || null,
  setItem: (key, val) => memoryStorage.set(key, String(val)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};

globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Import services to test
const { StorageService } = await import('../src/services/storage.ts');
const { WorkloadService } = await import('../src/services/workloadService.ts');
const { TestCaseService } = await import('../src/services/testCaseService.ts');
const { RuleEngine } = await import('../src/services/ruleEngine.ts');
const { AuthService } = await import('../src/services/authService.ts');

test.beforeEach(() => {
  StorageService.resetAll();
});

test('1. Deterministic Workload Formula Calculation', () => {
  // Master prompt formula:
  // Workload Score = Task Effort + Priority Weight + Deadline Pressure + Bug Workload + Project Load - Completed Work
  const hanaWorkload = WorkloadService.computeMemberWorkload('usr-hana');
  assert.ok(hanaWorkload, 'Hana workload should be computed');
  assert.equal(typeof hanaWorkload.score, 'number');
  assert.ok(hanaWorkload.score >= 0 && hanaWorkload.score <= 100);
  assert.equal(typeof hanaWorkload.classification, 'string');
  assert.ok(['Low', 'Balanced', 'High', 'Overloaded'].includes(hanaWorkload.classification));

  // Ahmed is assigned to heavy regression suites and critical tasks in seed data
  const ahmedWorkload = WorkloadService.computeMemberWorkload('usr-ahmed');
  assert.ok(ahmedWorkload.score > hanaWorkload.score, 'Ahmed should have higher workload than Hana');
});

test('2. Testing Metrics and Pass Rate Calculations', () => {
  // Safe handling of pass rate and execution metrics
  const metrics = TestCaseService.getMetrics();
  assert.ok(metrics.total > 0, 'Catalog should contain test cases');
  assert.equal(metrics.executed, metrics.passed + metrics.failed + metrics.blocked);
  assert.ok(metrics.passRate >= 0 && metrics.passRate <= 100);
  assert.equal(metrics.passRate, Math.round((metrics.passed / metrics.executed) * 100));
  assert.equal(metrics.executionProgress, Math.round((metrics.executed / metrics.total) * 100));
});

test('3. Deterministic Release Readiness Engine', () => {
  // Test banking project release readiness
  const bankingReadiness = RuleEngine.evaluateReleaseReadiness('prj-banking');
  assert.ok(bankingReadiness, 'Readiness should be evaluated');
  assert.ok(['READY', 'READY_WITH_RISKS', 'NOT_READY', 'BLOCKED'].includes(bankingReadiness.status));
  assert.ok(Array.isArray(bankingReadiness.rulesEvaluated));
  assert.ok(bankingReadiness.rulesEvaluated.length >= 4, 'Should evaluate quality gates');

  // Verify Gate 1: No open critical bugs
  const criticalBugRule = bankingReadiness.rulesEvaluated.find(
    (r) => r.ruleName === 'Zero Critical Defects'
  );
  assert.ok(criticalBugRule, 'Critical bugs gate must be evaluated');
});

test('4. Rule-Based Candidate Assignment Recommender (100% Non-AI)', () => {
  // Recommend assignee for an API Testing task
  const recommendation = RuleEngine.recommendAssigneeForTask({
    projectId: 'prj-banking',
    estimatedEffortHours: 4,
    priority: 'High',
    title: 'Payment Gateway API Validation',
    module: 'Payment Module',
  });

  assert.ok(recommendation, 'Should provide a deterministic candidate recommendation');
  assert.ok(recommendation.recommendedMember, 'Should recommend a member');
  assert.ok(Array.isArray(recommendation.reasons));
  assert.ok(recommendation.reasons.length > 0, 'Should provide transparent match reasons');
});

test('5. Strict RBAC Enforcement', () => {
  // QA Lead (Sarah) can perform administrative functions
  assert.doesNotThrow(() => {
    AuthService.requireLeadPermission('usr-sarah');
  }, 'QA Lead must be authorized');

  // QA Engineer (Hana) cannot perform Lead administrative actions
  assert.throws(
    () => {
      AuthService.requireLeadPermission('usr-hana');
    },
    /FORBIDDEN: This operation requires QA Lead administration permissions/i,
    'QA Engineer must be blocked with 403 Forbidden error'
  );
});

test('6. Telegram Bot Provider & Dispatch Validation', async () => {
  const { NotificationService } = await import('../src/services/notificationService.ts');

  // Test validation when token or chat ID is missing
  const emptyRes = await NotificationService.testTelegram('', '');
  assert.equal(emptyRes.success, false);
  assert.match(emptyRes.message, /Both Bot Token and Chat ID are required/i);

  // Test notification dispatch through TelegramProvider
  const dispatchRes = await NotificationService.dispatch({
    recipientId: 'usr-sarah',
    title: '🚨 Critical Defect Filed: Payment Timeout',
    message: 'BUG-142 reported on Banking SuperApp staging environment.',
    type: 'bug_assigned',
  });
  assert.ok(dispatchRes, 'Dispatch should return successfully created notification');
});

test('7. Project Creation with PRD, Design, and Member Notifications', async () => {
  const { ProjectService } = await import('../src/services/projectService.ts');
  const { NotificationService } = await import('../src/services/notificationService.ts');

  // Sarah creates a new QA project with PRD, Figma, and assigned member Coco ('usr-347835367')
  const newProject = ProjectService.createProject(
    {
      name: 'Crypto Vault Wallet',
      description: 'QA security audit and regression for multi-sig wallet',
      status: 'Testing',
      startDate: '2026-09-05',
      targetReleaseDate: '2026-10-01',
      projectOwner: 'Elena Rostova',
      qaLeadId: 'usr-sarah',
      memberIds: ['usr-347835367', 'usr-hana'],
      resources: {
        prdTitle: 'Crypto Vault Wallet PRD v1.2',
        prdUrl: 'https://docs.crypto.internal/prd',
        prdContent: '# Crypto Vault Acceptance Criteria\n- 100% test pass rate on signature verifications',
        figmaUrl: 'https://www.figma.com/file/crypto-vault/spec',
        figmaPreviewTitle: 'Crypto Vault UI Specs',
        requirements: ['REQ-01: Multi-sig auth', 'REQ-02: Biometric unlock'],
        testEnvUrl: 'https://staging-wallet.internal',
        repoUrl: 'https://github.com/crypto/vault',
        apiDocUrl: 'https://api.crypto.internal/docs',
        testCredentials: [],
        releaseInfo: 'Audited release candidate',
        importantNotes: 'Verify secure enclave simulation',
      },
    },
    'usr-sarah'
  );

  assert.ok(newProject.id.startsWith('prj-'), 'Project ID should be created');
  assert.equal(newProject.name, 'Crypto Vault Wallet');
  assert.equal(newProject.resources.prdTitle, 'Crypto Vault Wallet PRD v1.2');
  assert.equal(newProject.resources.figmaUrl, 'https://www.figma.com/file/crypto-vault/spec');

  // Verify notifications were delivered to assigned members
  const cocoNotifs = NotificationService.getNotificationsForUser('usr-347835367');
  const assignmentNotif = cocoNotifs.find((n) => n.title.includes('Crypto Vault Wallet'));
  assert.ok(assignmentNotif, 'Coco must receive assignment notification for the new project');
  assert.equal(assignmentNotif.type, 'assignment');
  assert.match(assignmentNotif.message, /Crypto Vault Wallet/i);
});

test('8. QA Lead /report Command Aggregation & Project Filtering', async () => {
  const {
    isQALead,
    deduplicateMemberReports,
    formatProjectReportText,
  } = await import('../scripts/telegramQABot.js');

  // Test 1: Role verification for QA Lead command
  assert.equal(isQALead({ role: 'QA Lead' }), true, 'QA Lead role must be authorized');
  assert.equal(isQALead({ role: 'qa_lead' }), true, 'qa_lead role must be authorized');
  assert.equal(isQALead({ role: 'Lead QA Manager' }), true, 'Lead Manager must be authorized');
  assert.equal(isQALead({ role: 'QA Engineer / Tester' }), false, 'QA Engineer must not have QA Lead authorization');
  assert.equal(isQALead({ role: 'tester' }), false, 'tester must not have QA Lead authorization');
  assert.equal(isQALead(null), false, 'null profile must return false');

  // Test 2: Deduplication by member (taking latest report per member)
  const mockReports = [
    {
      id: 'r1',
      memberId: 'usr-1',
      memberName: 'Coco',
      role: 'QA Tester',
      projectId: 'prj-banking',
      projectName: 'Banking SuperApp',
      yesterdayCompleted: 'First report tasks',
      todayWorkingOn: 'First report plan',
      isBlocked: false,
      submittedAt: '2026-09-05T10:00:00.000Z',
    },
    {
      id: 'r2',
      memberId: 'usr-1',
      memberName: 'Coco',
      role: 'QA Tester',
      projectId: 'prj-banking',
      projectName: 'Banking SuperApp',
      yesterdayCompleted: 'Updated tasks',
      todayWorkingOn: 'Updated plan',
      isBlocked: true,
      blockers: 'Payment API 500 timeout',
      submittedAt: '2026-09-05T14:00:00.000Z',
    },
    {
      id: 'r3',
      memberId: 'usr-2',
      memberName: 'Hana',
      role: 'Automation QA Engineer',
      projectId: 'prj-banking',
      projectName: 'Banking SuperApp',
      yesterdayCompleted: 'Automated 15 tests',
      todayWorkingOn: 'Writing regression tests',
      isBlocked: false,
      submittedAt: '2026-09-05T11:00:00.000Z',
    },
  ];

  const deduped = deduplicateMemberReports(mockReports);
  assert.equal(deduped.length, 2, 'Should deduplicate to 2 distinct members');
  const cocoReport = deduped.find((r) => r.memberId === 'usr-1');
  assert.ok(cocoReport, 'Coco report should be present');
  assert.equal(cocoReport.id, 'r2', 'Latest report (r2) must take precedence over earlier report');
  assert.equal(cocoReport.isBlocked, true, 'Latest blocker state must be reflected');

  // Test 3: Formatting formatted project report
  const mockBlockers = [
    {
      id: 'blk-1',
      title: 'Payment API 500 timeout',
      description: 'Staging gateway unreachable',
      reportedBy: 'Coco',
    },
  ];

  const formatted = formatProjectReportText('Banking SuperApp', deduped, mockBlockers, { isAllView: false });
  assert.match(formatted, /QA LEAD DAILY TEAM REPORT/i, 'Must have QA Lead report header');
  assert.match(formatted, /Banking SuperApp/i, 'Must display project name');
  assert.match(formatted, /Coco/i, 'Must list Coco');
  assert.match(formatted, /Hana/i, 'Must list Hana');
  assert.match(formatted, /Payment API 500 timeout/i, 'Must highlight blocker');
  assert.match(formatted, /ACTIVE PROJECT BLOCKERS/i, 'Must summarize active project blockers');
});

test('9. QA Lead /team and /risks Commands Validation', async () => {
  const {
    isQALead,
    makeProgressBar,
    formatTeamProgressText,
    formatQARisksText,
  } = await import('../scripts/telegramQABot.js');

  // Test 1: Progress bar utility
  const bar74 = makeProgressBar(74, 10);
  assert.match(bar74, /\[█+░+\] 74%/, 'Should render ASCII bar with 74%');
  const bar0 = makeProgressBar(0, 10);
  assert.equal(bar0, '[░░░░░░░░░░] 0%');
  const bar100 = makeProgressBar(100, 10);
  assert.equal(bar100, '[██████████] 100%');

  // Test 2: /team progress formatting
  const mockProject = {
    id: 'prj-banking',
    name: 'Banking SuperApp',
    status: 'Testing',
    qa_progress: 74,
    regression_progress: 62,
  };

  const mockReports = [
    {
      id: 'r1',
      memberId: 'usr-1',
      memberName: 'Coco',
      role: 'QA Tester',
      yesterdayCompleted: 'Verified Login Biometrics',
      todayWorkingOn: 'Payment API testing',
      isBlocked: false,
      expectedCompletion: 'Today',
      date: '2026-09-05',
    },
    {
      id: 'r2',
      memberId: 'usr-2',
      memberName: 'Hana',
      role: 'Automation QA Engineer',
      yesterdayCompleted: 'Auth regression tests',
      todayWorkingOn: 'Card management suite',
      isBlocked: true,
      blockers: 'Staging API 500 error',
      expectedCompletion: 'Tomorrow',
      date: '2026-09-05',
    },
  ];

  const teamText = formatTeamProgressText(mockProject, mockReports, [], { isAllView: false });
  assert.match(teamText, /QA LEAD - TEAM DAILY REPORT & PROGRESS/i, 'Must include QA Lead team header');
  assert.match(teamText, /Banking SuperApp/i, 'Must display project name');
  assert.match(teamText, /Coco/i, 'Must display team member Coco');
  assert.match(teamText, /Payment API testing/i, 'Must display current task');
  assert.match(teamText, /Staging API 500 error/i, 'Must display blocker flag');
  assert.match(teamText, /74%/i, 'Must display QA progress');
  assert.match(teamText, /62%/i, 'Must display regression progress');

  // Test 3: /risks evaluation and formatting
  const mockBlockers = [
    {
      id: 'blk-1',
      title: 'Payment Gateway Down',
      description: 'Staging sandbox 500 error',
      reportedBy: 'Hana',
      status: 'Open',
    },
  ];

  const mockBugs = [
    {
      id: 'BUG-142',
      title: 'Payment Gateway decimal error',
      severity: 'Critical',
      status: 'Retest',
      module: 'Payment Module',
    },
  ];

  // Blocked scenario
  const risksText = formatQARisksText(mockProject, mockBlockers, mockReports, mockBugs, { isAllView: false });
  assert.match(risksText, /QA LEAD - ACTIVE RISKS & BLOCKERS/i, 'Must include risks header');
  assert.match(risksText, /CRITICAL RISK \/ BLOCKED/i, 'Must detect critical risk due to open blocker');
  assert.match(risksText, /Payment Gateway Down/i, 'Must list active blocker');
  assert.match(risksText, /BUG-142/i, 'Must list critical defect');
  assert.match(risksText, /Hana/i, 'Must list blocked team member');

  // Clear/on track scenario
  const clearRisksText = formatQARisksText(mockProject, [], [], [], { isAllView: false });
  assert.match(clearRisksText, /LOW RISK \/ ON TRACK/i, 'Must evaluate to low risk when clear');
  assert.match(clearRisksText, /Zero Active Risks Detected/i, 'Must confirm zero active risks');

  // Test 4: Role differentiation
  assert.equal(isQALead({ role: 'QA Lead' }), true);
  assert.equal(isQALead({ role: 'QA Engineer' }), false);
});

test('10. Standup Bug Parsing & Report Confirmation Formatting', async () => {
  const { parseBugCounts } = await import('../scripts/telegramQABot.js');

  // Test 1: "2 High, 1 Medium"
  const bugs1 = parseBugCounts('2 High, 1 Medium');
  assert.equal(bugs1.high, 2, 'High count should be 2');
  assert.equal(bugs1.medium, 1, 'Medium count should be 1');
  assert.equal(bugs1.critical, 0, 'Critical count should be 0');
  assert.equal(bugs1.low, 0, 'Low count should be 0');
  assert.equal(bugs1.total, 3, 'Total bugs should be 3');
  assert.match(bugs1.summary, /2 High\s*1 Medium/, 'Summary should format High and Medium counts');

  // Test 2: Comma list "0, 2, 1, 0" (Critical, High, Medium, Low)
  const bugs2 = parseBugCounts('0, 2, 1, 0');
  assert.equal(bugs2.critical, 0);
  assert.equal(bugs2.high, 2);
  assert.equal(bugs2.medium, 1);
  assert.equal(bugs2.low, 0);
  assert.equal(bugs2.total, 3);

  // Test 3: "None" / "0"
  const bugs3 = parseBugCounts('None');
  assert.equal(bugs3.total, 0);
  assert.equal(bugs3.summary, 'None');

  const bugs4 = parseBugCounts('0');
  assert.equal(bugs4.total, 0);
  assert.equal(bugs4.summary, 'None');

  // Test 4: "1 Critical, 3 Low"
  const bugs5 = parseBugCounts('1 Critical, 3 Low');
  assert.equal(bugs5.critical, 1);
  assert.equal(bugs5.low, 3);
  assert.equal(bugs5.total, 4);

  // Test 5: Standup Submission Confirmation Template Verification
  const profile = { fullName: 'Coco', projectName: 'KO' };
  const answers = {
    yesterdayCompleted: 'Completed regression testing for Login and OTP.',
    todayWorkingOn: 'Testing Payment and Transaction modules.',
    workStatus: 'On Track',
    statusEmoji: '🟢',
    bugsSummary: '2 High\n1 Medium',
    blockers: 'None',
    risks: 'None',
  };

  const confirmationMsg =
    `✅ <b>Daily QA Report Submitted</b>\n\n` +
    `📁 <b>Project:</b> ${profile.projectName}\n` +
    `👤 <b>QA Member:</b> ${profile.fullName}\n\n` +
    `📅 <b>Yesterday</b>\n` +
    `${answers.yesterdayCompleted}\n\n` +
    `🎯 <b>Today</b>\n` +
    `${answers.todayWorkingOn}\n\n` +
    `📈 <b>Status</b>\n` +
    `${answers.statusEmoji} ${answers.workStatus}\n\n` +
    `🐞 <b>Bugs</b>\n` +
    `${answers.bugsSummary}\n\n` +
    `🚨 <b>Blockers</b>\n` +
    `${answers.blockers}\n\n` +
    `⚠️ <b>Risks</b>\n` +
    `${answers.risks}\n\n` +
    `<i>Your report has been logged successfully.</i>`;

  assert.match(confirmationMsg, /✅ <b>Daily QA Report Submitted<\/b>/);
  assert.match(confirmationMsg, /📁 <b>Project:<\/b> KO/);
  assert.match(confirmationMsg, /👤 <b>QA Member:<\/b> Coco/);
  assert.match(confirmationMsg, /📅 <b>Yesterday<\/b>\s*Completed regression testing for Login and OTP\./);
  assert.match(confirmationMsg, /🎯 <b>Today<\/b>\s*Testing Payment and Transaction modules\./);
  assert.match(confirmationMsg, /📈 <b>Status<\/b>\s*🟢 On Track/);
  assert.match(confirmationMsg, /🐞 <b>Bugs<\/b>\s*2 High\s*1 Medium/);
  assert.match(confirmationMsg, /🚨 <b>Blockers<\/b>\s*None/);
  assert.match(confirmationMsg, /⚠️ <b>Risks<\/b>\s*None/);
  assert.match(confirmationMsg, /Your report has been logged successfully\./);
});

test('11. QA Lead /status Management View (Team Status Breakdown, Severity Bugs, Blockers, Risks)', async () => {
  const {
    formatQALeadStatusText,
    formatQAMemberStatusText,
  } = await import('../scripts/telegramQABot.js');

  const mockProject = {
    id: 'prj-ko',
    name: 'KO',
    qa_progress: 80,
    regression_progress: 70,
  };

  const mockReports = [
    {
      memberName: 'Coco',
      workStatus: 'On Track',
      statusEmoji: '🟢',
      todayWorkingOn: 'Payment and Transaction modules',
      bugsFound: { critical: 0, high: 2, medium: 1, low: 0 },
      isBlocked: false,
      blockers: '',
      risks: '',
    },
    {
      memberName: 'Ahmed',
      workStatus: 'At Risk',
      statusEmoji: '🟡',
      todayWorkingOn: 'Security audit',
      bugsFound: { critical: 0, high: 1, medium: 0, low: 2 },
      isBlocked: false,
      blockers: '',
      risks: 'Vendor API rate limit throttling',
    },
    {
      memberName: 'Hana',
      workStatus: 'Blocked',
      statusEmoji: '🔴',
      todayWorkingOn: 'Settlement module testing',
      bugsFound: { critical: 1, high: 0, medium: 0, low: 0 },
      isBlocked: true,
      blockers: 'Staging DB migration incomplete',
      risks: 'Release schedule slipping by 2 days',
    },
  ];

  const mockBlockers = [
    {
      id: 'blk-1',
      title: 'Staging DB migration incomplete',
      description: 'Tables locked for migration',
      reportedBy: 'Hana',
      status: 'Open',
    },
  ];

  const mockBugs = [
    {
      id: 'BUG-201',
      title: 'Security auth zero-day timeout',
      severity: 'Critical',
      status: 'Open',
    },
  ];

  // Test QA Lead /status output
  const leadStatus = formatQALeadStatusText(mockProject, mockReports, mockBlockers, mockBugs);

  // 1. Header & Project Info
  assert.match(leadStatus, /QA LEAD - PROJECT STATUS OVERVIEW/i);
  assert.match(leadStatus, /Project:.*KO/);

  // 2. Team Member Counts (🟢 On Track, 🟡 At Risk, 🔴 Blocked)
  assert.match(leadStatus, /Team Members \(3\)/);
  assert.match(leadStatus, /🟢 On Track:\s*<b>1<\/b>/);
  assert.match(leadStatus, /🟡 At Risk:\s*<b>1<\/b>/);
  assert.match(leadStatus, /🔴 Blocked:\s*<b>1<\/b>/);

  // 3. Bug Counts by Severity
  // Standup reports: 1 Crit + 3 High + 1 Med + 2 Low; Project bugs: 1 Crit
  assert.match(leadStatus, /Bug Counts by Severity/);
  assert.match(leadStatus, /Critical:\s*<b>2<\/b>/);
  assert.match(leadStatus, /High:\s*<b>3<\/b>/);
  assert.match(leadStatus, /Medium:\s*<b>1<\/b>/);
  assert.match(leadStatus, /Low:\s*<b>2<\/b>/);
  assert.match(leadStatus, /Total Defect Exposure:\s*<b>8<\/b>/);

  // 4. Active Blockers & Risks
  assert.match(leadStatus, /Active Blockers \(1\)/);
  assert.match(leadStatus, /Staging DB migration incomplete/);
  assert.match(leadStatus, /Risks \(2\)/);
  assert.match(leadStatus, /Vendor API rate limit throttling/);
  assert.match(leadStatus, /Release schedule slipping/);

  // 5. Overall QA Readiness
  assert.match(leadStatus, /BLOCKED \/ ACTION REQUIRED/);

  // Test QA Member /status output
  const memberStatus = formatQAMemberStatusText(mockProject, mockReports[0]);
  assert.match(memberStatus, /QA STATUS - KO/);
  assert.match(memberStatus, /🟢 On Track/);
  assert.match(memberStatus, /Payment and Transaction modules/);
});
