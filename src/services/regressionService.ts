import { RegressionCycle } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export const RegressionService = {
  getCycles: (): RegressionCycle[] => {
    return StorageService.getRegressionCycles();
  },

  getCyclesByProject: (projectId: string): RegressionCycle[] => {
    return StorageService.getRegressionCycles().filter((c) => c.projectId === projectId);
  },

  getCycleById: (id: string): RegressionCycle | undefined => {
    return StorageService.getRegressionCycles().find((c) => c.id === id);
  },

  createCycle: (
    data: Omit<RegressionCycle, 'id' | 'createdAt' | 'passRate'>,
    actorId: string
  ): RegressionCycle => {
    const cycles = StorageService.getRegressionCycles();
    const newCycle: RegressionCycle = {
      ...data,
      id: `reg-${Date.now().toString(36)}`,
      passRate: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };

    cycles.unshift(newCycle);
    StorageService.saveRegressionCycles(cycles);

    AuditService.log({
      actorId,
      action: 'Created Regression Test Cycle',
      entityType: 'regression',
      entityId: newCycle.id,
      newValue: `${newCycle.title} (Build: ${newCycle.buildVersion})`,
    });

    // Notify assigned members
    newCycle.assignedMemberIds.forEach((memberId) => {
      NotificationService.dispatch({
        recipientId: memberId,
        title: `🔄 Assigned to Regression Cycle: ${newCycle.title}`,
        message: `You have been assigned to regression cycle "${newCycle.title}" for build ${newCycle.buildVersion}. Scope: ${newCycle.testCaseIds.length} test cases.`,
        type: 'regression_assigned',
        actionUrl: `regression?id=${newCycle.id}`,
      });
    });

    return newCycle;
  },

  updateCycleStatus: (
    cycleId: string,
    status: RegressionCycle['status'],
    actorId: string
  ): RegressionCycle => {
    const cycles = StorageService.getRegressionCycles();
    const cycle = cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new Error('Regression cycle not found');

    const prev = cycle.status;
    cycle.status = status;
    StorageService.saveRegressionCycles(cycles);

    AuditService.log({
      actorId,
      action: 'Updated Regression Cycle Status',
      entityType: 'regression',
      entityId: cycleId,
      previousValue: prev,
      newValue: status,
    });

    return cycle;
  },

  // Compute metrics for a regression cycle
  getCycleMetrics: (cycleId: string) => {
    const cycle = RegressionService.getCycleById(cycleId);
    if (!cycle) {
      return { total: 0, executed: 0, passed: 0, failed: 0, blocked: 0, remaining: 0, passRate: 0 };
    }

    const testCases = StorageService.getTestCases().filter((tc) =>
      cycle.testCaseIds.includes(tc.id)
    );

    const total = testCases.length;
    const executed = testCases.filter((tc) => tc.executionStatus !== 'Not Run').length;
    const passed = testCases.filter((tc) => tc.executionStatus === 'Passed').length;
    const failed = testCases.filter((tc) => tc.executionStatus === 'Failed').length;
    const blocked = testCases.filter((tc) => tc.executionStatus === 'Blocked').length;
    const remaining = total - executed;
    const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

    return {
      total,
      executed,
      passed,
      failed,
      blocked,
      remaining,
      passRate,
    };
  },
};
