import { AppNotification, Project, QATask } from '../types';
import { StorageService } from './storage';

export interface NotificationProvider {
  name: string;
  send(notification: AppNotification): Promise<boolean>;
}

export class InAppProvider implements NotificationProvider {
  name = 'In-App';
  async send(notification: AppNotification): Promise<boolean> {
    const notifs = StorageService.getNotifications();
    notifs.unshift(notification);
    StorageService.saveNotifications(notifs);
    return true;
  }
}

function escapeTelegramHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramProvider implements NotificationProvider {
  name = 'Telegram';
  async send(notification: AppNotification): Promise<boolean> {
    const config = StorageService.getChannelsConfig();
    if (!config.telegram?.enabled) return false;

    // Check if recipient has their own telegramChatId or is Coco
    const users = StorageService.getUsers();
    const recipient = users.find((u) => u.id === notification.recipientId);
    let targetChatId = recipient?.telegramChatId;
    if (!targetChatId && recipient && (recipient.name.toLowerCase() === 'coco' || recipient.id.includes('347835367'))) {
      targetChatId = '347835367';
    }
    if (!targetChatId) {
      targetChatId = config.telegram?.chatId || '347835367';
    }

    const botToken = config.telegram?.botToken || '8976092354:AAGROrwSrscf27zGsH5zRaXv2OCSwES8CA8';

    if (botToken && targetChatId) {
      try {
        const safeTitle = escapeTelegramHtml(notification.title);
        const safeMessage = escapeTelegramHtml(notification.message);
        const text = `<b>${safeTitle}</b>\n\n${safeMessage}`;
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              text,
              parse_mode: 'HTML',
            }),
          }
        );
        const data = await response.json();
        return data.ok;
      } catch (err) {
        console.error('[TelegramProvider] Failed to dispatch via Telegram API:', err);
        return false;
      }
    }

    console.log(
      `[Telegram Bot -> ${config.telegram?.botUsername || '@QAEaglebot'}] Dispatching: ${notification.title} - ${notification.message}`
    );
    return true;
  }
}

export class WhatsAppProvider implements NotificationProvider {
  name = 'WhatsApp';
  async send(notification: AppNotification): Promise<boolean> {
    const config = StorageService.getChannelsConfig();
    if (!config.whatsApp?.enabled) return false;
    console.log(`[WhatsApp Business -> ${config.whatsApp.phoneNumber}] Dispatching: ${notification.title}`);
    return true;
  }
}

export class SlackProvider implements NotificationProvider {
  name = 'Slack';
  async send(notification: AppNotification): Promise<boolean> {
    const config = StorageService.getChannelsConfig();
    if (!config.slack?.enabled) return false;
    console.log(`[Slack Webhook -> ${config.slack.channel}] ${notification.title}: ${notification.message}`);
    return true;
  }
}

export class EmailProvider implements NotificationProvider {
  name = 'Email';
  async send(notification: AppNotification): Promise<boolean> {
    const config = StorageService.getChannelsConfig();
    if (!config.email?.enabled) return false;
    console.log(`[Email Service -> ${config.email.sender}] Sent to user: ${notification.title}`);
    return true;
  }
}

class NotificationServiceManager {
  private providers: NotificationProvider[] = [
    new InAppProvider(),
    new TelegramProvider(),
    new WhatsAppProvider(),
    new SlackProvider(),
    new EmailProvider(),
  ];

