import React, { useState, useEffect } from 'react';
import {
  Bug,
  AlertTriangle,
  Clock,
  Plus,
  RotateCcw,
  CheckCircle2,
  Filter,
  Search,
  ExternalLink,
} from 'lucide-react';
import { QABug, BugSeverity, BugStatus, User as UserType } from '../types';
import { StorageService } from '../services/storage';
import { BugService } from '../services/bugService';

interface BugManagementProps {
  currentUser: UserType;
}

export const BugManagement: React.FC<BugManagementProps> = ({ currentUser }) => {
  const [bugs, setBugs] = useState<QABug[]>(StorageService.getBugs());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Bug form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('prj-banking');
  const [module, setModule] = useState('Payment Module');
  const [severity, setSeverity] = useState<BugSeverity>('Critical');
  const [environment, setEnvironment] = useState('Staging App v2.4-rc3');
  const [stepsText, setStepsText] = useState('1. Open App\n2. Attempt transfer\n3. Observe error');
  const [expectedResult, setExpectedResult] = useState('Transfer proceeds normally without precision truncation.');
  const [actualResult, setActualResult] = useState('500 Internal Server Error returned by backend ledger.');

  const projects = StorageService.getProjects();
  const users = StorageService.getUsers();

  const reload = () => {
    setBugs(StorageService.getBugs());
  };

  useEffect(() => {
    reload();
    const handleStorage = () => reload();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  const handleStatusChange = (bugId: string, newStatus: BugStatus) => {
    BugService.updateBugStatus(bugId, newStatus, currentUser.id);
    reload();
  };

  const handleCreateBug = (e: React.FormEvent) => {
    e.preventDefault();
    const steps = stepsText.split('\n').filter((s) => s.trim().length > 0);

    BugService.createBug(
      {
        title,
        description,
        projectId,
        module,
        severity,
        priority: severity === 'Critical' ? 'Critical' : 'High',
        status: 'Open',
        reporterId: currentUser.id,
        assigneeId: currentUser.id,
        environment,
        buildVersion: 'v2.4.0-rc1',
        stepsToReproduce: steps,
        expectedResult,
        actualResult,
      },
      currentUser.id
    );

    setIsCreateModalOpen(false);
    setTitle('');
    setDescription('');
    reload();
  };

  const agingBugs = BugService.getAgingBugs(2);

  const filteredBugs = bugs.filter((b) => {
    if (filterSeverity !== 'all' && b.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (
      searchQuery &&
      !b.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !b.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getSeverityBadge = (s: BugSeverity) => {
    switch (s) {
      case 'Critical':
        return <span className="badge badge-critical">🔴 Critical</span>;
      case 'High':
        return <span className="badge badge-high">🟡 High</span>;
      case 'Medium':
        return <span className="badge badge-normal">Medium</span>;
      case 'Low':
        return <span className="badge badge-available">Low</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bug size={22} color="#f43f5e" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Defect & Bug Management</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Track open defects, aging bugs (&gt;2 days without activity), and verification workflows.
          </p>
        </div>

        <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
          <Plus size={16} /> Report New Bug
        </button>
      </div>

      {/* Aging Bugs Banner if any */}
      {agingBugs.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#f43f5e" />
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f43f5e' }}>
                {agingBugs.length} Aging Defect{agingBugs.length === 1 ? '' : 's'} Detected
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Bugs unchanged for 2+ days without status transition or commit link.
              </span>
            </div>
          </div>
          <span style={{ fontSize: '0.74rem', color: '#f43f5e', fontWeight: 700 }}>
            {agingBugs.map((b) => b.id.toUpperCase()).join(', ')}
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by bug ID or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '260px', fontSize: '0.82rem' }}
        />

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="all">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="all">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Ready for Retest">Ready for Retest</option>
          <option value="Verified">Verified / Closed</option>
          <option value="Reopened">Reopened</option>
        </select>
      </div>

      {/* Bugs Grid / Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredBugs.map((bug) => {
          const reporter = users.find((u) => u.id === bug.reporterId);
          const assignee = users.find((u) => u.id === bug.assigneeId);
          const isAging = agingBugs.some((b) => b.id === bug.id);

          return (
            <div
              key={bug.id}
              className="card"
              style={{
                background: 'var(--bg-card-subtle)',
                borderLeft: bug.severity === 'Critical' ? '4px solid #f43f5e' : bug.severity === 'High' ? '4px solid #f59e0b' : '4px solid #38bdf8',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#38bdf8' }}>
                      {bug.id.toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '1rem' }}>{bug.title}</span>
                    {getSeverityBadge(bug.severity)}
                    {isAging && (
                      <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
                        ⏰ Aging 2+ Days
                      </span>
                    )}
                    {bug.reopenedCount > 0 && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        Reopened {bug.reopenedCount}x
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Module: {bug.module} • Env: {bug.environment} • Reported by {reporter ? reporter.name : 'QA'} on {bug.createdAt}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={bug.status}
                    onChange={(e) => handleStatusChange(bug.id, e.target.value as BugStatus)}
                    style={{ fontSize: '0.78rem', fontWeight: 600 }}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready for Retest">Ready for Retest</option>
                    <option value="Verified">Verified</option>
                    <option value="Reopened">Reopened</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                {bug.description}
              </p>

              {/* Steps to reproduce & Results */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.78rem', marginBottom: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Expected Result:</strong><br />
                  <span style={{ color: 'var(--text-secondary)' }}>{bug.expectedResult}</span>
                </div>
                <div style={{ padding: '8px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <strong style={{ color: '#f43f5e' }}>Actual Result:</strong><br />
                  <span style={{ color: 'var(--text-secondary)' }}>{bug.actualResult}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Report Bug */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Report New QA Defect</h2>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBug}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Bug Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. 504 Gateway Timeout when submitting transfer with special characters"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Severity
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                      style={{ width: '100%' }}
                    >
                      <option value="Critical">🔴 Critical (Release Blocker)</option>
                      <option value="High">🟡 High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Environment
                    </label>
                    <input
                      type="text"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Steps to Reproduce
                  </label>
                  <textarea
                    value={stepsText}
                    onChange={(e) => setStepsText(e.target.value)}
                    placeholder="1. Step one&#10;2. Step two&#10;3. Step three"
                    style={{ width: '100%', minHeight: '60px' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Expected Result
                    </label>
                    <textarea
                      value={expectedResult}
                      onChange={(e) => setExpectedResult(e.target.value)}
                      style={{ width: '100%', minHeight: '50px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Actual Result
                    </label>
                    <textarea
                      value={actualResult}
                      onChange={(e) => setActualResult(e.target.value)}
                      style={{ width: '100%', minHeight: '50px' }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-danger">
                  Submit Defect & Alert Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
