import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Bell,
  Sun,
  Moon,
  RotateCcw,
  UserPlus,
  ChevronDown,
  CheckCircle2,
  Search,
  MessageSquare,
} from 'lucide-react';
import { User } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/notificationService';

interface NavbarProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  onOpenOnboarding: () => void;
  onOpenCheckIn: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onUserChange,
  onOpenOnboarding,
  onOpenCheckIn,
  onOpenSearch,
  onOpenNotifications,
  theme,
  onToggleTheme,
  activeTab,
  onTabChange,
}) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = () => {
    setAllUsers(AuthService.getAllUsers());
    setUnreadCount(NotificationService.getUnreadCount(currentUser.id));
  };

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, [currentUser]);

  const handleSelectUser = (user: User) => {
    AuthService.switchUser(user.id);
    onUserChange(user);
    setIsUserDropdownOpen(false);
  };

  const handleResetData = () => {
    if (confirm('Reset all demo data back to factory defaults?')) {
      StorageService.resetAll();
      const user = AuthService.getCurrentUser();
      onUserChange(user);
    }
  };

  const isLead = currentUser.role === 'qa_lead';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Brand & Main Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div
          onClick={() => onTabChange(isLead ? 'command-center' : 'my-work')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            <ShieldCheck size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                Aegis<span style={{ color: '#38bdf8' }}>QA</span>
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                V1 Core
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              QA Management System
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Enforcing Strict Role-Based Visibility) */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {isLead ? (
            <>
              <button
                onClick={() => onTabChange('command-center')}
                className={`btn-secondary ${activeTab === 'command-center' ? 'active-tab' : ''}`}
                style={{
                  fontWeight: activeTab === 'command-center' ? 700 : 500,
                  color: activeTab === 'command-center' ? '#38bdf8' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'command-center' ? '2px solid #38bdf8' : 'none',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={() => onTabChange('projects')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'projects' ? 700 : 500,
                  color: activeTab === 'projects' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Projects & PRD
              </button>
              <button
                onClick={() => onTabChange('tasks')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'tasks' ? 700 : 500,
                  color: activeTab === 'tasks' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Tasks
              </button>
              <button
                onClick={() => onTabChange('bugs')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'bugs' ? 700 : 500,
                  color: activeTab === 'bugs' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Bugs
              </button>
              <button
                onClick={() => onTabChange('test-cases')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'test-cases' ? 700 : 500,
                  color: activeTab === 'test-cases' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Test Cases
              </button>
              <button
                onClick={() => onTabChange('regression')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'regression' ? 700 : 500,
                  color: activeTab === 'regression' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Regression
              </button>
              <button
                onClick={() => onTabChange('blockers')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'blockers' ? 700 : 500,
                  color: activeTab === 'blockers' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Blockers
              </button>
              <button
                onClick={() => onTabChange('readiness')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'readiness' ? 700 : 500,
                  color: activeTab === 'readiness' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Release Readiness
              </button>
              <button
                onClick={() => onTabChange('reports')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'reports' ? 700 : 500,
                  color: activeTab === 'reports' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Reports
              </button>
              <button
                onClick={() => onTabChange('audit')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'audit' ? 700 : 500,
                  color: activeTab === 'audit' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Audit Log
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onTabChange('my-work')}
                className={`btn-secondary ${activeTab === 'my-work' ? 'active-tab' : ''}`}
                style={{
                  fontWeight: activeTab === 'my-work' ? 700 : 500,
                  color: activeTab === 'my-work' ? '#38bdf8' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'my-work' ? '2px solid #38bdf8' : 'none',
                }}
              >
                My Work
              </button>
              <button
                onClick={() => onTabChange('projects')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'projects' ? 700 : 500,
                  color: activeTab === 'projects' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                My Projects & PRD
              </button>
              <button
                onClick={() => onTabChange('tasks')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'tasks' ? 700 : 500,
                  color: activeTab === 'tasks' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                My Tasks
              </button>
              <button
                onClick={() => onTabChange('bugs')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'bugs' ? 700 : 500,
                  color: activeTab === 'bugs' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Bugs & Retest
              </button>
              <button
                onClick={() => onTabChange('test-cases')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'test-cases' ? 700 : 500,
                  color: activeTab === 'test-cases' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Test Execution
              </button>
              <button
                onClick={() => onTabChange('blockers')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'blockers' ? 700 : 500,
                  color: activeTab === 'blockers' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                My Blockers
              </button>
              <button
                onClick={() => onTabChange('daily-report')}
                className="btn-secondary"
                style={{
                  fontWeight: activeTab === 'daily-report' ? 700 : 500,
                  color: activeTab === 'daily-report' ? '#38bdf8' : 'var(--text-secondary)',
                }}
              >
                Daily Report
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Right Controls: Search, Daily Check-In, Notifications, Role Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="btn-secondary"
          title="Global Search (Projects, Tasks, Bugs, Tests)"
          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
        >
          <Search size={14} /> Search
        </button>

        {/* Daily QA Standup Check-in */}
        <button
          onClick={onOpenCheckIn}
          className="btn-primary"
          title="Open Daily QA Standup Check-In"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <MessageSquare size={14} /> Daily Check-In
        </button>

        {/* Notifications Center */}
        <button
          onClick={onOpenNotifications}
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
          }}
          title="Notifications Center"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#f43f5e',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 800,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-app)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Onboarding Wizard Launcher */}
        <button
          onClick={onOpenOnboarding}
          className="btn-secondary"
          title="Simulate First-Time QA Member Onboarding"
          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
        >
          <UserPlus size={14} />
          <span>Onboarding</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Reset Demo Data */}
        <button
          onClick={handleResetData}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
          title="Reset Demo Data to Initial Seed"
        >
          <RotateCcw size={14} />
        </button>

        {/* Role Switcher Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 8px 3px 3px',
              borderRadius: '24px',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-primary)',
            }}
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: isLead ? '2px solid #6366f1' : '2px solid #38bdf8',
              }}
            />
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{currentUser.name}</div>
              <div
                style={{
                  fontSize: '0.66rem',
                  color: isLead ? '#818cf8' : '#38bdf8',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {currentUser.role === 'qa_lead' ? 'QA Lead' : 'QA Member'}
              </div>
            </div>
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>

          {/* Switcher Dropdown */}
          {isUserDropdownOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                width: '250px',
                padding: '6px',
                zIndex: 200,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div
                style={{
                  padding: '6px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '4px',
                }}
              >
                Switch Role / Member (Demo)
              </div>
              {allUsers.map((user) => {
                const active = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: active ? 'var(--bg-card-hover)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={user.avatar}
                        alt={user.name}
                        style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {user.role === 'qa_lead' ? 'QA Lead' : 'QA Member'}
                        </div>
                      </div>
                    </div>
                    {active && <CheckCircle2 size={15} color="#38bdf8" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