  async dispatch(notificationData: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<AppNotification> {
    const notification: AppNotification = {
      ...notificationData,
      id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    // Broadcast across all enabled providers
    for (const provider of this.providers) {
      try {
        await provider.send(notification);
      } catch (err) {
        console.error(`Provider ${provider.name} failed to dispatch:`, err);
      }
    }

    return notification;
  }

  getNotificationsForUser(userId: string): AppNotification[] {
    return StorageService.getNotifications().filter(
      (n) => n.recipientId === userId || n.recipientId === 'broadcast'
    );
  }

  getUnreadCount(userId: string): number {
    return this.getNotificationsForUser(userId).filter((n) => !n.read).length;
  }

  markAsRead(notificationId: string): void {
    const notifs = StorageService.getNotifications();
    const target = notifs.find((n) => n.id === notificationId);
    if (target) {
      target.read = true;
      StorageService.saveNotifications(notifs);
    }
  }

  markAllAsRead(userId: string): void {
    const notifs = StorageService.getNotifications();
    notifs.forEach((n) => {
      if (n.recipientId === userId || n.recipientId === 'broadcast') {
        n.read = true;
      }
    });
    StorageService.saveNotifications(notifs);
  }

  // Specialized triggers required by prompt
  notifyProjectAssignment(
    project: Project,
    memberId: string,
    leadId: string,
    responsibility = 'Please prepare the test cases and submit them using /testcase'
  ) {
    const users = StorageService.getUsers();
    const lead = users.find((u) => u.id === leadId);
    const leadName = lead ? lead.name : 'QA Lead';
    const productOwner = project.projectOwner || 'Product Owner';

    // Format PRD link or file
    const prdDoc = project.resources?.prdDocuments?.[0];
    let prdText = '';
    if (project.resources?.prdUrl) {
      prdText = project.resources?.prdTitle
        ? `${project.resources.prdTitle} - ${project.resources.prdUrl}`
        : project.resources.prdUrl;
      if (prdDoc?.fileName) {
        prdText += ` | File: ${prdDoc.fileName}`;
      }
    } else if (prdDoc?.fileName) {
      prdText = project.resources?.prdTitle
        ? `${project.resources.prdTitle} (File: ${prdDoc.fileName})`
        : `File: ${prdDoc.fileName}`;
    } else {
      prdText = project.resources?.prdTitle || 'Available in PRD & Specs';
    }

    // Format Figma link
    const figmaText = project.resources?.figmaUrl || 'Available in Design (Figma) tab';

    const message = `New QA Project Assignment\n\nYou have been assigned to:\n${project.name}\n\nQA Lead: ${leadName}\nProduct Owner: ${productOwner}\n\nResources:\n📄 PRD: ${prdText}\n🎨 Figma: ${figmaText}\n\nYour initial responsibility:\n${responsibility}\n\nPlease review the project resources before starting.`;

    this.dispatch({
      recipientId: memberId,
      title: `Assigned to ${project.name}`,
      message,
      type: 'assignment',
      actionUrl: `projects?id=${project.id}`,
      payload: { projectId: project.id },
    });
  }

  notifyTaskAssignment(task: QATask, memberId: string) {
    this.dispatch({
      recipientId: memberId,
      title: `📋 New Task Assigned: ${task.title}`,
      message: `You have been assigned to task "${task.title}" [${task.priority}] with estimated effort of ${task.estimatedEffortHours}h. Due date: ${task.dueDate}.`,
      type: 'assignment',
      actionUrl: `tasks?id=${task.id}`,
      payload: { taskId: task.id },
    });
  }

  notifyBugRetestReady(bugId: string, bugTitle: string, assigneeId: string) {
    this.dispatch({
      recipientId: assigneeId,
      title: `🐛 Bug Ready for Retest: ${bugTitle}`,
      message: `The developer has marked ${bugTitle} as Ready for Retest on staging environment. Please verify.`,
      type: 'bug_retest',
      actionUrl: `bugs?id=${bugId}`,
      payload: { bugId },
    });
  }

  notifyBlockerAlert(leadId: string, memberName: string, blockerText: string) {
    this.dispatch({
      recipientId: leadId,
      title: `⚠️ Blocker Alert: ${memberName}`,
      message: `${memberName} has reported a critical blocker: "${blockerText}". Attention recommended.`,
      type: 'blocker',
      actionUrl: 'command-center',
    });
  }

  async testTelegram(
    botToken: string,
    chatId: string
  ): Promise<{ success: boolean; message: string }> {
    if (!botToken.trim() || !chatId.trim()) {
      return { success: false, message: 'Both Bot Token and Chat ID are required.' };
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: '🚀 <b>AegisQA Telegram Bot Connected!</b>\n\nYour Telegram bot is successfully connected to the QA Management System.\nYou will receive real-time notifications for critical defects, blockers, task assignments, and regression cycle updates.',
          parse_mode: 'HTML',
        }),
      });
      const data = await response.json();
      if (data.ok) {
        return { success: true, message: `Delivered test message to chat ${chatId}!` };
      } else {
        return { success: false, message: data.description || 'Telegram API error' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error connecting to Telegram' };
    }
  }
}

export const NotificationService = new NotificationServiceManager();
