import { User, MemberWorkload, WorkloadClassification } from '../types';
import { StorageService } from './storage';

export const WorkloadService = {
  // Deterministic formula following Section 9 master prompt
  computeMemberWorkload: (memberId: string): MemberWorkload => {
    const tasks = StorageService.getTasks().filter((t) => t.assigneeId === memberId);
    const activeTasks = tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled');
    const completedTasks = tasks.filter((t) => t.status === 'Completed');

    const bugs = StorageService.getBugs().filter(
      (b) => b.assigneeId === memberId && b.status !== 'Closed' && b.status !== 'Resolved'
    );
    const testCases = StorageService.getTestCases().filter(
      (tc) => tc.assigneeId === memberId && tc.executionStatus === 'Not Run'
    );
    const user = StorageService.getUsers().find((u) => u.id === memberId);

    // 1. Task Effort: Sum of active task estimated hours (base: 30 hours = 50 pts)
    const estimatedHoursTotal = activeTasks.reduce((sum, t) => sum + t.estimatedEffortHours, 0);
    const taskEffortScore = Math.min(50, (estimatedHoursTotal / 30) * 50);

    // 2. Priority Weight: Critical = 8 pts each, High = 4 pts each, Medium = 2 pts each
    let priorityWeight = 0;
    let criticalTasksCount = 0;
    activeTasks.forEach((t) => {
      if (t.priority === 'Critical') {
        priorityWeight += 8;
        criticalTasksCount += 1;
      } else if (t.priority === 'High') {
        priorityWeight += 4;
      } else if (t.priority === 'Medium') {
        priorityWeight += 2;
      } else {
        priorityWeight += 1;
      }
    });

    // 3. Deadline Pressure: Due today or overdue (+6 pts), due within 48h (+3 pts)
    let deadlinePressure = 0;
    const today = '2026-09-05';
    activeTasks.forEach((t) => {
      if (t.dueDate) {
        if (t.dueDate <= today) {
          deadlinePressure += 6;
        } else if (t.dueDate <= '2026-09-07') {
          deadlinePressure += 3;
        }
      }
    });

    // 4. Bug Workload: Critical bug = 7 pts, High bug = 4 pts, Medium/Low = 2 pts
    let bugWorkload = 0;
    bugs.forEach((b) => {
      if (b.severity === 'Critical') {
        bugWorkload += 7;
        criticalTasksCount += 1;
      } else if (b.severity === 'High') {
        bugWorkload += 4;
      } else {
        bugWorkload += 2;
      }
    });

    // 5. Project Load: Context switching (+5 pts per active project after the 1st)
    const projectsCount = user?.projectAllocations.length || 1;
    const projectLoad = Math.max(0, (projectsCount - 1) * 5);

    // 6. Blockers Penalty: +6 pts if blocked
    const blockedTasksCount = activeTasks.filter((t) => t.status === 'Blocked').length;
    const blockerLoad = blockedTasksCount * 6;

    // 7. Deduct Completed Work credit (reduces pressure by up to 15 pts)
    const completedWorkDeduction = Math.min(15, completedTasks.length * 3);

    // Total Score Calculation (Bounded 5 to 100)
    const rawScore =
      taskEffortScore +
      priorityWeight +
      deadlinePressure +
      bugWorkload +
      projectLoad +
      blockerLoad -
      completedWorkDeduction;

    const finalScore = Math.min(100, Math.max(5, Math.round(rawScore)));

    // Deterministic Classification
    let classification: WorkloadClassification = 'Balanced';
    if (finalScore <= 40) {
      classification = 'Low';
    } else if (finalScore <= 70) {
      classification = 'Balanced';
    } else if (finalScore <= 85) {
      classification = 'High';
    } else {
      classification = 'Overloaded';
    }

    const explanationParts: string[] = [];
    if (criticalTasksCount > 0) explanationParts.push(`${criticalTasksCount} critical items`);
    if (bugs.length > 0) explanationParts.push(`${bugs.length} open bugs`);
    if (blockedTasksCount > 0) explanationParts.push(`${blockedTasksCount} blocked`);
    if (projectsCount > 1) explanationParts.push(`${projectsCount} projects`);

    const explanation = explanationParts.length > 0
      ? explanationParts.join(' • ')
      : 'Healthy capacity';

    return {
      memberId,
      score: finalScore,
      classification,
      projectsCount,
      taskCount: activeTasks.length,
      estimatedHoursTotal,
      criticalTasksCount,
      openBugsCount: bugs.length,
      testCasesCount: testCases.length,
      blockedTasksCount,
      explanation,
    };
  },

  getAllMembersWorkload: (): MemberWorkload[] => {
    const engineers = StorageService.getUsers().filter((u) => u.role === 'qa_engineer');
    return engineers.map((eng) => WorkloadService.computeMemberWorkload(eng.id));
  },
};
