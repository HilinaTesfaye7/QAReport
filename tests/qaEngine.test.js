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


