import { QABug, BugStatus, BugSeverity } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export const BugService = {
  getBugs: (): QABug[] => {
    return StorageService.getBugs();
  },

  getBugById: (id: string): QABug | undefined => {
    return StorageService.getBugs().find((b) => b.id === id);
  },

  getBugsByProject: (projectId: string): QABug[] => {
    return StorageService.getBugs().filter((b) => b.projectId === projectId);
  },

  getBugsByAssignee: (assigneeId: string): QABug[] => {
    return StorageService.getBugs().filter((b) => b.assigneeId === assigneeId);
  },

  getRetestQueue: (): QABug[] => {
    return StorageService.getBugs().filter((b) => b.status === 'Retest');
  },

  getCriticalBugs: (): QABug[] => {
    return StorageService.getBugs().filter(
      (b) => b.severity === 'Critical' && b.status !== 'Closed' && b.status !== 'Resolved'
    );
  },

  getAgingBugs: (days = 2): QABug[] => {
    const now = new Date('2026-09-05').getTime();
    return StorageService.getBugs().filter((b) => {
      if (b.status === 'Closed' || b.status === 'Resolved') return false;
      const created = new Date(b.createdAt).getTime();
      const diffDays = (now - created) / (1000 * 60 * 60 * 24);
      return diffDays >= days;
    });
  },

  createBug: (
    bugData: Omit<QABug, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt' | 'reopenedCount'>,
    actorId: string
  ): QABug => {
    const bugs = StorageService.getBugs();
    const now = new Date().toISOString().split('T')[0];
    const newBug: QABug = {
      ...bugData,
      id: `bug-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      reopenedCount: 0,
    };

    bugs.unshift(newBug);
    StorageService.saveBugs(bugs);

    AuditService.log({
      actorId,
      action: 'Reported QA Defect',
      entityType: 'bug',
      entityId: newBug.id,
      newValue: `[${newBug.severity}] ${newBug.title}`,
    });

    // Notify QA Lead if Critical
    if (newBug.severity === 'Critical') {
      NotificationService.dispatch({
        recipientId: 'usr-sarah',
        title: `🚨 Critical Defect Filed: ${newBug.title}`,
        message: `A new Critical defect was reported on project ${newBug.projectId}: "${newBug.description}".`,
        type: 'bug_assigned',
        actionUrl: 'bugs',
      });
    }

    return newBug;
  },

  updateBugStatus: (
    bugId: string,
    newStatus: BugStatus,
    actorId: string
  ): QABug => {
    const bugs = StorageService.getBugs();
    const bug = bugs.find((b) => b.id === bugId);
    if (!bug) throw new Error('Bug not found');

    const previousStatus = bug.status;
    bug.status = newStatus;
    bug.updatedAt = new Date().toISOString().split('T')[0];
    bug.lastActivityAt = new Date().toISOString().split('T')[0];

    if (newStatus === 'Reopened') {
      bug.reopenedCount += 1;
    } else if (newStatus === 'Resolved') {
      bug.resolvedDate = new Date().toISOString().split('T')[0];
    }

    StorageService.saveBugs(bugs);

    AuditService.log({
      actorId,
      action: 'Bug Status Changed',
      entityType: 'bug',
      entityId: bugId,
      previousValue: previousStatus,
      newValue: newStatus,
    });

    if (newStatus === 'Retest') {
      NotificationService.dispatch({
        recipientId: bug.assigneeId,
        title: `🐛 Bug Ready for Retest: ${bug.title}`,
        message: `Developer has marked ${bug.title} for Retest. Please execute verification steps.`,
        type: 'bug_status',
        actionUrl: 'bugs',
      });
    }

    return bug;
  },
};
