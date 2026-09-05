import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  PlayCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Bug,
  ListTodo,
  AlertOctagon,
  Calendar,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { User, QATask, QABug, TestCase, Project, Blocker } from '../types';
import { StorageService } from '../services/storage';
import { WorkloadService } from '../services/workloadService';
import { TaskService } from '../services/taskService';
import { BugService } from '../services/bugService';
import { TestCaseService } from '../services/testCaseService';
import { BlockerService } from '../services/blockerService';

interface QAMemberDashboardProps {
  currentUser: User;
  onOpenCheckIn: () => void;
  onNavigateToProject: (projectId: string) => void;
  onNavigateToTasks: () => void;
  onNavigateToBugs: () => void;
  onNavigateToTestExecution: () => void;
  onNavigateToBlockers?: () => void;
}

export const QAMemberDashboard: React.FC<QAMemberDashboardProps> = ({
  currentUser,
  onOpenCheckIn,
  onNavigateToProject,
  onNavigateToTasks,
  onNavigateToBugs,
  onNavigateToTestExecution,
  onNavigateToBlockers,
}) => {
  const [tasks, setTasks] = useState<QATask[]>([]);
  const [bugs, setBugs] = useState<QABug[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [myBlockers, setMyBlockers] = useState<Blocker[]>([]);
  const [workload, setWorkload] = useState(WorkloadService.computeMemberWorkload(currentUser.id));

  const reloadData = () => {
    setTasks(TaskService.getTasksByAssignee(currentUser.id));
    setBugs(BugService.getBugsByAssignee(currentUser.id));
    setTestCases(TestCaseService.getTestCases().filter((tc) => tc.assigneeId === currentUser.id));
    setProjects(
      StorageService.getProjects().filter((p) =>
        currentUser.projectAllocations.some((a) => a.projectId === p.id)
      )
    );
    setMyBlockers(BlockerService.getBlockersByMember(currentUser.id));
    setWorkload(WorkloadService.computeMemberWorkload(currentUser.id));
  };

  useEffect(() => {
    reloadData();
    const handleStorage = () => reloadData();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, [currentUser]);

  const activeTasks = tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled');
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');
  const overdueTasks = activeTasks.filter((t) => t.dueDate < '2026-09-05');
  const dueTodayTasks = activeTasks.filter((t) => t.dueDate === '2026-09-05');
  const upcomingDeadlines = activeTasks.filter((t) => t.dueDate > '2026-09-05');
  const retestBugs = bugs.filter((b) => b.status === 'Retest');
  const activeBlockers = myBlockers.filter((b) => b.status !== 'Resolved');

  const handleToggleTaskStatus = (taskId: string, currentStatus: QATask['status']) => {
    const nextStatus = currentStatus === 'In Progress' ? 'Completed' : 'In Progress';
    TaskService.updateTaskStatus(taskId, nextStatus, currentUser.id);
    reloadData();
  };

  const handleVerifyBug = (bugId: string) => {
    BugService.updateBugStatus(bugId, 'Closed', currentUser.id);
    reloadData();
  };

  const availableCapacity = 100 - workload.score;

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px' }}>
      {/* Top Banner: Personalized Member Focus */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>👋</span>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Welcome back, {currentUser.name}!</h1>
            <span className="badge badge-normal">QA Member</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Your personalized QA workspace: today's tasks, test execution queue, assigned bugs, and daily standup.
          </p>
        </div>

        <button onClick={onOpenCheckIn} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <MessageSquare size={16} />
          <span>Daily QA Standup Check-In</span>
        </button>
      </div>

      {/* Overview Metric Cards (Prompt Section 7) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div className="card">
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>ASSIGNED TASKS</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '4px' }}>{tasks.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{activeTasks.length} active remaining</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>IN PROGRESS</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '4px', color: '#38bdf8' }}>{inProgressTasks.length}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Under test</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>COMPLETED TASKS</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '4px', color: '#10b981' }}>{completedTasks.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#10b981' }}>Verified and closed</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>OVERDUE WORK</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '4px', color: overdueTasks.length > 0 ? '#f43f5e' : 'var(--text-secondary)' }}>
            {overdueTasks.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: overdueTasks.length > 0 ? '#f43f5e' : 'var(--text-muted)' }}>
            {overdueTasks.length > 0 ? 'Requires update' : 'On schedule'}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTIVE BLOCKERS</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '4px', color: activeBlockers.length > 0 ? '#f43f5e' : 'var(--text-secondary)' }}>
            {activeBlockers.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: activeBlockers.length > 0 ? '#f43f5e' : '#10b981' }}>
            {activeBlockers.length > 0 ? 'Blocking your testing' : 'All clear'}
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Today's Tasks, Bugs Ready for Retest, and Blockers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section: Today's Tasks */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListTodo size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Today's Assigned Tasks</h3>
                <span className="badge badge-normal">{activeTasks.length} Active</span>
              </div>
              <button onClick={onNavigateToTasks} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                View All Tasks
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active tasks assigned. You have full capacity for regression or new test execution!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeTasks.map((t) => {
                  const isDueToday = t.dueDate === '2026-09-05';
                  const isOverdue = t.dueDate < '2026-09-05';
                  const isBlocked = t.status === 'Blocked';

                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-card-subtle)',
                        border: isBlocked
                          ? '1px solid rgba(244, 63, 94, 0.3)'
                          : '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <button
                          onClick={() => handleToggleTaskStatus(t.id, t.status)}
                          style={{ marginTop: '2px', color: t.status === 'Completed' ? '#10b981' : 'var(--text-muted)' }}
                          title="Click to toggle status (In Progress / Completed)"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.title}</span>
                            {isDueToday && (
                              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                Due Today
                              </span>
                            )}
                            {isOverdue && (
                              <span className="badge badge-critical">Overdue</span>
                            )}
                            {isBlocked && (
                              <span className="badge badge-critical">Blocked</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Module: {t.module} • Est: {t.estimatedEffortHours}h • Priority: {t.priority.replace('_', ' ')} • Due: {t.dueDate}
                          </div>
                          {t.blockerReason && (
                            <div style={{ fontSize: '0.74rem', color: '#f43f5e', marginTop: '4px' }}>
                              ⚠ Blocker: {t.blockerReason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge badge-${t.status.toLowerCase().replace(' ', '-')}`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Bugs Waiting for Retest */}
          {retestBugs.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #a855f7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bug size={18} color="#a855f7" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Bugs Ready for Retest</h3>
                  <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                    {retestBugs.length} Pending Retest
                  </span>
                </div>
                <button onClick={onNavigateToBugs} className="btn-secondary" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                  Bug Board
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {retestBugs.map((bug) => (
                  <div
                    key={bug.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#a855f7' }}>
                          {bug.id.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{bug.title}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Env: {bug.environment} • Severity: {bug.severity}
                      </div>
                    </div>

                    <button
                      onClick={() => handleVerifyBug(bug.id)}
                      className="btn-primary"
                      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                      Verify & Close
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: My Assigned Projects & Direct Resources */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>My Assigned Projects</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {projects.map((project) => {
                const allocation = currentUser.projectAllocations.find((a) => a.projectId === project.id);

                return (
                  <div
                    key={project.id}
                    className="card card-interactive"
                    onClick={() => onNavigateToProject(project.id)}
                    style={{ background: 'var(--bg-card-subtle)', padding: '14px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{project.name}</span>
                      <span className="badge badge-normal">{allocation ? `${allocation.percentage}% allocation` : ''}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '0.7rem' }}>
                        📄 View PRD
                      </span>
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontSize: '0.7rem' }}>
                        🎨 Figma
                      </span>
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.7rem' }}>
                        🌐 Staging
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Workload Meter, Upcoming Work, and Blockers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Workload Meter Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '14px' }}>My Workload</h3>

            <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: workload.classification === 'Overloaded' ? '#f43f5e' : workload.classification === 'High' ? '#f59e0b' : '#10b981',
                  lineHeight: 1,
                }}
              >
                {workload.score}%
              </div>
              <div style={{ marginTop: '6px' }}>
                <span className={`badge badge-${workload.classification.toLowerCase()}`}>
                  {workload.classification.toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', marginBottom: '12px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${workload.score}%`,
                  background:
                    workload.classification === 'Overloaded'
                      ? '#f43f5e'
                      : workload.classification === 'High'
                      ? '#f59e0b'
                      : '#10b981',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Available Capacity:</strong> {availableCapacity}% (~{workload.capacityRemainingHours ?? Math.max(0, 40 - workload.estimatedHoursTotal)}h open)<br />
              <strong>Active Projects:</strong> {workload.projectsCount}<br />
              <strong>Estimated Hours:</strong> {workload.estimatedHoursTotal}h
            </div>
          </div>

          {/* Upcoming Work & Deadlines (Prompt Section 7) */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '12px' }}>Upcoming Work</h3>
            {upcomingDeadlines.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                No upcoming deadlines on your calendar this week.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingDeadlines.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '2px' }}>{t.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>Due: {t.dueDate}</span>
                      <span>{t.estimatedEffortHours}h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Active Blockers */}
          {activeBlockers.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #f43f5e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f43f5e' }}>My Blockers</span>
                {onNavigateToBlockers && (
                  <button onClick={onNavigateToBlockers} className="btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                    Manage
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeBlockers.map((b) => (
                  <div key={b.id} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    • <strong>{b.title}</strong>: {b.description} ({b.status})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
