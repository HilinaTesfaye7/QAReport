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

    // Phase 12 Global Workload Calculation using Module Assignments
    const moduleAssignments = StorageService.getModuleAssignments 
      ? StorageService.getModuleAssignments().filter(a => a.testerId === memberId && a.status === 'Active')
      : [];

    let allocationSum = 0;
    moduleAssignments.forEach(ma => {
      allocationSum += ma.allocationPercentage || 0;
    });

    const projectsCount = user?.projectAllocations?.length || 0;
    
    let criticalTasksCount = activeTasks.filter(t => t.priority === 'Critical').length;
    let blockedTasksCount = activeTasks.filter(t => t.status === 'Blocked').length;
    
    // Fallback if no module assignments exist: use the old formula (or parts of it)
    let finalScore = allocationSum;
    if (finalScore === 0 && (activeTasks.length > 0 || bugs.length > 0)) {
      // 1. Task Effort: Sum of active task estimated hours (base: 30 hours = 50 pts)
      const estimatedHoursTotal = activeTasks.reduce((sum, t) => sum + (t.estimatedEffortHours || 0), 0);
      const taskEffortScore = Math.min(50, (estimatedHoursTotal / 30) * 50);

      // 2. Priority Weight: Critical = 8 pts each, High = 4 pts each, Medium = 2 pts each
      let priorityWeight = 0;
      activeTasks.forEach((t) => {
        if (t.priority === 'Critical') priorityWeight += 8;
        else if (t.priority === 'High') priorityWeight += 4;
        else if (t.priority === 'Medium') priorityWeight += 2;
        else priorityWeight += 1;
      });

      let bugWorkload = 0;
      bugs.forEach((b) => {
        if (b.severity === 'Critical') {
          bugWorkload += 7;
          criticalTasksCount += 1;
        }
        else if (b.severity === 'High') bugWorkload += 4;
        else bugWorkload += 2;
      });

      const blockerLoad = blockedTasksCount * 6;

      const completedWorkDeduction = Math.min(15, completedTasks.length * 3);

      const rawScore = taskEffortScore + priorityWeight + bugWorkload + blockerLoad - completedWorkDeduction;
      finalScore = Math.min(100, Math.max(5, Math.round(rawScore)));
    }

    let classification: WorkloadClassification = 'Balanced';
    if (finalScore <= 40) {
      classification = 'Low';
    } else if (finalScore <= 80) {
      classification = 'Balanced';
    } else if (finalScore <= 100) {
      classification = 'High';
    } else {
      classification = 'Overloaded';
    }

    const explanationParts: string[] = [];
    if (allocationSum > 0) explanationParts.push(`${allocationSum}% Module Allocation`);
    if (criticalTasksCount > 0) explanationParts.push(`${criticalTasksCount} critical items`);
    if (bugs.length > 0) explanationParts.push(`${bugs.length} open bugs`);
    if (activeTasks.filter(t => t.status === 'Blocked').length > 0) explanationParts.push(`${activeTasks.filter(t => t.status === 'Blocked').length} blocked`);
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
      estimatedHoursTotal: activeTasks.reduce((sum, t) => sum + (t.estimatedEffortHours || 0), 0),
      criticalTasksCount,
      openBugsCount: bugs.length,
      testCasesCount: testCases.length,
      blockedTasksCount,
      explanation,
    };
  },

  getAllMembersWorkload: (): MemberWorkload[] => {
    const users = StorageService.getUsers();
    return users.map((u) => WorkloadService.computeMemberWorkload(u.id));
  },
};
