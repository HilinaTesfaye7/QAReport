import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  ArrowRight,
  Users,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Send,
  Sparkles,
} from 'lucide-react';
import { Project, User, DailyReport } from '../types';
import { StorageService } from '../services/storage';
import { DailyReportService } from '../services/dailyReportService';

interface AuthorizedProjectsTableProps {
  currentUser: User;
  onNavigateToProject: (projectId: string) => void;
  onOpenCreateProject?: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthorizedProjectsTable: React.FC<AuthorizedProjectsTableProps> = ({
  currentUser,
  onNavigateToProject,
  onOpenCreateProject,
  title = 'Authorized Projects',
  subtitle = 'Projects you have explicit authorization and role membership in',
}) => {
  const [projects, setProjects] = useState<Project[]>(StorageService.getProjects());
  const [reports, setReports] = useState<DailyReport[]>(StorageService.getDailyReports());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const users = StorageService.getUsers();

  const loadData = async () => {
    const cloudProjects = await StorageService.syncProjectsWithDisk();
    setProjects(cloudProjects);
    const synced = await DailyReportService.syncTelegramReports();
    setReports(synced);
    setLastSyncTime(new Date());
  };

  useEffect(() => {
    loadData();

    // Poll for live Telegram reports every 8 seconds
    const interval = setInterval(() => {
      loadData();
    }, 8000);

    const handleStorage = () => loadData();
    window.addEventListener('aegis_storage_change', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('aegis_storage_change', handleStorage);
    };
  }, []);

  // Filter projects by status and search
  const filteredProjects = projects.filter((project) => {
    // Status filter
    if (statusFilter === 'ACTIVE') {
      if (project.status !== 'Active' && project.status !== 'Testing') return false;
    } else if (statusFilter === 'PLANNING') {
      if (project.status !== 'Planning') return false;
    } else if (statusFilter === 'COMPLETED') {
      if (project.status !== 'Ready for Release' && project.status !== 'UAT') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = project.name.toLowerCase().includes(q);
      const matchDesc = project.description?.toLowerCase().includes(q);
      const matchOwner = project.projectOwner?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchOwner) return false;
    }

    return true;
  });

  // Get user role for this project
  const getUserRoleForProject = (project: Project): string => {
    if (project.qaLeadId === currentUser.id) return 'QA LEAD';
    if (project.memberIds.includes(currentUser.id)) {
      return currentUser.role === 'qa_engineer' ? 'QA ENGINEER' : 'TESTER';
    }
    return currentUser.role === 'qa_lead' ? 'QA LEAD' : 'PROJECT MANAGER';
  };

