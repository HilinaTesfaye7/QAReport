import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  Send,
  ExternalLink,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  X,
  Settings,
  Key,
  HelpCircle,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import { AppNotification, User } from '../types';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/notificationService';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onNavigateTo?: (tab: string, id?: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  currentUser,
  onNavigateTo,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'channels'>('inbox');
  const [channels, setChannels] = useState(StorageService.getChannelsConfig());
  const [testSentToast, setTestSentToast] = useState<string | null>(null);

  // Telegram Configuration State
  const [telegramToken, setTelegramToken] = useState(channels.telegram?.botToken || '');
  const [telegramChatId, setTelegramChatId] = useState(channels.telegram?.chatId || '');
  const [telegramUsername, setTelegramUsername] = useState(channels.telegram?.botUsername || '@AegisQABot');
  const [showToken, setShowToken] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  const reload = () => {
    setNotifications(NotificationService.getNotificationsForUser(currentUser.id));
    const cfg = StorageService.getChannelsConfig();
    setChannels(cfg);
    setTelegramToken(cfg.telegram?.botToken || '');
    setTelegramChatId(cfg.telegram?.chatId || '');
    setTelegramUsername(cfg.telegram?.botUsername || '@AegisQABot');
  };

  useEffect(() => {
    if (isOpen) reload();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleMarkAsRead = (id: string) => {
    NotificationService.markAsRead(id);
    reload();
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead(currentUser.id);
    reload();
  };

  const toggleChannel = (channelKey: string) => {
    const updated = {
      ...channels,
      [channelKey]: {
        ...channels[channelKey],
        enabled: !channels[channelKey]?.enabled,
      },
    };
    StorageService.saveChannelsConfig(updated);
    setChannels(updated);
  };

  const handleSaveTelegramConfig = () => {
    const updated = {
      ...channels,
      telegram: {
        ...channels.telegram,
        botUsername: telegramUsername.trim(),
        botToken: telegramToken.trim(),
        chatId: telegramChatId.trim(),
        enabled: true,
        connected: Boolean(telegramToken.trim() && telegramChatId.trim()),
      },
    };
    StorageService.saveChannelsConfig(updated);
    setChannels(updated);
    setTestSentToast('Telegram settings saved successfully!');
    setTimeout(() => setTestSentToast(null), 3000);
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    // Save current values first
    handleSaveTelegramConfig();

    const result = await NotificationService.testTelegram(telegramToken, telegramChatId);
    setIsTestingTelegram(false);
    setTelegramTestResult(result);
  };

  const handleSimulateTestDispatch = async (provider: string) => {
    await NotificationService.dispatch({
      recipientId: currentUser.id,
      title: `⚡ ${provider} Connection Test Ping`,
      message: `Direct dispatch verification to ${provider}. Automated alert stream operational.`,
      type: 'announcement',
    });
    setTestSentToast(`Dispatched test event to ${provider}`);
    setTimeout(() => setTestSentToast(null), 3000);
    reload();
  };

  const getIconForType = (type: AppNotification['type']) => {
    switch (type) {
      case 'blocker':
      case 'blocker_created':
        return <span style={{ color: '#f43f5e' }}>🛑</span>;
      case 'blocker_resolved':
        return <span style={{ color: '#10b981' }}>🟢</span>;
      case 'bug_assigned':
      case 'bug_retest':
      case 'bug_status':
        return <span style={{ color: '#a855f7' }}>🐛</span>;
      case 'regression_assigned':
        return <span style={{ color: '#f59e0b' }}>🔄</span>;
      case 'daily_report_reminder':
        return <span style={{ color: '#38bdf8' }}>📋</span>;
      default:
        return <span style={{ color: '#38bdf8' }}>🔔</span>;
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          width: '680px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#38bdf8" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Notification & Bot Dispatch Hub</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0 20px',
            background: 'var(--bg-app)',
          }}
        >
          <button
            onClick={() => setActiveTab('inbox')}
            style={{
              padding: '12px 16px',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'inbox' ? 700 : 500,
              color: activeTab === 'inbox' ? '#38bdf8' : 'var(--text-secondary)',
              borderBottom: activeTab === 'inbox' ? '2px solid #38bdf8' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            My Inbox ({notifications.filter((n) => !n.read).length} Unread)
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            style={{
              padding: '12px 16px',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'channels' ? 700 : 500,
              color: activeTab === 'channels' ? '#38bdf8' : 'var(--text-secondary)',
              borderBottom: activeTab === 'channels' ? '2px solid #38bdf8' : '2px solid transparent',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Settings size={14} /> Telegram & Channels
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {testSentToast && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{testSentToast}</span>
            </div>
          )}

          {activeTab === 'inbox' ? (
            /* Inbox Tab */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Showing notifications for {currentUser.name}
                </span>
                {notifications.some((n) => !n.read) && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 600 }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  🎉 All clear! You have no unread notifications.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: n.read ? 'var(--bg-card-subtle)' : 'var(--bg-card-hover)',
                        border: n.read ? '1px solid var(--border-subtle)' : '1px solid rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '1.2rem', marginTop: '2px' }}>{getIconForType(n.type)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{n.title}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.createdAt}</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', whiteSpace: 'pre-line' }}>
                          {n.message}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkAsRead(n.id)}
                              style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}
                            >
                              Mark as read
                            </button>
                          )}
                          {n.actionUrl && onNavigateTo && (
                            <button
                              onClick={() => {
                                onNavigateTo(n.actionUrl!);
                                onClose();
                              }}
                              style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}
                            >
                              <span>View details</span>
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Channels & Telegram Bot Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Telegram Bot & Multi-Channel Dispatch</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Connect your QA team to Telegram for instant defect alerts, blocker escalation, and daily standup submissions.
                </p>
              </div>

              {/* Telegram Primary Integration Card */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.06) 0%, rgba(99, 102, 241, 0.06) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>✈️</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Telegram QA Bot Integration</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Live two-way bot for standups, blocker alerts, and critical bug notifications
                      </div>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={channels.telegram?.enabled}
                      onChange={() => toggleChannel('telegram')}
                    />
                    <span>{channels.telegram?.enabled ? '🟢 Enabled' : '⚪ Disabled'}</span>
                  </label>
                </div>

                {/* Telegram Credentials Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px', color: 'var(--text-muted)' }}>
                      Telegram Bot Username (Created with @BotFather, e.g. @QAEaglebot)
                    </label>
                    <input
                      type="text"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="@QAEaglebot"
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Telegram Bot Token (from @BotFather)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{showToken ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="e.g. 7123456789:AAFlM-K1rL4..."
                      style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px', color: 'var(--text-muted)' }}>
                      Target Chat ID (Your User ID or QA Group Chat ID)
                    </label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="e.g. 123456789 or -100123456789"
                      style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {/* Test Result Message */}
                {telegramTestResult && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      fontSize: '0.82rem',
                      background: telegramTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      border: telegramTestResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
                      color: telegramTestResult.success ? '#10b981' : '#f43f5e',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {telegramTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span style={{ fontWeight: 600 }}>{telegramTestResult.message}</span>
                    </div>
                    {!telegramTestResult.success && telegramTestResult.message.toLowerCase().includes("initiate conversation") && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(244, 63, 94, 0.3)', color: '#fca5a5', fontSize: '0.78rem' }}>
                        <div><strong>Why this happens:</strong> Telegram's anti-spam policy prevents bots from messaging you until you send <code>/start</code> first.</div>
                        <div style={{ marginTop: '8px' }}>
                          <a
                            href={`https://t.me/${(telegramUsername.trim().replace('@', '') || 'QAEaglebot')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              background: '#0284c7',
                              color: '#ffffff',
                              fontWeight: 700,
                              textDecoration: 'none',
                              fontSize: '0.75rem',
                            }}
                          >
                            👉 Click to Open @{(telegramUsername.trim().replace('@', '') || 'QAEaglebot')} in Telegram & Press START
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleSaveTelegramConfig}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    Save Credentials
                  </button>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram || !telegramToken.trim() || !telegramChatId.trim()}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                  >
                    <Send size={13} />
                    <span>{isTestingTelegram ? 'Connecting...' : 'Test Live Telegram Message'}</span>
                  </button>
                </div>

                {/* Setup Instructions Accordion */}
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowTelegramGuide(!showTelegramGuide)}
                    style={{
                      fontSize: '0.75rem',
                      color: '#38bdf8',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>How to create your bot & get Chat ID in 2 minutes</span>
                    {showTelegramGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showTelegramGuide && (
                    <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <ol style={{ paddingLeft: '16px', margin: 0 }}>
                        <li>Open Telegram and search for <strong>@BotFather</strong>.</li>
                        <li>Send <code>/newbot</code>, choose a friendly name and a username ending in <code>bot</code>.</li>
                        <li>Copy the generated <strong>HTTP API Token</strong> and paste it into the <em>Bot Token</em> field above.</li>
                        <li>Open your new bot in Telegram and tap <strong>Start</strong> (or send <code>/start</code>).</li>
                        <li>To find your Chat ID: message <strong>@userinfobot</strong> or <strong>@GetMyChatID_Bot</strong> in Telegram. Paste that number into <em>Target Chat ID</em>.</li>
                        <li>Click <strong>Test Live Telegram Message</strong> to verify delivery!</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>

              {/* Standalone QA Daily Bot Runner Snippet */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Terminal size={15} color="#38bdf8" />
                  <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>Run Standalone Two-Way Standup Bot</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Run the native Node.js Telegram bot script in your terminal to enable team members to submit daily QA check-ins directly via Telegram:
                </p>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#090d16',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    overflowX: 'auto',
                  }}
                >
                  node scripts/telegramQABot.js {telegramToken ? telegramToken.slice(0, 15) + '...' : '&lt;BOT_TOKEN&gt;'}
                </div>
              </div>

              {/* Other Providers Overview */}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>
                Other Notification Providers:
              </div>

              {/* In-App */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>In-App Notifications (Native)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Real-time in-app drawer and alerts</div>
                </div>
                <span className="badge badge-available">Active Core</span>
              </div>

              {/* Slack */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Slack Webhook</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Channel: <code>{channels.slack?.channel}</code></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => handleSimulateTestDispatch('Slack')} className="btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 6px' }}>
                    Ping
                  </button>
                  <input type="checkbox" checked={channels.slack?.enabled} onChange={() => toggleChannel('slack')} />
                </div>
              </div>

              {/* WhatsApp */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>WhatsApp Cloud API</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Phone: <code>{channels.whatsApp?.phoneNumber}</code></div>
                </div>
                <input type="checkbox" checked={channels.whatsApp?.enabled} onChange={() => toggleChannel('whatsApp')} />
              </div>

              {/* Email */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Email Digest</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sender: <code>{channels.email?.sender}</code></div>
                </div>
                <input type="checkbox" checked={channels.email?.enabled} onChange={() => toggleChannel('email')} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
