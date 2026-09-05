import { TestCase, TestSuite, TestExecutionStatus } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';

export const TestCaseService = {
  getTestSuites: (): TestSuite[] => {
    return StorageService.getTestSuites();
  },

  getTestCases: (): TestCase[] => {
    return StorageService.getTestCases();
  },

  getTestCasesByProject: (projectId: string): TestCase[] => {
    return StorageService.getTestCases().filter((tc) => tc.projectId === projectId);
  },

  getTestCasesBySuite: (suiteId: string): TestCase[] => {
    return StorageService.getTestCases().filter((tc) => tc.suiteId === suiteId);
  },

  executeTestCase: (
    testCaseId: string,
    status: TestExecutionStatus,
    actorId: string,
    details?: { notes?: string; linkedBugId?: string }
  ): TestCase => {
    const testCases = StorageService.getTestCases();
    const tc = testCases.find((c) => c.id === testCaseId);
    if (!tc) throw new Error('Test case not found');

    const previousStatus = tc.executionStatus;
    tc.executionStatus = status;
    tc.lastExecutedAt = new Date().toISOString().split('T')[0];
    tc.lastExecutedBy = actorId;
    if (details?.notes !== undefined) tc.executionNotes = details.notes;
    if (details?.linkedBugId !== undefined) tc.linkedBugId = details.linkedBugId;

    StorageService.saveTestCases(testCases);

    AuditService.log({
      actorId,
      action: 'Test Case Executed',
      entityType: 'task',
      entityId: testCaseId,
      previousValue: previousStatus,
      newValue: status + (details?.notes ? ` (${details.notes})` : '') + (details?.linkedBugId ? ` [Bug: ${details.linkedBugId}]` : ''),
    });

    return tc;
  },

  createTestCase: (
    caseData: Omit<TestCase, 'id'>,
    actorId: string
  ): TestCase => {
    const testCases = StorageService.getTestCases();
    const newCase: TestCase = {
      ...caseData,
      id: `tc-${Date.now().toString(36)}`,
    };

    testCases.push(newCase);
    StorageService.saveTestCases(testCases);

    AuditService.log({
      actorId,
      action: 'Created QA Test Case',
      entityType: 'task',
      entityId: newCase.id,
      newValue: newCase.title,
    });

    return newCase;
  },

  // Deterministic calculation from actual database records (Section 13 & 30)
  getMetrics: (projectId?: string) => {
    const all = projectId
      ? StorageService.getTestCases().filter((tc) => tc.projectId === projectId)
      : StorageService.getTestCases();

    const total = all.length;
    const executed = all.filter((tc) => tc.executionStatus !== 'Not Run').length;
    const passed = all.filter((tc) => tc.executionStatus === 'Passed').length;
    const failed = all.filter((tc) => tc.executionStatus === 'Failed').length;
    const blocked = all.filter((tc) => tc.executionStatus === 'Blocked').length;
    const skipped = all.filter((tc) => tc.executionStatus === 'Skipped').length;
    const notRun = all.filter((tc) => tc.executionStatus === 'Not Run').length;

    // Safe handling for division by zero
    const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;
    const failRate = executed > 0 ? Math.round((failed / executed) * 100) : 0;
    const blockedRate = executed > 0 ? Math.round((blocked / executed) * 100) : 0;
    const executionProgress = total > 0 ? Math.round((executed / total) * 100) : 0;

    return {
      total,
      executed,
      passed,
      failed,
      blocked,
      skipped,
      notRun,
      passRate,
      failRate,
      blockedRate,
      executionProgress,
    };
  },
};
