import React from 'react';
import {
  Users,
  FolderKanban,
  AlertTriangle,
  Target,
  Zap,
  CheckCircle2,
  ShieldAlert,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { User, Project, QATask, QABug, TestCase, Blocker, DailyReport, MemberWorkload } from '../types';

interface DirectorDashboardProps {
  currentUser: User;
  projects: Project[];
  users: User[];
  tasks: QATask[];
  bugs: QABug[];
  testCases: TestCase[];
  blockers: Blocker[];
  reports: DailyReport[];
  workloads: MemberWorkload[];
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToTeam?: () => void;
  onNavigateToBugs?: () => void;
  onNavigateToBlockers?: () => void;
  onNavigateToProjects?: () => void;
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({
  currentUser,
  projects,
  users,
  bugs,
  testCases,
  blockers,
  reports,
  workloads,
  onNavigateToProject,
  onNavigateToTeam,
  onNavigateToBlockers,
  onNavigateToProjects,
}) => {
  // A. Organization Overview KPIs
  const totalMembers = users.filter(u => u.role !== 'QA Director').length;
  const qaLeads = users.filter((u) => u.role === 'QA Lead').length;
  const qaTesters = users.filter((u) => u.role === 'QA Tester').length;
  const autoEngineers = users.filter((u) => u.role === 'Automation QA Engineer').length;

  const activeProjects = projects.filter((p) => p.status === 'Testing' || p.status === 'Active' || p.status === 'UAT');
  const blockedProjects = projects.filter((p) => blockers.some((b) => b.projectId === p.id && b.status !== 'Resolved')).length;

  const overallWorkload = workloads.length > 0
    ? Math.round(workloads.reduce((acc, w) => acc + w.score, 0) / workloads.length)
    : 0;

  const avgReadiness = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.qaProgress || 0), 0) / projects.length)
    : 0;

  // C. Release Readiness calculation
  const readinessCounts = { ready: 0, readyWithRisks: 0, atRisk: 0, notReady: 0 };
  const readinessList = projects.map((p) => {
    const projBlockers = blockers.filter((b) => b.projectId === p.id && b.status !== 'Resolved').length;
    const projCritBugs = bugs.filter((b) => b.projectId === p.id && (b.severity === 'Critical' || b.severity === 'High') && b.status !== 'Closed').length;
    
    let status = 'Not Ready';
    if (projBlockers === 0 && projCritBugs === 0 && (p.qaProgress || 0) >= 90) {
      status = 'Ready';
      readinessCounts.ready++;
    } else if (projBlockers === 0 && (p.qaProgress || 0) >= 75) {
      status = 'Ready with Risks';
      readinessCounts.readyWithRisks++;
    } else if (projBlockers > 0 || projCritBugs > 0) {
      status = 'At Risk';
      readinessCounts.atRisk++;
    } else {
      readinessCounts.notReady++;
    }
    
    return {
      ...p,
      readinessStatus: status,
      projBlockers,
      projCritBugs,
    };
  });

  // F. Critical Risks
  const rawIssues = [
    ...blockers.filter((b) => b.status !== 'Resolved').map((b) => ({ type: 'Blocker', item: b, severity: b.severity })),
    ...bugs.filter((b) => b.status !== 'Closed' && b.severity === 'Critical').map((b) => ({ type: 'Bug', item: b, severity: b.severity }))
  ];
  
  const uniqueIssuesMap = new Map();
  rawIssues.forEach(issue => {
    const key = `${issue.type}-${issue.item.id}`;
    if (!uniqueIssuesMap.has(key)) {
      uniqueIssuesMap.set(key, issue);
    }
  });

  const criticalIssues = Array.from(uniqueIssuesMap.values())
    .sort((a, b) => (a.severity === 'Critical' ? -1 : 1))
    .slice(0, 5);

  // G. QA Team Activity
  const today = new Date().toISOString().split('T')[0];
  const reportsToday = reports.filter((r) => r.date === today || r.submittedAt?.startsWith(today));
  const reporters = new Set(reportsToday.map((r) => r.memberId));
  const missingReports = users.filter((u) => (u.role === 'QA Tester' || u.role === 'Automation QA Engineer') && !reporters.has(u.id));

  // H. Automation Overview
  const autoTestCases = testCases.filter((tc) => tc.isAutomated);
  const autoPassed = autoTestCases.filter((tc) => tc.executionStatus === 'Passed').length;
  const autoFailed = autoTestCases.filter((tc) => tc.executionStatus === 'Failed').length;
  const autoCoverage = testCases.length > 0 ? Math.round((autoTestCases.length / testCases.length) * 100) : 0;
  const autoPassRate = autoTestCases.length > 0 ? Math.round((autoPassed / autoTestCases.length) * 100) : 0;

  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const cardStyle = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      {/* Top Banner */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '8px' }}>
          📅 {todayFormatted} • QA COMMAND CENTER
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          {greeting}, {currentUser.name.split(' ')[0]}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Organization-wide visibility across all QA operations.
        </p>
      </div>

      {/* A. Organization Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Total QA Members', value: totalMembers, icon: <Users size={20} color="#38bdf8" />, trend: `${qaLeads} Leads, ${qaTesters} Testers` },
          { label: 'Automation Engineers', value: autoEngineers, icon: <Zap size={20} color="#a855f7" />, trend: 'Dedicated Automation' },
          { label: 'Active Projects', value: activeProjects.length, icon: <FolderKanban size={20} color="#10b981" />, trend: `${blockedProjects} Blocked Projects` },
        ].map((stat, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{stat.label}</span>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>{stat.icon}</div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stat.trend}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* QA Team Workload */}
        <div style={cardStyle}>
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
              onClick={onNavigateToTeam}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
            {users.filter(u => u.role === 'QA Tester' || u.role === 'Automation QA Engineer' || u.role === 'QA Lead').map((user) => {
              const wl = workloads.find((w) => w.memberId === user.id) || { score: 0, classification: 'Balanced' };
              const badgeColor =
                wl.classification === 'Overloaded'
                  ? '#f43f5e'
                  : wl.classification === 'High'
                  ? '#f59e0b'
                  : wl.classification === 'Balanced'
                  ? '#38bdf8'
                  : '#10b981';
              const roleTitle = user.role;

              return (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
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
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {roleTitle} {user.telegramChatId ? '• ✈️' : ''}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    {isNaN(wl.score) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No workload data</div>
                    ) : (
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
                    )}
                  </div>

                  {!isNaN(wl.score) && (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', width: '32px', textAlign: 'right' }}>
                      {wl.score}%
                    </span>
                  )}

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

        {/* F. Critical Risks / Blockers */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#f43f5e" /> Critical QA Risks
            </h2>
            {onNavigateToBlockers && (
              <button onClick={onNavigateToBlockers} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem' }}>View All</button>
            )}
          </div>
          {criticalIssues.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No critical risks detected.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {criticalIssues.map((issue, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${issue.severity === 'Critical' ? '#f43f5e' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{issue.item.title}</span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: issue.severity === 'Critical' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)', color: issue.severity === 'Critical' ? '#f43f5e' : '#fbbf24' }}>
                      {issue.type} • {issue.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {projects.find(p => p.id === issue.item.projectId)?.name || 'Unknown Project'} • Owner: {users.find(u => u.id === (issue.type === 'Blocker' ? issue.item.memberId : issue.item.assigneeId))?.name || 'Unassigned'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* C. Project Portfolio */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderKanban size={18} color="#38bdf8" /> Project Portfolio
          </h2>
        </div>
        {projects.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No projects found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px' }}>Project</th>
                  <th style={{ padding: '12px 8px' }}>QA Lead</th>
                  <th style={{ padding: '12px 8px' }}>Status</th>
                  <th style={{ padding: '12px 8px' }}>Test Progress</th>
                  <th style={{ padding: '12px 8px' }}>Crit. Bugs</th>
                  <th style={{ padding: '12px 8px' }}>Blockers</th>
                  <th style={{ padding: '12px 8px' }}>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {readinessList.slice(0, 5).map((p) => {
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => onNavigateToProject?.(p.id)}>
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                      <td style={{ padding: '12px 8px' }}>{users.find(u => u.id === p.qaLeadId)?.name || 'Unassigned'}</td>
                      <td style={{ padding: '12px 8px' }}>{p.status}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                            <div style={{ width: `${p.qaProgress || 0}%`, height: '100%', background: '#38bdf8', borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem' }}>{p.qaProgress || 0}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: p.projCritBugs > 0 ? '#f43f5e' : 'inherit' }}>{p.projCritBugs}</td>
                      <td style={{ padding: '12px 8px', color: p.projBlockers > 0 ? '#f43f5e' : 'inherit' }}>{p.projBlockers}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                          background: p.readinessStatus === 'Ready' ? 'rgba(16,185,129,0.1)' : p.readinessStatus === 'Ready with Risks' ? 'rgba(245,158,11,0.1)' : p.readinessStatus === 'At Risk' ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)',
                          color: p.readinessStatus === 'Ready' ? '#10b981' : p.readinessStatus === 'Ready with Risks' ? '#fbbf24' : p.readinessStatus === 'At Risk' ? '#fbbf24' : '#f43f5e'
                        }}>
                          {p.readinessStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {readinessList.length > 5 && (
              <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  onClick={onNavigateToProjects}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  View more details <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* G. Team Activity */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#38bdf8" /> Daily Reporting Compliance
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{reporters.size}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Submitted Today</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: missingReports.length > 0 ? '#f43f5e' : '#10b981' }}>{missingReports.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Missing</div>
            </div>
          </div>
          {missingReports.length > 0 && (
            <div style={{ background: 'rgba(244,63,94,0.05)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f43f5e', marginBottom: '8px', textTransform: 'uppercase' }}>Teams Missing Updates</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {missingReports.map(u => (
                  <span key={u.id} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)' }}>
                    {u.name} ({u.role})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* H. Automation Overview */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#a855f7" /> Automation Overview
          </h2>
          {testCases.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No automation data available.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Coverage</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>{autoCoverage}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pass Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: autoPassRate >= 95 ? '#10b981' : '#f59e0b' }}>{autoPassRate}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Failed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: autoFailed > 0 ? '#f43f5e' : '#10b981' }}>{autoFailed}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {autoTestCases.length} automated tests out of {testCases.length} total test cases.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
