import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  BarChart3,
  Users,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';
import { WorkloadService } from '../services/workloadService';
import { TestCaseService } from '../services/testCaseService';

interface ReportsAndExportViewProps {
  currentUser: User;
}

export const ReportsAndExportView: React.FC<ReportsAndExportViewProps> = ({ currentUser }) => {
  const [reportType, setReportType] = useState<'project' | 'team' | 'individual'>('project');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');

  const projects = StorageService.getProjects();
  const users = StorageService.getUsers();
  const tasks = StorageService.getTasks();
  const bugs = StorageService.getBugs();
  const testCases = StorageService.getTestCases();
  const workloads = WorkloadService.getAllMembersWorkload();

  const exportToCSV = (filename: string, rows: string[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTasksCSV = () => {
    const header = ['Task ID', 'Title', 'Project', 'Module', 'Priority', 'Status', 'Assignee', 'Effort (Hours)', 'Due Date'];
    const rows = tasks.map((t) => {
      const p = projects.find((prj) => prj.id === t.projectId)?.name || t.projectId;
      const u = users.find((user) => user.id === t.assigneeId)?.name || t.assigneeId;
      return [t.id, t.title, p, t.module, t.priority, t.status, u, String(t.estimatedEffortHours), t.dueDate];
    });
    exportToCSV('QA_Tasks_Export', [header, ...rows]);
  };

  const handleExportBugsCSV = () => {
    const header = ['Bug ID', 'Title', 'Project', 'Module', 'Severity', 'Priority', 'Status', 'Assignee', 'Environment', 'Created Date'];
    const rows = bugs.map((b) => {
      const p = projects.find((prj) => prj.id === b.projectId)?.name || b.projectId;
      const u = users.find((user) => user.id === b.assigneeId)?.name || b.assigneeId;
      return [b.id, b.title, p, b.module, b.severity, b.priority, b.status, u, b.environment, b.createdAt];
    });
    exportToCSV('QA_Defects_Export', [header, ...rows]);
  };

  const handleExportWorkloadCSV = () => {
    const header = ['Member Name', 'Role', 'Workload Score', 'Classification', 'Active Tasks', 'Est Hours', 'Critical Items'];
    const rows = workloads.map((w) => {
      const u = users.find((user) => user.id === w.memberId);
      return [
        u?.name || w.memberId,
        u?.role || '',
        String(w.score),
        w.classification,
        String(w.taskCount),
        String(w.estimatedHoursTotal),
        String(w.criticalTasksCount),
      ];
    });
    exportToCSV('QA_Team_Workload_Export', [header, ...rows]);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>QA Analytics & Reporting Hub</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Project testing metrics, defect velocity, team workload distribution, and CSV exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExportTasksCSV} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            <Download size={14} /> Export Tasks CSV
          </button>
          <button onClick={handleExportBugsCSV} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            <Download size={14} /> Export Defects CSV
          </button>
          <button onClick={handleExportWorkloadCSV} className="btn-primary" style={{ fontSize: '0.8rem' }}>
            <Download size={14} /> Export Workload CSV
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setReportType('project')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            background: reportType === 'project' ? 'var(--bg-card-hover)' : 'var(--bg-card)',
            color: reportType === 'project' ? '#38bdf8' : 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <FolderKanban size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Project QA Progress
        </button>

        <button
          onClick={() => setReportType('team')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            background: reportType === 'team' ? 'var(--bg-card-hover)' : 'var(--bg-card)',
            color: reportType === 'team' ? '#38bdf8' : 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Users size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Team Workload & Completion
        </button>
      </div>

      {/* 1. Project Reports */}
      {reportType === 'project' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.map((p) => {
            const prjTasks = tasks.filter((t) => t.projectId === p.id);
            const prjBugs = bugs.filter((b) => b.projectId === p.id);
            const metrics = TestCaseService.getMetrics(p.id);

            return (
              <div key={p.id} className="card" style={{ background: 'var(--bg-card-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{p.name}</h3>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Target Release: {p.targetReleaseDate} • Status: {p.status}
                    </div>
                  </div>
                  <span className="badge badge-normal">QA Progress: {p.qaProgress}%</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Tasks</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px' }}>{prjTasks.length}</div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Defects (Crit / High)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: '#f43f5e' }}>
                      {prjBugs.filter((b) => b.severity === 'Critical').length} / {prjBugs.filter((b) => b.severity === 'High').length}
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Test Execution</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
                      {metrics.executed} / {metrics.total}
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Test Pass Rate</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: '#10b981' }}>
                      {metrics.passRate}%
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Regression Velocity</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px' }}>
                      {p.regressionProgress}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Team Workload Report Table */}
      {reportType === 'team' && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '14px' }}>
            QA Team Member Workload & Capacity Table
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>QA Member</th>
                <th style={{ padding: '10px' }}>Projects</th>
                <th style={{ padding: '10px' }}>Tasks</th>
                <th style={{ padding: '10px' }}>Estimated Hours</th>
                <th style={{ padding: '10px' }}>Critical Work</th>
                <th style={{ padding: '10px' }}>Workload Score</th>
                <th style={{ padding: '10px' }}>Classification</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((w) => {
                const u = users.find((user) => user.id === w.memberId);
                return (
                  <tr key={w.memberId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={u?.avatar} alt={u?.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                        <span>{u?.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px' }}>{w.projectsCount}</td>
                    <td style={{ padding: '10px' }}>{w.taskCount}</td>
                    <td style={{ padding: '10px' }}>{w.estimatedHoursTotal} hrs</td>
                    <td style={{ padding: '10px', color: w.criticalTasksCount > 0 ? '#f43f5e' : 'inherit', fontWeight: 700 }}>
                      {w.criticalTasksCount}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 800 }}>{w.score} / 100</td>
                    <td style={{ padding: '10px' }}>
                      <span className={`badge badge-${w.classification.toLowerCase()}`}>
                        {w.classification}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
