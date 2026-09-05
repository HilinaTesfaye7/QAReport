import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUserChange?: (user: User) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  onUserChange,
}) => {
  const users = StorageService.getUsers();

  const navItems = [
    { id: 'command-center', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'team', label: 'Team', icon: Users },
  ];

  return (
    <aside
      style={{
        width: collapsed ? '72px' : '240px',
        minWidth: collapsed ? '72px' : '240px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 50,
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: '64px',
          padding: collapsed ? '0 12px' : '0 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          onClick={() => onTabChange('command-center')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              flexShrink: 0,
            }}
          >
            <Shield size={18} />
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                QA Command Center
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Quality, at a glance</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Streamlined Navigation (Dashboard, Projects, Team) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: collapsed ? '16px 8px' : '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: collapsed ? '10px 0' : '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon size={19} color={isActive ? '#38bdf8' : 'currentColor'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Telegram Live Sync Status Pill */}
        {!collapsed && (
          <div
            style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Telegram Bot Live
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              Connected: <strong>Coco (tester)</strong> daily standups automatically synced
            </div>
          </div>
        )}
      </div>

      {/* Footer User Profile & Collapse Button */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: collapsed ? '12px 8px' : '14px 14px',
          background: 'rgba(0, 0, 0, 0.15)',
        }}
      >
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              title={`${currentUser.name} (${currentUser.role})`}
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid #38bdf8' }}
            />
            <button
              onClick={onToggleCollapse}
              title="Expand sidebar"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden' }}>
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid #38bdf8', flexShrink: 0 }}
              />
              <div style={{ overflow: 'hidden', lineHeight: 1.25 }}>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  {currentUser.role === 'qa_lead' ? 'QA Lead' : 'QA Engineer'}
                </div>
              </div>
            </div>

            {onUserChange && (
              <select
                aria-label="Switch Active QA User"
                value={currentUser.id}
                onChange={(e) => {
                  const u = users.find((x) => x.id === e.target.value);
                  if (u) onUserChange(u);
                }}
                style={{
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.68rem',
                  padding: '4px 6px',
                  cursor: 'pointer',
                }}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
