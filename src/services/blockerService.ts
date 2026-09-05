import { Blocker, BlockerStatus, BlockerSeverity } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export const BlockerService = {
  syncBlockers: async (): Promise<Blocker[]> => {
    return StorageService.syncBlockersWithCloud();
  },

  getBlockers: (): Blocker[] => {
    return StorageService.getBlockers();
  },

  getOpenBlockers: (): Blocker[] => {
    return StorageService.getBlockers().filter((b) => b.status !== 'Resolved');
  },

  getBlockersByProject: (projectId: string): Blocker[] => {
    return StorageService.getBlockers().filter((b) => b.projectId === projectId);
  },

  getBlockersByMember: (memberId: string): Blocker[] => {
    return StorageService.getBlockers().filter((b) => b.memberId === memberId);
  },

  createBlocker: (
    data: Omit<Blocker, 'id' | 'createdAt' | 'resolvedAt'>,
    actorId: string
  ): Blocker => {
    const blockers = StorageService.getBlockers();
    const now = new Date().toISOString().split('T')[0];
    const newBlocker: Blocker = {
      ...data,
      id: `blk-${Date.now().toString(36)}`,
      createdAt: now,
    };

    blockers.unshift(newBlocker);
    StorageService.saveBlockers(blockers);

    AuditService.log({
      actorId,
      action: 'Reported QA Blocker',
      entityType: 'blocker',
      entityId: newBlocker.id,
      newValue: `[${newBlocker.severity}] ${newBlocker.title}`,
    });

    // Alert QA Lead
    const user = StorageService.getUsers().find((u) => u.id === actorId);
    NotificationService.dispatch({
      recipientId: 'usr-sarah',
      title: `⚠️ Blocker Reported: ${newBlocker.title}`,
      message: `${user?.name || 'QA Member'} reported a ${newBlocker.severity} blocker: "${newBlocker.description}".`,
      type: 'blocker_created',
      actionUrl: 'blockers',
    });

    return newBlocker;
  },

  updateBlockerStatus: (
    blockerId: string,
    status: BlockerStatus,
    actorId: string
  ): Blocker => {
    const blockers = StorageService.getBlockers();
    const blocker = blockers.find((b) => b.id === blockerId);
    if (!blocker) throw new Error('Blocker not found');

    const prev = blocker.status;
    blocker.status = status;
    if (status === 'Resolved') {
      blocker.resolvedAt = new Date().toISOString().split('T')[0];
    }

    StorageService.saveBlockers(blockers);

    AuditService.log({
      actorId,
      action: `Blocker Status Changed to ${status}`,
      entityType: 'blocker',
      entityId: blockerId,
      previousValue: prev,
      newValue: status,
    });

    if (status === 'Resolved') {
      NotificationService.dispatch({
        recipientId: blocker.memberId,
        title: `✓ Blocker Resolved: ${blocker.title}`,
        message: `Your blocker "${blocker.title}" has been marked as Resolved.`,
        type: 'blocker_resolved',
      });
    }

    return blocker;
  },
};
