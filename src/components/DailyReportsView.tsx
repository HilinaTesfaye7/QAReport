import React, { useState, useEffect } from 'react';
import { FileText, Send, Check, AlertTriangle, Copy, Calendar, UserCheck } from 'lucide-react';
import { User, DailyReport } from '../types';
import { StorageService } from '../services/storage';
import { DailyReportService } from '../services/dailyReportService';
import { WorkloadService } from '../services/workloadService';

interface DailyReportsViewProps {
  currentUser: User;
}

export const DailyReportsView: React.FC<DailyReportsViewProps> = ({ currentUser }) => {
  const isLead = currentUser.role === 'qa_lead';
  const [reports, setReports] = useState<DailyReport[]>(DailyReportService.getDailyReports());
  const [copiedNotification, setCopiedNotification] = useState(false);

  useEffect(() => {
    DailyReportService.syncTelegramReports().then((synced) => {
      setReports(synced);
    });

    const handleStorage = () => {
      setReports(DailyReportService.getDailyReports());
    };
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  // Editable fields for individual QA report
  const latestMemberReport = DailyReportService.getLatestReportForMember(currentUser.id);
  const [yesterday, setYesterday] = useState(
    latestMemberReport?.yesterdayCompleted || 'Executed 12 test cases and verified Login biometrics.'
  );
  const [today, setToday] = useState(
    latestMemberReport?.todayWorkingOn || 'Execute Payment API endpoint test suite and retest BUG-142.'
  );
  const [isBlocked, setIsBlocked] = useState(latestMemberReport?.isBlocked ?? false);
  const [blockers, setBlockers] = useState(
    latestMemberReport?.blockers || 'Staging API payment sandbox environment unavailable.'
  );
  const [progressPercentage, setProgressPercentage] = useState(latestMemberReport?.progressPercentage || 65);
  const [expectedCompletion, setExpectedCompletion] = useState<'Today' | 'Tomorrow' | 'Later'>(
    (latestMemberReport?.expectedCompletion as 'Today' | 'Tomorrow' | 'Later') || 'Today'
  );
  const [notes, setNotes] = useState(
    latestMemberReport?.notes || 'Waiting on DevOps to resolve gateway timeout.'
  );

  const aggregated = DailyReportService.generateAggregatedTeamReport();
  const users = StorageService.getUsers();
  const workload = WorkloadService.computeMemberWorkload(currentUser.id);
  const projects = StorageService.getProjects();

  const handleSubmitPersonalReport = (e: React.FormEvent) => {
    e.preventDefault();
    const projectId = currentUser.projectAllocations[0]?.projectId || 'prj-banking';
    const draft = DailyReportService.saveReportDraft({
      memberId: currentUser.id,
      projectId,
      yesterdayCompleted: yesterday,
      todayWorkingOn: today,
      isBlocked,
      blockers,
      progressPercentage,
      expectedCompletion,
      notes,
    });
    DailyReportService.submitDailyReport(draft.id, currentUser.id);
    setReports(DailyReportService.getDailyReports());
    alert('Daily QA Report successfully submitted to QA Lead!');
  };

  const handleCopyMarkdown = () => {
    const md = `# DAILY QA TEAM REPORT - ${aggregated.date}

## QA Team Standup Summary
- Executed Tests: ${aggregated.testing.executed} (${aggregated.testing.passed} passed, ${aggregated.testing.failed} failed, ${aggregated.testing.blocked} blocked)
- Overall Test Pass Rate: ${aggregated.testing.passRate}%
- Regression Progress: ${aggregated.testing.regressionProgress}%

### Defect Distribution:
- Critical: ${aggregated.bugs.critical}
- High: ${aggregated.bugs.high}
- Resolved: ${aggregated.bugs.resolved}
- Reopened: ${aggregated.bugs.reopened}

### Team Workload:
- Overloaded Members: ${aggregated.teamWorkload.overloadedCount}
- Workload Range: ${aggregated.teamWorkload.lowest?.score || 0}% to ${aggregated.teamWorkload.highest?.score || 0}%

### Team Progress:
- Completed Tasks: ${aggregated.teamProgress.completedYesterday}
- Tasks In Progress: ${aggregated.teamProgress.plannedToday}
- Blocked Work: ${aggregated.teamProgress.blockedWork}
- Overdue Work: ${aggregated.teamProgress.overdueWork}
`;

    navigator.clipboard.writeText(md);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {isLead ? 'Daily QA Team Reports (Consolidated)' : 'My Daily QA Standup Report'}
            </h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {isLead
              ? 'Aggregated standup intelligence across all active QA projects and test cycles.'
              : 'Log daily testing progress, yesterday’s executions, planned tests, and blockers.'}
          </p>
        </div>

        {isLead && (
          <button onClick={handleCopyMarkdown} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            <Copy size={15} />
            <span>{copiedNotification ? 'Copied to Clipboard!' : 'Copy Aggregated Markdown'}</span>
          </button>
        )}
      </div>

      {isLead ? (
        /* QA Lead View: Aggregated Rollup + Submissions */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Executive Summary Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>QA Team Daily Digest ({aggregated.date})</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {aggregated.submittedReportsCount} daily report(s) submitted for today.
                </p>
              </div>
              <span className="badge badge-normal">Aggregated Rollup</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Test Pass Rate / Regression</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
                  {aggregated.testing.passRate}% / {aggregated.testing.regressionProgress}%
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Bugs (Critical / High / Resolved)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '2px', color: '#f43f5e' }}>
                  {aggregated.bugs.critical} / {aggregated.bugs.high} / <span style={{ color: '#10b981' }}>{aggregated.bugs.resolved}</span>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Workload Balance</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '4px' }}>
                  {aggregated.teamWorkload.overloadedCount > 0 ? (
                    <span style={{ color: '#f43f5e' }}>🔴 {aggregated.teamWorkload.overloadedCount} overloaded</span>
                  ) : (
                    <span style={{ color: '#10b981' }}>🟢 All members balanced</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Individual Member Submitted Reports */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
              Individual Member Submissions ({reports.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map((rep) => {
                const member = users.find((u) => u.id === rep.memberId);
                const project = projects.find((p) => p.id === rep.projectId);
                const memberWorkload = WorkloadService.computeMemberWorkload(rep.memberId);

                return (
                  <div
                    key={rep.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'var(--bg-card-subtle)',
                      border: rep.isBlocked ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {member ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                            }}
                          >
                            {(rep.memberName || 'Q')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                            {rep.memberName || (member ? member.name : rep.memberId)}{' '}
                            {rep.role && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                ({rep.role})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Project: {rep.projectName || (project ? project.name : rep.projectId)} • Date: {rep.date}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {rep.source === 'telegram' ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: 'rgba(56, 189, 248, 0.18)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ✈️ Telegram Standup
                          </span>
                        ) : (
                          <span className="badge badge-normal">Load: {memberWorkload.score}%</span>
                        )}
                        {rep.isBlocked && (
                          <span className="badge badge-critical">⚠ Blocked</span>
                        )}
                        <span className="badge badge-available">Submitted</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem', marginBottom: '8px' }}>
                      <div>
                        <strong style={{ color: 'var(--text-muted)' }}>Yesterday Completed:</strong><br />
                        {rep.yesterdayCompleted}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-muted)' }}>Today Working On:</strong><br />
                        {rep.todayWorkingOn}
                      </div>
                    </div>

                    {rep.blockers && (
                      <div style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '6px', fontSize: '0.78rem', color: '#f43f5e', marginBottom: '6px' }}>
                        <strong>Blocker:</strong> {rep.blockers}
                      </div>
                    )}

                    {rep.notes && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        <strong>Notes:</strong> {rep.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* QA Member View: Editable Personal Daily Report */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Edit & Submit Today's QA Report</h3>
            <span className={`badge badge-${workload.classification.toLowerCase()}`}>
              Current Workload: {workload.score}% ({workload.classification})
            </span>
          </div>

          <form onSubmit={handleSubmitPersonalReport}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Yesterday Completed:
                </label>
                <textarea
                  value={yesterday}
                  onChange={(e) => setYesterday(e.target.value)}
                  style={{ width: '100%', minHeight: '60px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Today Working On:
                </label>
                <textarea
                  value={today}
                  onChange={(e) => setToday(e.target.value)}
                  style={{ width: '100%', minHeight: '60px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isBlocked"
                  checked={isBlocked}
                  onChange={(e) => setIsBlocked(e.target.checked)}
                />
                <label htmlFor="isBlocked" style={{ fontSize: '0.82rem', fontWeight: 600, color: isBlocked ? '#f43f5e' : 'inherit' }}>
                  I have active blockers today
                </label>
              </div>

              {isBlocked && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#f43f5e' }}>
                    Blockers Description:
                  </label>
                  <textarea
                    value={blockers}
                    onChange={(e) => setBlockers(e.target.value)}
                    style={{ width: '100%', minHeight: '50px' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Task Progress Percentage ({progressPercentage}%):
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progressPercentage}
                    onChange={(e) => setProgressPercentage(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Expected Completion:
                  </label>
                  <select
                    value={expectedCompletion}
                    onChange={(e) => setExpectedCompletion(e.target.value as 'Today' | 'Tomorrow' | 'Later')}
                    style={{ width: '100%' }}
                  >
                    <option value="Today">Today</option>
                    <option value="Tomorrow">Tomorrow</option>
                    <option value="Later">Later</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Additional Notes for QA Lead:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary">
                <Send size={16} /> Submit Daily Report to QA Lead
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