  // Get latest daily standup for a project (merged in-app + Telegram)
  const getLatestProjectStandup = (projectId: string): DailyReport | undefined => {
    const projectReports = reports.filter(
      (r) => r.projectId === projectId || r.projectName?.toLowerCase() === projects.find((p) => p.id === projectId)?.name.toLowerCase()
    );
    if (!projectReports || projectReports.length === 0) return undefined;

    // Sort by submittedAt descending
    return [...projectReports].sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    })[0];
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        padding: '24px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header with Title and + New Project Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            {subtitle}
          </p>
        </div>

        {onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>+ New Project</span>
          </button>
        )}
      </div>

      {/* Control Bar: Filter Pills on Left, Search & View Switcher on Right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px' }}>
          {(['ALL', 'ACTIVE', 'PLANNING', 'COMPLETED'] as const).map((filter) => {
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Right Controls: Search & Table/Grid View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              style={{
                width: '100%',
                paddingLeft: '32px',
                paddingRight: '12px',
                paddingTop: '7px',
                paddingBottom: '7px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Table / Grid Toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-app)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '6px',
                background: viewMode === 'table' ? '#2563eb' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '6px',
                background: viewMode === 'grid' ? '#2563eb' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredProjects.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No projects found matching the criteria.
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Pixel-perfect matching user's reference) */
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
            <thead>
              <tr
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Project
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Your Role
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Velocity / QA
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Members
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Latest Daily Standup / Update
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const roleName = getUserRoleForProject(project);
                const standup = getLatestProjectStandup(project.id);
                const memberCount = project.memberIds.length + 1; // including QA lead

                return (
                  <tr
                    key={project.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Project Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {project.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Target: {project.targetReleaseDate || '2026-11-30'}
                      </div>
                    </td>

                    {/* Status Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background:
                            project.status === 'Testing' || project.status === 'Active'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : project.status === 'Planning'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(56, 189, 248, 0.15)',
                          color:
                            project.status === 'Testing' || project.status === 'Active'
                              ? '#34d399'
                              : project.status === 'Planning'
                              ? '#fbbf24'
                              : '#38bdf8',
                          border:
                            project.status === 'Testing' || project.status === 'Active'
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : project.status === 'Planning'
                              ? '1px solid rgba(245, 158, 11, 0.3)'
                              : '1px solid rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        {project.status === 'Testing' ? 'ACTIVE' : project.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Your Role Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        {roleName}
                      </span>
                    </td>

                    {/* Velocity / QA Progress Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', minWidth: '160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Delivery Progress</span>
                        <strong style={{ color: '#38bdf8' }}>{project.qaProgress}%</strong>
                      </div>
                      <div style={{ height: '6px', width: '100%', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${project.qaProgress}%`,
                            background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </td>

                    {/* Members Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Users size={14} color="#38bdf8" />
                        <span>{memberCount}</span>
                      </div>
                    </td>

                    {/* Latest Daily Standup / Update Column (Live Telegram & In-App integration) */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', minWidth: '320px', maxWidth: '420px' }}>
                      {standup ? (
                        <div
                          style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '0.78rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {/* Standup Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 800, color: '#38bdf8' }}>
                              {standup.memberName || 'QA Member'}{' '}
                              <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                ({standup.role ? standup.role.replace(/_/g, ' ') : 'QA_ENGINEER'})
                              </span>
                            </div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: standup.source === 'telegram' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                color: standup.source === 'telegram' ? '#38bdf8' : '#a5b4fc',
                                border: standup.source === 'telegram' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                              }}
                            >
                              {standup.source === 'telegram' ? '✈️ Telegram' : '📋 In-App'}
                            </span>
                          </div>

                          {/* Standup Tasks Q1/Q2 */}
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Q1:</strong> {standup.yesterdayCompleted || standup.todayWorkingOn}
                          </div>

                          {/* Blockers Flag */}
                          {standup.isBlocked ? (
                            <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} />
                              <span>Blocker: {standup.blockers || 'Reported'}</span>
                            </div>
                          ) : (
                            <div style={{ color: '#34d399', fontWeight: 600, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>🟢</span>
                              <span>Blockers: None</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          No standup recorded today
                        </div>
                      )}
                    </td>

                    {/* Action Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <button
                        onClick={() => onNavigateToProject(project.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                          e.currentTarget.style.borderColor = '#38bdf8';
                          e.currentTarget.style.color = '#38bdf8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                      >
                        <span>Open</span>
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW (Compact modernized cards with the latest standup embed) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredProjects.map((project) => {
            const roleName = getUserRoleForProject(project);
            const standup = getLatestProjectStandup(project.id);

            return (
              <div
                key={project.id}
                style={{
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => onNavigateToProject(project.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {project.name}
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Target: {project.targetReleaseDate}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {project.status.toUpperCase()}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Delivery Progress</span>
                    <strong style={{ color: '#38bdf8' }}>{project.qaProgress}%</strong>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${project.qaProgress}%`,
                        background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>

                {/* Standup Box in Grid */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {standup ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                          {standup.memberName} ({standup.role})
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#38bdf8' }}>
                          {standup.source === 'telegram' ? '✈️ Telegram' : '📋 In-App'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Q1: {standup.yesterdayCompleted || standup.todayWorkingOn}
                      </div>
                      <div style={{ marginTop: '2px', color: standup.isBlocked ? '#f87171' : '#34d399', fontWeight: 600 }}>
                        {standup.isBlocked ? `⚠️ Blocker: ${standup.blockers}` : '🟢 Blockers: None'}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      No standup recorded today
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#a5b4fc',
                    }}
                  >
                    {roleName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                    <span>Open</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
