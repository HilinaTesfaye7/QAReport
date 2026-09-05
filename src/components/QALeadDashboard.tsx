import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Users,
  CheckSquare,
  AlertTriangle,
  Target,
  Zap,
  ChevronDown,
  ArrowUpRight,
  Plus,
  Filter,
  CheckCircle2,
  AlertOctagon,
  Clock,
  ShieldAlert,
  MessageSquare,
} from 'lucide-react';
import { User, Project, MemberWorkload, QATask, QABug, TestCase, Blocker, DailyReport } from '../types';
import { StorageService } from '../services/storage';
import { WorkloadService } from '../services/workloadService';
import { TestCaseService } from '../services/testCaseService';
import { DailyReportService } from '../services/dailyReportService';
import { BlockerService } from '../services/blockerService';
import { WorkloadAssignmentModal } from './WorkloadAssignmentModal';

interface QALeadDashboardProps {
  currentUser: User;
  onNavigateToProject: (projectId: string) => void;
  onNavigateToTasks: () => void;
  onNavigateToBugs: () => void;
  onNavigateToRegression?: () => void;
  onNavigateToBlockers?: () => void;
  onNavigateToReadiness?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToTeam?: () => void;
}

export const QALeadDashboard: React.FC<QALeadDashboardProps> = ({
  currentUser,
  onNavigateToProject,
  onNavigateToTasks,
  onNavigateToBugs,
  onNavigateToRegression,
  onNavigateToBlockers,
  onNavigateToReadiness,
  onNavigateToReports,
  onNavigateToTeam,
}) => {
  const [projects, setProjects] = useState<Project[]>(StorageService.getProjects());
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());
  const [workloads, setWorkloads] = useState<MemberWorkload[]>(WorkloadService.getAllMembersWorkload());
  const [tasks, setTasks] = useState<QATask[]>(StorageService.getTasks());
  const [bugs, setBugs] = useState<QABug[]>(StorageService.getBugs());
  const [testCases, setTestCases] = useState<TestCase[]>(TestCaseService.getTestCases());
  const [blockers, setBlockers] = useState<Blocker[]>(BlockerService.getBlockers());
  const [reports, setReports] = useState<DailyReport[]>(StorageService.getDailyReports());
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('Today');
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  const reloadData = async () => {
    try {
      const [syncedProjects, syncedUsers, syncedBlockers, syncedReports] = await Promise.all([
        StorageService.syncProjectsWithDisk(),
        StorageService.syncUsersWithCloud(),
        StorageService.syncBlockersWithCloud(),
        DailyReportService.syncTelegramReports(),
      ]);
      setProjects(syncedProjects);
      setUsers(syncedUsers);
      setBlockers(syncedBlockers);
      setReports(syncedReports);
    } catch (e) {
      console.warn('Dashboard sync error:', e);
    }
    setTasks(StorageService.getTasks());
    setBugs(StorageService.getBugs());
    setTestCases(TestCaseService.getTestCases());
    setWorkloads(WorkloadService.getAllMembersWorkload());
  };

  useEffect(() => {
    reloadData();
    const handleStorage = () => reloadData();
    window.addEventListener('aegis_storage_change', handleStorage);
    // Poll every 5 seconds to ensure real-time reflection of Telegram check-ins and blockers
    const pollInterval = setInterval(() => {
      reloadData();
    }, 5000);
    return () => {
      window.removeEventListener('aegis_storage_change', handleStorage);
      clearInterval(pollInterval);
    };
  }, []);

  // Dynamic Date and Greeting
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  // Metrics computation based on filters
  const activeProjects = projects.filter((p) => p.status === 'Testing' || p.status === 'Active' || p.status === 'UAT');
  const activeProjectsCount = activeProjects.length;

  const filteredTasks = tasks.filter((t) => selectedProjectFilter === 'all' || t.projectId === selectedProjectFilter);
  const inProgressTasksCount = filteredTasks.filter((t) => t.status === 'In Progress').length;
  const blockedTasksCount = filteredTasks.filter((t) => t.status === 'Blocked').length;

  const filteredBugs = bugs.filter((b) => selectedProjectFilter === 'all' || b.projectId === selectedProjectFilter);
  const openBugsCount = filteredBugs.filter((b) => b.status !== 'Closed').length;
  const highCriticalBugsCount = filteredBugs.filter(
    (b) => (b.severity === 'Critical' || b.severity === 'High') && b.status !== 'Closed'
  ).length;

  const filteredBlockers = blockers.filter((b) => selectedProjectFilter === 'all' || b.projectId === selectedProjectFilter);
  const openBlockers = filteredBlockers.filter((b) => b.status !== 'Resolved');
  const totalBlockedCount = blockedTasksCount + openBlockers.length;

  const filteredTestCases = testCases.filter((tc) => selectedProjectFilter === 'all' || tc.projectId === selectedProjectFilter);
  const passedTestsCount = filteredTestCases.filter((tc) => tc.executionStatus === 'Passed').length;
  const metrics = TestCaseService.getMetrics();
  const passRate = filteredTestCases.length > 0
    ? Math.round((passedTestsCount / filteredTestCases.length) * 1000) / 10
    : (metrics.passRate || 96.4);

  // Determine Primary Project for Release Readiness Donut Gauge
  const primaryProject = (selectedProjectFilter !== 'all'
    ? projects.find((p) => p.id === selectedProjectFilter)
    : projects[0]) || { id: 'prj-banking', name: 'Banking SuperApp', qaProgress: 74, status: 'Testing' as const };

  const projProgress = primaryProject.qaProgress || 0;
  const projCritBugs = bugs.filter(
    (b) => (selectedProjectFilter === 'all' || b.projectId === primaryProject.id) &&
      (b.severity === 'Critical' || b.severity === 'High') &&
      b.status !== 'Closed'
  ).length;
  const projBlockers = blockers.filter(
    (b) => (selectedProjectFilter === 'all' || b.projectId === primaryProject.id) && b.status !== 'Resolved'
  ).length;

  let readinessStatus = 'Ready to release';
  let readinessColor = '#10b981';
  let readinessBg = 'rgba(16, 185, 129, 0.15)';
  if (projCritBugs > 0 || projBlockers > 0) {
    readinessStatus = 'Ready with risks';
    readinessColor = '#fbbf24';
    readinessBg = 'rgba(245, 158, 11, 0.15)';
  } else if (projProgress < 60) {
    readinessStatus = 'In testing';
    readinessColor = '#38bdf8';
    readinessBg = 'rgba(56, 189, 248, 0.15)';
  }

  // SVG Gauge calculations
  const gaugeRadius = 48;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius; // ~301.6
  const gaugeOffset = gaugeCircumference - (gaugeCircumference * Math.min(100, Math.max(0, projProgress))) / 100;

  // Project Progress Table Data
  const displayedProjects = selectedProjectFilter === 'all'
    ? projects.slice(0, 6)
    : projects.filter((p) => p.id === selectedProjectFilter);

  // Relative Time Formatter
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'recently';
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  // Team Activity Feed combining live standups and reported blockers
  const recentActivities = [
    ...reports.map((r) => ({
      id: `rep-${r.id}`,
      name: r.memberName || 'QA Engineer',
      action: 'submitted daily standup',
      subtext: `${r.projectName} • ${r.todayWorkingOn || r.yesterdayCompleted || 'Standup completed'}`,
      tag: r.source === 'telegram' || r.chatId ? '✈️ Telegram' : 'Standup',
      tagColor: '#38bdf8',
      timestamp: r.submittedAt,
      avatarBg: '#0284c7',
    })),
    ...blockers.map((b) => ({
      id: `blk-${b.id}`,
      name: b.reportedBy || 'QA Member',
      action: 'reported blocker',
      subtext: `${b.projectName ? b.projectName + ' • ' : ''}${b.title}: ${b.description}`,
      tag: '⚠️ Blocker',
      tagColor: '#f43f5e',
      timestamp: b.createdAt,
      avatarBg: '#e11d48',
    })),
  ]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 5);

  // Critical Issues combining live Open Blockers and High/Critical Open Bugs
  const criticalItems = [
    ...openBlockers.map((b) => ({
      id: b.id,
      severity: b.severity || 'High',
      code: b.id,
      title: `${b.title} • ${b.description}`,
      project: b.projectName || 'Active Project',
      assignee: b.reportedBy || 'QA Member',
      color: '#f43f5e',
      isBlocker: true,
      onClick: onNavigateToBlockers || onNavigateToBugs,
    })),
    ...bugs
      .filter((b) => (b.severity === 'Critical' || b.severity === 'High') && b.status !== 'Closed')
      .map((b) => ({
        id: b.id,
        severity: b.severity,
        code: b.id,
        title: b.title,
        project: projects.find((p) => p.id === b.projectId)?.name || b.projectId,
        assignee: users.find((u) => u.id === b.assigneeId)?.name || 'Unassigned',
        color: b.severity === 'Critical' ? '#f43f5e' : '#f59e0b',
        isBlocker: false,
        onClick: onNavigateToBugs,
      })),
  ].slice(0, 5);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      {/* Top Banner (Screenshot 1) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#38bdf8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            <span>📅</span>
            <span>{todayFormatted}</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {greeting}, {currentUser.name.split(' ')[0]}
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Live QA status across cloud database, active projects, and Telegram standups.
          </p>
        </div>

        {/* Filter Controls (Project & Date dropdowns) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Project filter dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              style={{
                padding: '8px 32px 8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="all">All Active Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          {/* Time filter dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              style={{
                padding: '8px 30px 8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="Current Sprint">Current Sprint</option>
            </select>
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-muted)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Row 1: 6 Live KPI Metric Cards in a Row (Screenshot 1) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Active Projects */}
        <div
          className="card"
          onClick={() => onNavigateToProject('')}
          title="Click to view Authorized Projects"
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active projects</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <FolderKanban size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {activeProjectsCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span>{projects.length} total projects</span>
            <span>→</span>
          </div>
        </div>

        {/* Card 2: QA Members */}
        <div
          className="card"
          onClick={onNavigateToTeam}
          title="Click to view QA Team"
          style={{ cursor: onNavigateToTeam ? 'pointer' : 'default', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>QA members</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {users.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span>{users.filter((u) => u.role === 'qa_engineer' || (u.role as string) === 'tester').length} active engineers</span>
            <span>→</span>
          </div>
        </div>

        {/* Card 3: Tasks in Progress */}
        <div
          className="card"
          onClick={onNavigateToTasks}
          title="Click to view Tasks"
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tasks in progress</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckSquare size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {inProgressTasksCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↗</span>
            <span>{tasks.filter((t) => t.status === 'In Progress').length} tasks under test</span>
          </div>
        </div>

        {/* Card 4: Open Bugs */}
        <div
          className="card"
          onClick={onNavigateToBugs}
          title="Click to view Bugs"
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Open bugs</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {openBugsCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>⚠️</span>
            <span>{highCriticalBugsCount} high priority</span>
          </div>
        </div>

        {/* Card 5: Test Pass Rate */}
        <div
          className="card"
          onClick={onNavigateToRegression}
          title="Click to view Test Execution"
          style={{ cursor: onNavigateToRegression ? 'pointer' : 'default', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Test pass rate</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <Target size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {passRate}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↗</span>
            <span>{passedTestsCount} of {filteredTestCases.length || testCases.length} tests passed</span>
          </div>
        </div>

        {/* Card 6: Blocked Work */}
        <div
          className="card"
          onClick={onNavigateToBlockers}
          title="Click to view Blockers"
          style={{ cursor: onNavigateToBlockers ? 'pointer' : 'default', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Blocked work</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              <Zap size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: totalBlockedCount > 0 ? '#f43f5e' : 'var(--text-primary)', lineHeight: 1 }}>
            {totalBlockedCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: totalBlockedCount > 0 ? '#f43f5e' : 'var(--text-muted)' }}>
            {openBlockers.length} active blocker{openBlockers.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Row 2: QA Team Workload & Release Readiness Donut Gauge (Screenshot 1) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Left Card: QA Team Workload */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                QA team workload
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                Live allocation across {users.length} active members
              </p>
            </div>
            <button
              onClick={onNavigateToTeam || (() => setIsAssignmentModalOpen(true))}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span>Manage QA team</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Member Workload Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
            {users.map((user) => {
              const wl = workloads.find((w) => w.memberId === user.id) || WorkloadService.computeMemberWorkload(user.id);
              const badgeColor =
                wl.classification === 'Overloaded'
                  ? '#f43f5e'
                  : wl.classification === 'High'
                  ? '#f59e0b'
                  : wl.classification === 'Balanced'
                  ? '#38bdf8'
                  : '#10b981';
              const roleTitle = user.role === 'qa_lead' ? 'QA Lead' : (user.role as string) === 'tester' ? 'QA Tester' : 'QA Engineer';

              return (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      color: '#38bdf8',
                      flexShrink: 0,
                    }}
                  >
                    {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div style={{ width: '130px', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {roleTitle} {user.telegramChatId ? '• ✈️' : ''}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(5, wl.score))}%`,
                          background: badgeColor,
                          borderRadius: '3px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>
                    {wl.score}%
                  </span>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: `${badgeColor}20`,
                      color: badgeColor,
                      border: `1px solid ${badgeColor}40`,
                      width: '76px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {wl.classification}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Release Readiness with Donut Gauge (Screenshot 1) */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Release readiness
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                {primaryProject.name}
              </p>
            </div>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 800,
                background: readinessBg,
                color: readinessColor,
                border: `1px solid ${readinessColor}40`,
              }}
            >
              {readinessStatus}
            </span>
          </div>

          {/* Donut Chart & Side Stats */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', flexWrap: 'wrap', gap: '16px' }}>
            {/* SVG Circular Gauge */}
            <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r={gaugeRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r={gaugeRadius}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="10"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center', lineHeight: 1.15 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{projProgress}%</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>QA complete</div>
              </div>
            </div>

            {/* Side Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '160px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pass rate</span>
                <strong style={{ color: 'var(--text-primary)' }}>{passRate}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Critical bugs</span>
                <strong style={{ color: projCritBugs > 0 ? '#f43f5e' : '#10b981' }}>{projCritBugs}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Blockers</span>
                <strong style={{ color: projBlockers > 0 ? '#f59e0b' : '#10b981' }}>{projBlockers}</strong>
              </div>
            </div>
          </div>

          {/* Footer Link */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '10px', textAlign: 'center' }}>
            <button
              onClick={onNavigateToReadiness}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span>Open release report</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Project Progress Table & Team Activity Feed (Screenshots 2 & 3) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Left Card: Project Progress Table */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Project progress
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                Quality status across active projects
              </p>
            </div>
            <button
              onClick={() => onNavigateToProject(projects[0]?.id || '')}
              style={{
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-subtle)',
                color: '#38bdf8',
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="View all projects"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.7rem' }}>
                <th style={{ padding: '8px 4px', textTransform: 'uppercase' }}>PROJECT</th>
                <th style={{ padding: '8px 4px', textTransform: 'uppercase' }}>QA PROGRESS</th>
                <th style={{ padding: '8px 4px', textTransform: 'uppercase' }}>BUGS</th>
                <th style={{ padding: '8px 4px', textTransform: 'uppercase' }}>TESTING</th>
                <th style={{ padding: '8px 4px', textTransform: 'uppercase' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayedProjects.map((p) => {
                const pBugs = bugs.filter((b) => b.projectId === p.id && b.status !== 'Closed').length;
                const pCritBugs = bugs.filter((b) => b.projectId === p.id && (b.severity === 'Critical' || b.severity === 'High') && b.status !== 'Closed').length;
                const pBlockers = blockers.filter((b) => b.projectId === p.id && b.status !== 'Resolved').length;
                const pTests = testCases.filter((tc) => tc.projectId === p.id);
                const pPassRate = pTests.length > 0
                  ? Math.round((pTests.filter((t) => t.executionStatus === 'Passed').length / pTests.length) * 100)
                  : 100;

                let statusText: string = p.status;
                let statusColor = '#38bdf8';
                if (pCritBugs > 0 || pBlockers > 0) {
                  statusText = 'At risk';
                  statusColor = '#f43f5e';
                } else if (p.qaProgress >= 80) {
                  statusText = 'Ready';
                  statusColor = '#10b981';
                }

                const code = (p.name.split(' ').map((w) => w[0]).join('').slice(0, 4) || 'PRJ').toUpperCase() + '-2026';

                return (
                  <tr
                    key={p.id}
                    onClick={() => onNavigateToProject(p.id)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>
                          {p.name[0]?.toUpperCase() || 'P'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 4px', width: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ height: '4px', flex: 1, borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                          <div style={{ height: '100%', width: `${p.qaProgress || 0}%`, background: '#2563eb', borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{p.qaProgress || 0}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 4px', fontWeight: 700, color: pBugs > 5 ? '#f43f5e' : 'inherit' }}>
                      {pBugs}
                    </td>
                    <td style={{ padding: '12px 4px', fontWeight: 700 }}>
                      {pPassRate}%
                    </td>
                    <td style={{ padding: '12px 4px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          background: `${statusColor}20`,
                          color: statusColor,
                          border: `1px solid ${statusColor}40`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '10px', fontSize: '0.76rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{displayedProjects.length} of {projects.length} projects</span>
            <button
              onClick={() => onNavigateToProject(projects[0]?.id || '')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
              }}
            >
              <span>View all projects</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>

        {/* Right Card: Live Team Activity Feed */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Team activity
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                Live Telegram standups & blocker updates
              </p>
            </div>
            <button
              onClick={reloadData}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              title="Refresh activity"
            >
              <Clock size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {recentActivities.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No standup activity recorded yet.
              </div>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: act.avatarBg,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {act.name[0]?.toUpperCase() || 'Q'}
                  </div>
                  <div style={{ flex: 1, lineHeight: 1.3 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      <strong>{act.name}</strong> {act.action}{' '}
                      {act.tag && (
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: `${act.tagColor}20`,
                            color: act.tagColor,
                            fontSize: '0.65rem',
                            fontWeight: 800,
                          }}
                        >
                          {act.tag}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }}>
                      {act.subtext}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatRelativeTime(act.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '14px', textAlign: 'center' }}>
            <button
              onClick={onNavigateToTeam || onNavigateToReports}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span>View full team standups & roster</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-Width Bottom Card: Critical Issues & Blockers (Screenshots 2 & 3) */}
      <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Critical issues & blockers
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
              Live blockers and critical bugs needing attention
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {onNavigateToBlockers && (
              <button
                onClick={onNavigateToBlockers}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <ShieldAlert size={13} />
                <span>View blockers ({openBlockers.length})</span>
              </button>
            )}
            <button
              onClick={onNavigateToBugs}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              <Plus size={14} />
              <span>Report bug</span>
            </button>
          </div>
        </div>

        {/* List Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {criticalItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
              <CheckCircle2 size={24} color="#10b981" style={{ marginBottom: '6px' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                All systems operational!
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                No active blockers or critical defects open today.
              </div>
            </div>
          ) : (
            criticalItems.map((issue) => (
              <div
                key={issue.id}
                onClick={issue.onClick}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: `${issue.color}20`,
                      color: issue.color,
                      border: `1px solid ${issue.color}40`,
                    }}
                  >
                    <AlertTriangle size={11} />
                    <span>{issue.isBlocker ? 'Blocker' : issue.severity}</span>
                  </span>
                  <span style={{ fontWeight: 800, color: '#38bdf8' }}>{issue.code}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{issue.title}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{issue.project}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#2563eb',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                      }}
                    >
                      {issue.assignee[0]?.toUpperCase() || 'U'}
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{issue.assignee}</span>
                  </div>
                  <ArrowUpRight size={14} color="var(--text-muted)" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Workload Assignment Modal */}
      <WorkloadAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        leadId={currentUser.id}
        onTaskAssigned={reloadData}
      />
    </div>
  );
};
