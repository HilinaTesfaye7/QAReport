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

    // 1. Robust Target Chat ID Resolution
    let targetChatId: string | undefined;

    // Direct numeric ID or usr-<numeric> check (e.g. usr-854270712 -> 854270712)
    const cleanId = (notification.recipientId || '').replace(/^usr-/, '').trim();
    if (cleanId && /^\d+$/.test(cleanId)) {
      targetChatId = cleanId;
    }

    // Check user profiles in memory/localStorage
    if (!targetChatId) {
      const users = StorageService.getUsers();
      const recipient = users.find((u) => u.id === notification.recipientId || u.id === `usr-${notification.recipientId}`);
      if (recipient?.telegramChatId && /^\d+$/.test(recipient.telegramChatId)) {
        targetChatId = recipient.telegramChatId;
      }
    }

    // Check if recipient is Coco
    if (!targetChatId && notification.recipientId && (notification.recipientId.toLowerCase() === 'coco' || notification.recipientId.includes('347835367'))) {
      targetChatId = '347835367';
    }

    // Broadcast fallback ONLY for broadcast notifications
    if (!targetChatId && (notification.recipientId === 'broadcast' || notification.recipientId === 'all')) {
      targetChatId = config.telegram?.chatId || '347835367';
    }

    if (!targetChatId) {
      console.warn(`[TelegramProvider] No valid Telegram Chat ID found for recipient: ${notification.recipientId}`);
      return false;
    }

    const botToken = config.telegram?.botToken || '8976092354:AAGROrwSrscf27zGsH5zRaXv2OCSwES8CA8';

    if (botToken && targetChatId) {
      try {
        const safeTitle = escapeTelegramHtml(notification.title);
        const safeMessage = escapeTelegramHtml(notification.message);
        const text = `<b>${safeTitle}</b>\n\n${safeMessage}`;

        // 1. Try serverless proxy first (passes botToken so Vercel can always send)
        if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
          try {
            const proxyRes = await fetch(`${window.location.origin}/api/telegram`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send_message',
                chatId: targetChatId,
                text,
                botToken,
                replyMarkup: notification.payload?.replyMarkup,
              }),
            });
            if (proxyRes.ok) {
              const resData = await proxyRes.json();
              if (resData.ok) return true;
            }
          } catch (proxyErr) {
            console.warn('[TelegramProvider] Proxy dispatch attempt warning:', proxyErr);
          }
        }

        // 2. Direct Telegram API fallback
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              text,
              parse_mode: 'HTML',
              reply_markup: notification.payload?.replyMarkup,
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
    responsibility = 'Please prepare the test cases and submit them using /testcase',
    moduleNames?: string[],
    testCaseDeadline?: string
  ) {
    const users = StorageService.getUsers();
    const lead = users.find((u) => u.id === leadId);
    const leadName = lead ? lead.name : 'Sarah Jenkins';
    const coreProject = project.coreProjectName || 'Banking';

    let prdText = 'Not provided';
    if (project.resources?.prdUrl) {
      prdText = `<a href="${project.resources.prdUrl}">Open PRD</a>`;
    }

    let figmaText = 'Not provided';
    if (project.resources?.figmaUrl) {
      figmaText = `<a href="${project.resources.figmaUrl}">Open Figma</a>`;
    }

    let modulesText = '';
    if (moduleNames && moduleNames.length > 0) {
      modulesText = `\n🧩 Modules: ${moduleNames.join(', ')}`;
    }

    let deadlineText = '';
    if (testCaseDeadline) {
      deadlineText = `\n⏰ Test-Case Deadline: ${testCaseDeadline}`;
    }

    const message = `🎉 You have been assigned to a new project!\n\n` +
      `📁 Project: ${project.name}\n` +
      `👩💼 QA Lead: ${leadName}\n` +
      `📂 Core Project: ${coreProject}${modulesText}${deadlineText}\n\n` +
      `You have been assigned to this project as:\n` +
      `👤 QA Tester\n\n` +
      `Please review the project requirements before starting testing.\n\n` +
      `📄 PRD: ${prdText}\n` +
      `🎨 Figma: ${figmaText}\n\n` +
      `🧪 After reviewing the PRD and Figma,\n` +
      `please submit your test cases.`;

    const replyMarkup = {
      inline_keyboard: [
        [{ text: '🧪 Submit Test Cases', callback_data: `submit_testcases_${project.id}` }]
      ]
    };

    this.dispatch({
      recipientId: memberId,
      title: `NEW PROJECT ASSIGNMENT`,
      message,
      type: 'assignment',
      actionUrl: `projects?id=${project.id}`,
      payload: { projectId: project.id, replyMarkup },
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
