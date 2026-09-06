import React from 'react';
import {
  Search,
  Bell,
  CalendarCheck,
  Sparkles,
  Command,
  Sun,
  Moon,
  ChevronRight,
  Shield,
  Plane,
  FolderPlus,
} from 'lucide-react';
import { User, AppNotification } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';

interface TopHeaderProps {
  currentUser: User;
  activeTab: string;
  onOpenSearch: () => void;
  onOpenCheckIn: () => void;
  onOpenNotifications: () => void;
  onOpenOnboarding?: () => void;
  onOpenCreateProject?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  activeTab,
  onOpenSearch,
  onOpenCheckIn,
  onOpenNotifications,
  onOpenOnboarding,
  onOpenCreateProject,
  theme,
  onToggleTheme,
}) => {
  const notifications = StorageService.getNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const isLead = AuthService.isQALead(currentUser);

  const getTabBreadcrumb = () => {
    switch (activeTab) {
      case 'command-center':
        return 'Dashboard';
      case 'projects':
        return 'Projects';
      case 'tasks':
        return 'Tasks';
      case 'bugs':
        return 'Defects & Bugs';
      case 'test-cases':
        return 'Test Cases';
      case 'regression':
        return 'Test Execution';
      case 'team':
        return 'Team';
      case 'workload':
        return 'Workload Allocation';
      case 'daily-report':
        return 'Daily Reports';
      case 'blockers':
        return 'Blockers';
      case 'readiness':
        return 'Release Readiness';
      case 'reports':
        return 'Reports & Audit';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header
      style={{
        height: '64px',
        padding: '0 24px',
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left: Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Workspace</span>
        <ChevronRight size={14} color="var(--text-muted)" />
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getTabBreadcrumb()}</span>
      </div>

      {/* Center: Search Bar with ⌘ K badge */}
      <div
        onClick={onOpenSearch}
        style={{
          width: '320px',
          maxWidth: '40vw',
          padding: '7px 14px',
          background: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={14} />
          <span>Search anything...</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.68rem',
            fontWeight: 700,
            fontFamily: 'monospace',
          }}
        >
          <span>⌘</span>
          <span>K</span>
        </div>
      </div>

      {/* Right: Quick Actions & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Create New QA Project Action Button */}
        {isLead && onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            title="Create New QA Project (PRD, Specs, Team Assignment)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(37, 99, 235, 0.25))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(56, 189, 248, 0.15)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.28), rgba(37, 99, 235, 0.4))';
              e.currentTarget.style.borderColor = '#38bdf8';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(37, 99, 235, 0.25))';
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FolderPlus size={15} />
            <span>+ New Project</span>
          </button>
        )}

        {/* Daily Check-In Button */}
        <button
          onClick={onOpenCheckIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          }}
        >
          <CalendarCheck size={14} />
          <span>Daily Check-In</span>
        </button>

        {/* Notifications & Telegram Dispatch Hub Bell */}
        <button
          onClick={onOpenNotifications}
          title="Notification & Telegram Bot Hub"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#f43f5e',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.5)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Pill Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px 4px 5px',
            borderRadius: '20px',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid #38bdf8' }}
          />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700 }}>
              {currentUser.role === 'qa_lead' ? 'QA Lead' : 'QA Engineer'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
