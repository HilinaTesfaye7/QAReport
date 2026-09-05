import {
  User,
  QATask,
  QABug,
  Blocker,
  Project,
  ProjectReleaseReadiness,
  ReleaseStatus,
  RuleEvaluationResult,
} from '../types';
import { StorageService } from './storage';
import { WorkloadService } from './workloadService';
import { TestCaseService } from './testCaseService';

export interface ReleaseRulesConfig {
  minRegressionPassRate: number; // e.g. 90%
  minTestExecutionRate: number; // e.g. 85%
  maxHighBugsAllowedForRisks: number; // e.g. 3
}

const DEFAULT_RELEASE_CONFIG: ReleaseRulesConfig = {
  minRegressionPassRate: 90,
  minTestExecutionRate: 85,
  maxHighBugsAllowedForRisks: 3,
};

export const RuleEngine = {
  // Deterministic Assignment Recommender (No AI)
  recommendAssigneeForTask: (task: {
    projectId: string;
    estimatedEffortHours: number;
    priority: QATask['priority'];
    title: string;
    module?: string;
  }) => {
    const engineers = StorageService.getUsers().filter((u) => u.role === 'qa_engineer');
    const workloads = engineers.map((eng) => ({
      user: eng,
      workload: WorkloadService.computeMemberWorkload(eng.id),
    }));

    // Score candidates deterministically
    const scoredCandidates = workloads.map(({ user, workload }) => {
      let score = 100 - workload.score; // Base: lower workload is preferred

      const isAssignedToProject = user.projectAllocations.some(
        (p) => p.projectId === task.projectId
      );
      if (isAssignedToProject) score += 30;

      const titleLower = (task.title + ' ' + (task.module || '')).toLowerCase();
      let hasSkillMatch = false;

      if (titleLower.includes('api') && user.skills.includes('API Testing')) {
        score += 25;
        hasSkillMatch = true;
      }
      if (titleLower.includes('mobile') && user.skills.includes('Mobile Testing')) {
        score += 25;
        hasSkillMatch = true;
      }
      if (titleLower.includes('ui') && user.skills.includes('UI Testing')) {
        score += 20;
        hasSkillMatch = true;
      }
      if (titleLower.includes('automation') && user.skills.includes('Automation Testing')) {
        score += 25;
        hasSkillMatch = true;
      }
      if (titleLower.includes('regression') && user.skills.includes('Regression Testing')) {
        score += 20;
        hasSkillMatch = true;
      }

      // Hard penalty for overloaded members
      if (workload.classification === 'Overloaded') score -= 50;
      if (workload.classification === 'High') score -= 20;

      return {
        user,
        workload,
        score,
        isAssignedToProject,
        hasSkillMatch,
      };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);
    const best = scoredCandidates[0];
    const alternative = scoredCandidates[1];

    const reasons: string[] = [
      `Workload Score: ${best.workload.score}% (${best.workload.classification})`,
      `Available capacity: ~${100 - best.workload.score}% this week`,
    ];

    if (best.isAssignedToProject) {
      reasons.push('✓ Assigned to this project');
    }
    if (best.hasSkillMatch) {
      reasons.push('✓ Direct testing skill match');
    } else {
      reasons.push(`✓ Proven skills: ${best.user.skills.slice(0, 2).join(', ')}`);
    }

    if (best.workload.criticalTasksCount === 0) {
      reasons.push('✓ No conflicting critical deadlines');
    }

    return {
      recommendedMember: best.user,
      workload: best.workload,
      reasons,
      alternativeMember: alternative ? alternative.user : null,
      alternativeWorkload: alternative ? alternative.workload : null,
    };
  },

  // Deterministic Release Readiness Evaluator (No AI)
  evaluateReleaseReadiness: (
    projectId: string,
    config = DEFAULT_RELEASE_CONFIG
  ): ProjectReleaseReadiness => {
    const project = StorageService.getProjects().find((p) => p.id === projectId);
    const projectName = project ? project.name : 'Unknown Project';

    const bugs = StorageService.getBugs().filter(
      (b) => b.projectId === projectId && b.status !== 'Closed' && b.status !== 'Resolved'
    );
    const criticalBugs = bugs.filter((b) => b.severity === 'Critical');
    const highBugs = bugs.filter((b) => b.severity === 'High');

    const blockers = (StorageService.getBlockers ? StorageService.getBlockers() : []).filter(
      (b) => b.projectId === projectId && b.status !== 'Resolved'
    );
    const criticalBlockers = blockers.filter((b) => b.severity === 'Critical');

    const metrics = TestCaseService.getMetrics(projectId);
    const testCompletionRate = metrics.total > 0
      ? Math.round((metrics.executed / metrics.total) * 100)
      : 0;
    const passRate = metrics.passRate;
    const regressionPassRate = project ? project.regressionProgress : 0;

    const rules: RuleEvaluationResult[] = [];

    // Rule 1: Critical defects
    const r1Passed = criticalBugs.length === 0;
    rules.push({
      ruleName: 'Zero Critical Defects',
      passed: r1Passed,
      details: r1Passed ? 'No critical open bugs.' : `${criticalBugs.length} critical defect(s) unresolved.`,
    });

    // Rule 2: Critical blockers
    const r2Passed = criticalBlockers.length === 0;
    rules.push({
      ruleName: 'Zero Critical Blockers',
      passed: r2Passed,
      details: r2Passed ? 'No critical blockers.' : `${criticalBlockers.length} critical blocker(s) active.`,
    });

    // Rule 3: Regression Pass Rate Threshold
    const r3Passed = regressionPassRate >= config.minRegressionPassRate;
    rules.push({
      ruleName: `Regression Pass Rate ≥ ${config.minRegressionPassRate}%`,
      passed: r3Passed,
      details: `Current regression rate: ${regressionPassRate}% (Threshold: ${config.minRegressionPassRate}%).`,
    });

    // Rule 4: Test Execution Completion
    const r4Passed = testCompletionRate >= config.minTestExecutionRate;
    rules.push({
      ruleName: `Test Execution ≥ ${config.minTestExecutionRate}%`,
      passed: r4Passed,
      details: `Executed: ${testCompletionRate}% of total test cases.`,
    });

    // Rule 5: High Bugs Limit
    const r5Passed = highBugs.length <= config.maxHighBugsAllowedForRisks;
    rules.push({
      ruleName: `High Severity Bugs ≤ ${config.maxHighBugsAllowedForRisks}`,
      passed: r5Passed,
      details: `${highBugs.length} high severity bug(s) open.`,
    });

    // Determine Final Release Status
    let status: ReleaseStatus = 'READY';

    if (criticalBlockers.length > 0) {
      status = 'BLOCKED';
    } else if (!r1Passed || !r3Passed) {
      status = 'NOT_READY';
    } else if (!r4Passed || !r5Passed || highBugs.length > 0) {
      status = 'READY_WITH_RISKS';
    } else {
      status = 'READY';
    }

    return {
      projectId,
      projectName,
      status,
      testCompletionRate,
      passRate,
      criticalBugsCount: criticalBugs.length,
      highBugsCount: highBugs.length,
      openBlockersCount: blockers.length,
      regressionStatus: `${regressionPassRate}% Complete`,
      uatStatus: testCompletionRate > 90 ? 'Approved' : 'In Progress',
      rulesEvaluated: rules,
    };
  },

  // Rule-Driven Daily Questions Generator (No AI)
  generateRuleDrivenCheckInQuestions: (memberId: string) => {
    const user = StorageService.getUsers().find((u) => u.id === memberId);
    const tasks = StorageService.getTasks().filter(
      (t) => t.assigneeId === memberId && t.status !== 'Completed' && t.status !== 'Cancelled'
    );
    const retestBugs = StorageService.getBugs().filter(
      (b) => b.assigneeId === memberId && b.status === 'Retest'
    );
    const blockers = (StorageService.getBlockers ? StorageService.getBlockers() : []).filter(
      (b) => b.memberId === memberId && b.status !== 'Resolved'
    );
    const workload = WorkloadService.computeMemberWorkload(memberId);

    const today = '2026-09-05';
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today);
    const dueTodayTasks = tasks.filter((t) => t.dueDate === today);

    const questions: { id: string; question: string; isContextual: boolean }[] = [
      { id: 'yesterday', question: 'What did you complete yesterday?', isContextual: false },
      { id: 'today', question: 'What are you working on today?', isContextual: false },
      { id: 'blockers', question: 'Are you blocked by anything right now?', isContextual: false },
      { id: 'expected', question: 'What do you expect to complete today?', isContextual: false },
      { id: 'help', question: 'Do you need help or escalation from the QA Lead?', isContextual: false },
    ];

    // Rule 1: Inactive/Overdue Tasks
    if (overdueTasks.length > 0) {
      questions.unshift({
        id: 'overdue',
        question: `⚠ Overdue Notice: Your task "${overdueTasks[0].title}" was due on ${overdueTasks[0].dueDate}. What is the current status and revised completion ETA?`,
        isContextual: true,
      });
    }

    // Rule 2: Open Blocker Follow-Up
    if (blockers.length > 0) {
      questions.splice(3, 0, {
        id: 'blocker_followup',
        question: `🔍 Blocker Check: Your reported blocker "${blockers[0].title}" is currently marked ${blockers[0].status}. Has this been unblocked?`,
        isContextual: true,
      });
    }

    // Rule 3: Retest Queue
    if (retestBugs.length > 0) {
      questions.splice(2, 0, {
        id: 'retest',
        question: `🐛 Defect Retest: You have ${retestBugs.length} bug(s) marked for Retest (${retestBugs[0].id.toUpperCase()}). Will you verify this today?`,
        isContextual: true,
      });
    }

    // Rule 4: Overloaded Member Warning
    if (workload.classification === 'Overloaded') {
      questions.push({
        id: 'workload_warning',
        question: `🔴 Workload Alert: Your workload is currently ${workload.score}% (Overloaded with ${workload.taskCount} tasks). Which tasks can be reassigned?`,
        isContextual: true,
      });
    }

    return {
      greeting: `Good morning, ${user ? user.name.split(' ')[0] : 'there'}!`,
      activeTasksCount: tasks.length,
      dueTodayTasksCount: dueTodayTasks.length,
      overdueTasksCount: overdueTasks.length,
      retestBugsCount: retestBugs.length,
      openBlockersCount: blockers.length,
      questions,
    };
  },
};
