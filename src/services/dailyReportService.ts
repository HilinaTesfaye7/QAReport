import { DailyReport } from '../types';
import { StorageService } from './storage';
import { WorkloadService } from './workloadService';
import { TestCaseService } from './testCaseService';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export const DailyReportService = {
  getDailyReports: (): DailyReport[] => {
    return StorageService.getDailyReports();
  },

  getReportsByMember: (memberId: string): DailyReport[] => {
    return StorageService.getDailyReports().filter((r) => r.memberId === memberId);
  },

  getLatestReportForMember: (memberId: string): DailyReport | undefined => {
    const reports = StorageService.getDailyReports().filter((r) => r.memberId === memberId);
    return reports[0];
  },

  getLatestReportForProject: (projectId: string): DailyReport | undefined => {
    const reports = StorageService.getDailyReports().filter((r) => r.projectId === projectId && r.status === 'submitted');
    return reports[0];
  },

  syncTelegramReports: async (): Promise<DailyReport[]> => {
    try {
      const res = await fetch('/telegram_daily_reports.json', { cache: 'no-cache' });
      if (!res.ok) return StorageService.getDailyReports();
      const tgReports = await res.json();
      if (!Array.isArray(tgReports)) return StorageService.getDailyReports();

      const existing = StorageService.getDailyReports();
      let updated = [...existing];
      let hasChanges = false;

      for (const tg of tgReports) {
        const mappedReport: DailyReport = {
          id: tg.id || `tg-${Date.now()}`,
          date: tg.date || new Date().toISOString().split('T')[0],
          memberId: tg.memberId || `usr-${tg.chatId || 'coco'}`,
          memberName: tg.memberName || 'Coco',
          role: tg.role || 'tester',
          projectId: tg.projectId || 'prj-banking',
          projectName: tg.projectName || 'Banking SuperApp',
          yesterdayCompleted: tg.yesterdayCompleted || '',
          todayWorkingOn: tg.todayWorkingOn || '',
          isBlocked: Boolean(tg.isBlocked),
          blockers: tg.blockers || '',
          progressPercentage: 75,
          expectedCompletion: tg.expectedCompletion || 'Today',
          notes: tg.notes || '',
          status: 'submitted',
          submittedAt: tg.submittedAt || new Date().toISOString(),
          source: 'telegram',
        };

        const idx = updated.findIndex((r) => r.id === mappedReport.id);
        if (idx !== -1) {
          updated[idx] = mappedReport;
        } else {
          updated.unshift(mappedReport);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        StorageService.saveDailyReports(updated);
      }
      return updated;
    } catch {
      return StorageService.getDailyReports();
    }
  },

  saveReportDraft: (reportData: Partial<DailyReport> & { memberId: string; projectId: string }): DailyReport => {
    const reports = StorageService.getDailyReports();
    const today = new Date().toISOString().split('T')[0];

    const existingIdx = reports.findIndex(
      (r) => r.memberId === reportData.memberId && r.date === today
    );

    const report: DailyReport = {
      id: existingIdx !== -1 ? reports[existingIdx].id : `rep-${Date.now().toString(36)}`,
      date: today,
      memberId: reportData.memberId,
      projectId: reportData.projectId,
      yesterdayCompleted: reportData.yesterdayCompleted || '',
      todayWorkingOn: reportData.todayWorkingOn || '',
      isBlocked: reportData.isBlocked ?? false,
      blockers: reportData.blockers || '',
      progressPercentage: reportData.progressPercentage || 50,
      expectedCompletion: reportData.expectedCompletion || 'Today',
      notes: reportData.notes || '',
      status: 'draft',
    };

    if (existingIdx !== -1) {
      reports[existingIdx] = report;
    } else {
      reports.unshift(report);
    }

    StorageService.saveDailyReports(reports);
    return report;
  },

  submitDailyReport: (reportId: string, actorId: string): DailyReport => {
    const reports = StorageService.getDailyReports();
    const report = reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Daily report not found');

    report.status = 'submitted';
    report.submittedAt = new Date().toISOString();
    StorageService.saveDailyReports(reports);

    const users = StorageService.getUsers();
    const member = users.find((u) => u.id === report.memberId);
    const memberName = member ? member.name : 'QA Member';

    AuditService.log({
      actorId,
      action: 'Submitted Daily QA Report',
      entityType: 'report',
      entityId: reportId,
      newValue: `Submitted by ${memberName}`,
    });

    if (report.isBlocked && report.blockers.trim().length > 0) {
      NotificationService.dispatch({
        recipientId: 'usr-sarah',
        title: `⚠️ Blocker in Daily Report: ${memberName}`,
        message: `${memberName} reported: "${report.blockers}".`,
        type: 'blocker_created',
        actionUrl: 'daily-report',
      });
    }

    return report;
  },

  // Generates aggregated QA Lead Daily Team Report (Section 16)
  generateAggregatedTeamReport: () => {
    const projects = StorageService.getProjects();
    const engineers = StorageService.getUsers().filter((u) => u.role === 'qa_engineer');
    const tasks = StorageService.getTasks();
    const bugs = StorageService.getBugs();
    const metrics = TestCaseService.getMetrics();
    const workloads = WorkloadService.getAllMembersWorkload();
    const reports = StorageService.getDailyReports();

    // Sort workloads for lowest and highest
    const sortedWorkloads = [...workloads].sort((a, b) => a.score - b.score);
    const lowestWorkload = sortedWorkloads[0];
    const highestWorkload = sortedWorkloads[sortedWorkloads.length - 1];
    const overloadedMembers = workloads.filter((w) => w.classification === 'Overloaded');

    // Overdue tasks
    const today = '2026-09-05';
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'Completed');

    // Blocked tasks
    const blockedTasks = tasks.filter((t) => t.status === 'Blocked');

    // Bugs counts
    const criticalBugs = bugs.filter((b) => b.severity === 'Critical' && b.status !== 'Closed');
    const highBugs = bugs.filter((b) => b.severity === 'High' && b.status !== 'Closed');
    const resolvedBugs = bugs.filter((b) => b.status === 'Resolved');
    const reopenedBugs = bugs.filter((b) => b.status === 'Reopened' || b.reopenedCount > 0);

    const avgRegressionProgress = Math.round(
      projects.reduce((sum, p) => sum + p.regressionProgress, 0) / (projects.length || 1)
    );

    return {
      date: today,
      teamProgress: {
        completedYesterday: tasks.filter((t) => t.status === 'Completed').length,
        plannedToday: tasks.filter((t) => t.status === 'In Progress').length,
        blockedWork: blockedTasks.length,
        overdueWork: overdueTasks.length,
      },
      teamWorkload: {
        lowest: lowestWorkload,
        highest: highestWorkload,
        overloadedCount: overloadedMembers.length,
      },
      bugs: {
        newToday: bugs.filter((b) => b.createdAt === today).length,
        critical: criticalBugs.length,
        high: highBugs.length,
        resolved: resolvedBugs.length,
        reopened: reopenedBugs.length,
      },
      testing: {
        executed: metrics.executed,
        passed: metrics.passed,
        failed: metrics.failed,
        blocked: metrics.blocked,
        passRate: metrics.passRate,
        regressionProgress: avgRegressionProgress,
      },
      submittedReportsCount: reports.filter((r) => r.status === 'submitted').length,
    };
  },
};
