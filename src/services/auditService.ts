import { AuditLog } from '../types';
import { StorageService } from './storage';

export const AuditService = {
  getLogs: (): AuditLog[] => {
    return StorageService.getAuditLogs();
  },

  log: (entry: {
    actorId: string;
    action: string;
    entityType: AuditLog['entityType'];
    entityId: string;
    previousValue?: string;
    newValue?: string;
    isAIGenerated?: boolean;
    humanApproved?: boolean;
    channel?: AuditLog['channel'];
    originalPromptOrResponse?: string;
  }): AuditLog => {
    const users = StorageService.getUsers();
    const actor = users.find((u) => u.id === entry.actorId);

    const now = new Date();
    const formattedTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    const newLog: AuditLog = {
      id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: formattedTimestamp,
      actorId: entry.actorId,
      actorName: actor ? actor.name : (entry.actorId.includes('ai') ? 'AI QA Assistant' : 'System'),
      actorRole: actor ? actor.role : 'qa_lead',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      isAIGenerated: entry.isAIGenerated ?? false,
      humanApproved: entry.humanApproved ?? true,
      channel: entry.channel ?? 'in_app',
      originalPromptOrResponse: entry.originalPromptOrResponse,
    };

    const logs = StorageService.getAuditLogs();
    logs.unshift(newLog);
    // Keep max 500 logs
    if (logs.length > 500) logs.length = 500;
    StorageService.saveAuditLogs(logs);

    return newLog;
  },
};
