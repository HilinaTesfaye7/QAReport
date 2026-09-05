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
  TrendingUp,
  Plus,
  Filter,
  CheckCircle2,
  AlertOctagon,
  Clock,
  ArrowRight,
  ShieldAlert,
  Plane,
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
  const [workloads, setWorkloads] = useState<MemberWorkload[]>(WorkloadService.getAllMembersWorkload());
  const [tasks, setTasks] = useState<QATask[]>(StorageService.getTasks());
  const [bugs, setBugs] = useState<QABug[]>(StorageService.getBugs());
  const [testCases, setTestCases] = useState<TestCase[]>(TestCaseService.getTestCases());
  const [blockers, setBlockers] = useState<Blocker[]>(BlockerService.getBlockers());
  const [reports, setReports] = useState<DailyReport[]>(StorageService.getDailyReports());
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('Today');
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  const users = StorageService.getUsers();

  const reloadData = async () => {
    setProjects(StorageService.getProjects());
    setWorkloads(WorkloadService.getAllMembersWorkload());
    setTasks(StorageService.getTasks());
    setBugs(StorageService.getBugs());
    setTestCases(TestCaseService.getTestCases());
    setBlockers(BlockerService.getBlockers());
    const synced = await DailyReportService.syncTelegramReports();
    setReports(synced);
  };

  useEffect(() => {
    reloadData();
    const handleStorage = () => reloadData();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  // Compute metrics
  const activeProjectsCount = projects.filter((p) => p.status === 'Testing' || p.status === 'Active').length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'In Progress').length;
  const openBugsCount = bugs.filter((b) => b.status !== 'Closed').length;
  const highCriticalBugsCount = bugs.filter((b) => (b.severity === 'Critical' || b.severity === 'High') && b.status !== 'Closed').length;
  const blockedCount = tasks.filter((t) => t.status === 'Blocked').length + blockers.filter((b) => b.status !== 'Resolved').length;

  const metrics = TestCaseService.getMetrics();
  const passRate = metrics.passRate || 92.4;

  const criticalIssues = bugs.filter((b) => (b.severity === 'Critical' || b.severity === 'High') && b.status !== 'Closed').slice(0, 4);

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
            <span>TUESDAY, SEPTEMBER 5, 2026</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Good morning, {currentUser.name.split(' ')[0]}
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Here is your QA team's current status.
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
              <option value="all">All Active Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
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
              <option value="Sprint 24">Sprint 24</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Row 1: 6 KPI Metric Cards in a Row (Screenshot 1) */}
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
            {projects.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span>View all projects</span>
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
            <span>View team roster</span>
            <span>→</span>
          </div>
        </div>

        {/* Card 3: Tasks in Progress */}
        <div className="card" style={{ padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tasks in progress</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckSquare size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {inProgressTasksCount || 24}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>↗</span>
            <span>6 due this week</span>
          </div>
        </div>

        {/* Card 4: Open Bugs */}
        <div className="card" style={{ padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        <div className="card" style={{ padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            <span>4.2% vs last week</span>
          </div>
        </div>

        {/* Card 6: Blocked Work */}
        <div className="card" style={{ padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Blocked work</span>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              <Zap size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {blockedCount || 4}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#f43f5e' }}>
            2 need attention
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
                Current allocation across active projects
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { name: 'Sarah Jenkins', role: 'QA Lead', percent: 82, badge: 'High', color: '#f59e0b' },
              { name: 'Hana Kim', role: 'QA Engineer', percent: 68, badge: 'Balanced', color: '#38bdf8' },
              { name: 'Ahmed Al-Mansoor', role: 'QA Engineer', percent: 42, badge: 'Low', color: '#10b981' },
              { name: 'Daniel Brody', role: 'QA Engineer', percent: 96, badge: 'Overloaded', color: '#f43f5e' },
            ].map((member, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  {member.name.split(' ').map((n) => n[0]).join('')}
                </div>

                <div style={{ width: '120px', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{member.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{member.role}</div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${member.percent}%`,
                        background: member.color,
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>

                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>
                  {member.percent}%
                </span>

                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: `${member.color}20`,
                    color: member.color,
                    border: `1px solid ${member.color}40`,
                    width: '74px',
                    textAlign: 'center',
                  }}
                >
                  {member.badge}
                </span>
              </div>
            ))}
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
                Banking SuperApp
              </p>
            </div>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 800,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              Ready with risks
            </span>
          </div>

          {/* Donut Chart & Side Stats */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', flexWrap: 'wrap', gap: '16px' }}>
            {/* SVG Circular Gauge */}
            <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="10"
                  strokeDasharray="301.6"
                  strokeDashoffset="24.1" // 92% complete
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center', lineHeight: 1.15 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>92%</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>QA complete</div>
              </div>
            </div>

            {/* Side Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '160px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pass rate</span>
                <strong style={{ color: 'var(--text-primary)' }}>96%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Critical bugs</span>
                <strong style={{ color: '#10b981' }}>0</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Blockers</span>
                <strong style={{ color: '#f59e0b' }}>1</strong>
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
        {/* Left Card: Project Progress */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Project progress
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                Quality status across your portfolio
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
                <th style={{ padding: '8px 4px', textTransform: 'uppercase' }}>RELEASE</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Banking Super App', code: 'BSA-2026', color: '#2563eb', progress: 92, bugs: 8, testRate: 96, status: 'Ready with risks', statusColor: '#fbbf24' },
                { name: 'Cinema Platform', code: 'CIN-2026', color: '#9333ea', progress: 74, bugs: 14, testRate: 81, status: 'In testing', statusColor: '#38bdf8' },
                { name: 'Merchant Portal', code: 'MER-2026', color: '#f59e0b', progress: 58, bugs: 21, testRate: 67, status: 'At risk', statusColor: '#f43f5e' },
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: row.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                        {row.name[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{row.code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 4px', width: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ height: '4px', flex: 1, borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ height: '100%', width: `${row.progress}%`, background: '#2563eb', borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontWeight: 700 }}>{row.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 4px', fontWeight: 700, color: row.bugs > 15 ? '#f43f5e' : 'inherit' }}>
                    {row.bugs}
                  </td>
                  <td style={{ padding: '12px 4px', fontWeight: 700 }}>
                    {row.testRate}%
                  </td>
                  <td style={{ padding: '12px 4px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: `${row.statusColor}20`,
                        color: row.statusColor,
                        border: `1px solid ${row.statusColor}40`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '10px', fontSize: '0.76rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>3 of 3 projects</span>
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

        {/* Right Card: Team Activity Feed */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Team activity
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                Latest updates from your team
              </p>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>•••</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              {
                name: 'Coco',
                action: 'submitted daily standup',
                subtext: 'auth,hdhd,hsfbdf • Q1: 1,cool,good',
                tag: '✈️ Telegram',
                tagColor: '#38bdf8',
                time: '5 min ago',
                avatarBg: '#0284c7',
              },
              {
                name: 'Sarah Jenkins',
                action: 'completed regression testing',
                subtext: 'Banking SuperApp P0 suite',
                time: '12 min ago',
                avatarBg: '#2563eb',
              },
              {
                name: 'Hana Kim',
                action: 'reported BUG-142',
                subtext: 'Payment API timeout verification',
                time: '38 min ago',
                avatarBg: '#9333ea',
              },
              {
                name: 'Ahmed Al-Mansoor',
                action: 'completed 12 test cases',
                subtext: 'SuperApp biometrics regression',
                time: '1 hr ago',
                avatarBg: '#059669',
              },
              {
                name: 'Daniel Brody',
                action: 'submitted daily report',
                subtext: 'KYC validation complete',
                time: '2 hrs ago',
                avatarBg: '#d97706',
              },
            ].map((act, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: act.avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                  {act.name[0]}
                </div>
                <div style={{ flex: 1, lineHeight: 1.3 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <strong>{act.name}</strong> {act.action}{' '}
                    {act.tag && (
                      <span style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: act.tagColor, fontSize: '0.65rem', fontWeight: 800 }}>
                        {act.tag}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{act.time}</div>
                </div>
              </div>
            ))}
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

      {/* Full-Width Bottom Card: Critical Issues (Screenshots 2 & 3) */}
      <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Critical issues
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
              Issues that need your attention today
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
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
              <Filter size={13} />
              <span>Filter</span>
            </button>
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

        {/* Bug List Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            {
              severity: 'Critical',
              code: 'BUG-142',
              title: 'Payment fails after OTP verification',
              project: 'Banking Super App',
              assignee: 'John Carter',
              color: '#f43f5e',
            },
            {
              severity: 'High',
              code: 'BUG-138',
              title: 'Login crash on iOS 17.4',
              project: 'Cinema Platform',
              assignee: 'Helen Brooks',
              color: '#f59e0b',
            },
            {
              severity: 'High',
              code: 'BUG-121',
              title: 'Incorrect transaction amount on receipt',
              project: 'Banking Super App',
              assignee: 'Michael Chen',
              color: '#f59e0b',
            },
          ].map((issue, idx) => (
            <div
              key={idx}
              onClick={onNavigateToBugs}
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
                  <span>{issue.severity}</span>
                </span>
                <span style={{ fontWeight: 800, color: '#38bdf8' }}>{issue.code}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{issue.title}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{issue.project}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                    {issue.assignee[0]}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{issue.assignee}</span>
                </div>
                <ArrowUpRight size={14} color="var(--text-muted)" />
              </div>
            </div>
          ))}
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
