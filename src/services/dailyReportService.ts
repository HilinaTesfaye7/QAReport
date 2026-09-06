import { DailyReport } from '../types';
import { StorageService } from './storage';
import { WorkloadService } from './workloadService';
import { TestCaseService } from './testCaseService';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

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
    // 1. Fetch live daily reports from Supabase Cloud Database (written by Telegram Bot)
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('daily_reports')
          .select('*')
          .order('submitted_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: DailyReport[] = data.map((r: any) => {
            let parsedNotes: any = {};
            try {
              if (r.notes && typeof r.notes === 'string' && r.notes.startsWith('{')) {
                parsedNotes = JSON.parse(r.notes);
              }
            } catch {}

            return {
              id: r.id,
              date: r.date,
              chatId: r.chat_id,
              memberId: r.member_id || `usr-${r.chat_id || 'unknown'}`,
              memberName: r.member_name,
              role: r.role || 'QA Tester',
              projectId: r.project_id,
              projectName: r.project_name,
              yesterdayCompleted: r.yesterday_completed || parsedNotes.majorAchievement || '',
              todayWorkingOn: r.today_working_on || '',
              blockers: r.blockers || '',
              isBlocked: Boolean(r.is_blocked),
              risks: r.risks || parsedNotes.risks || '',
              nextPlan: r.next_plan || parsedNotes.nextPlan || r.expected_completion || '',
              majorAchievement: r.major_achievement || parsedNotes.majorAchievement || r.yesterday_completed || '',
              progressPercentage: Number(r.progress_percentage || 50),
              expectedCompletion: (r.expected_completion as any) || 'Today',
              notes: r.notes || '',
              status: 'submitted' as const,
              submittedAt: r.submitted_at || new Date().toISOString(),
              source: 'telegram' as const,
            };
          });

          StorageService.saveDailyReports(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase daily_reports sync error:', err);
      }
    }

    // 2. Fallback to local static JSON if cloud not reachable
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
          yesterdayCompleted: tg.yesterdayCompleted || tg.majorAchievement || '',
          todayWorkingOn: tg.todayWorkingOn || '',
          isBlocked: Boolean(tg.isBlocked),
          blockers: tg.blockers || '',
          risks: tg.risks || '',
          nextPlan: tg.nextPlan || tg.expectedCompletion || '',
          majorAchievement: tg.majorAchievement || tg.yesterdayCompleted || '',
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
      (r) => r.memberId === reportData.memberId && r.projectId === reportData.projectId && r.date === today
    );

    const report: DailyReport = {
      id: existingIdx !== -1 ? reports[existingIdx].id : `rep-${Date.now().toString(36)}`,
      date: today,
      memberId: reportData.memberId,
      projectId: reportData.projectId,
      yesterdayCompleted: reportData.yesterdayCompleted || reportData.majorAchievement || '',
      todayWorkingOn: reportData.todayWorkingOn || '',
      isBlocked: reportData.isBlocked ?? false,
      blockers: reportData.blockers || '',
      risks: reportData.risks || '',
      nextPlan: reportData.nextPlan || '',
      majorAchievement: reportData.majorAchievement || '',
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

    if (supabase) {
      const projects = StorageService.getProjects();
      const project = projects.find((p) => p.id === report.projectId);
      const projectName = project ? project.name : (report.projectName || 'General QA');
      const notesObj = {
        workStatus: report.isBlocked ? 'Blocked' : 'On Track',
        statusEmoji: report.isBlocked ? '🔴' : '🟢',
        risks: report.risks || '',
        nextPlan: report.nextPlan || report.expectedCompletion || '',
        majorAchievement: report.majorAchievement || report.yesterdayCompleted || '',
      };
      supabase
        .from('daily_reports')
        .upsert({
          id: report.id,
          date: report.date,
          member_id: report.memberId,
          member_name: memberName,
          role: member ? member.role : 'qa_engineer',
          project_id: report.projectId,
          project_name: projectName,
          today_working_on: report.todayWorkingOn,
          yesterday_completed: report.majorAchievement || report.yesterdayCompleted,
          blockers: report.blockers,
          is_blocked: report.isBlocked,
          expected_completion: report.nextPlan || report.expectedCompletion,
          notes: JSON.stringify(notesObj),
          submitted_at: report.submittedAt || new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn('[Supabase] Daily report upsert error:', error.message);
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
