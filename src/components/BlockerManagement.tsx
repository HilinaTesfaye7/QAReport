import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  CheckCircle2,
  Clock,
  Filter,
  Check,
  Search,
} from 'lucide-react';
import { Blocker, BlockerStatus, BlockerSeverity, User } from '../types';
import { StorageService } from '../services/storage';
import { BlockerService } from '../services/blockerService';

interface BlockerManagementProps {
  currentUser: User;
}

export const BlockerManagement: React.FC<BlockerManagementProps> = ({ currentUser }) => {
  const [blockers, setBlockers] = useState<Blocker[]>(BlockerService.getBlockers());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('prj-banking');
  const [severity, setSeverity] = useState<BlockerSeverity>('Critical');

  const projects = StorageService.getProjects();
  const users = StorageService.getUsers();

  const reload = () => {
    setBlockers(BlockerService.getBlockers());
  };

  useEffect(() => {
    reload();
    const handleStorage = () => reload();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  const handleStatusChange = (blockerId: string, newStatus: BlockerStatus) => {
    BlockerService.updateBlockerStatus(blockerId, newStatus, currentUser.id);
    reload();
  };

  const handleCreateBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    BlockerService.createBlocker(
      {
        title,
        description,
        projectId,
        memberId: currentUser.id,
        severity,
        status: 'Open',
      },
      currentUser.id
    );

    setIsCreateModalOpen(false);
    setTitle('');
    setDescription('');
    reload();
  };

  const filteredBlockers = blockers.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    return true;
  });

  const getSeverityBadge = (s: BlockerSeverity) => {
    switch (s) {
      case 'Critical':
        return <span className="badge badge-critical">🔴 Critical Blocker</span>;
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
            <AlertTriangle size={22} color="#f43f5e" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>QA Blocker Management</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Log and track environmental, infrastructure, and dependency blockers stopping test execution.
          </p>
        </div>

        <button onClick={() => setIsCreateModalOpen(true)} className="btn-danger">
          <Plus size={16} /> Report New Blocker
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {['all', 'Open', 'Investigating', 'Waiting', 'Resolved'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: filterStatus === st ? 'var(--bg-card-hover)' : 'var(--bg-card)',
              color: filterStatus === st ? '#38bdf8' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {st === 'all' ? 'All Blockers' : st}
          </button>
        ))}
      </div>

      {/* Blockers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredBlockers.map((b) => {
          const project = projects.find((p) => p.id === b.projectId);
          const member = users.find((u) => u.id === b.memberId);
          const isResolved = b.status === 'Resolved';

          return (
            <div
              key={b.id}
              className="card"
              style={{
                background: 'var(--bg-card-subtle)',
                borderLeft: b.severity === 'Critical' ? '4px solid #f43f5e' : '4px solid #f59e0b',
                opacity: isResolved ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>{b.title}</span>
                    {getSeverityBadge(b.severity)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Project: {project?.name} • Reported by: {member?.name} on {b.createdAt}
                    {b.resolvedAt && ` • Resolved: ${b.resolvedAt}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={b.status}
                    onChange={(e) => handleStatusChange(b.id, e.target.value as BlockerStatus)}
                    style={{ fontSize: '0.78rem', fontWeight: 600 }}
                  >
                    <option value="Open">Open</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Waiting">Waiting</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {b.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Modal: Report Blocker */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Report QA Blocker</h2>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBlocker}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Blocker Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Third-party SMS OTP service throwing 500 in Staging"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Description & Testing Impact
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain what is blocked, affected modules, and required actions..."
                    required
                    style={{ width: '100%', minHeight: '60px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Project
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Severity
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as BlockerSeverity)}
                      style={{ width: '100%' }}
                    >
                      <option value="Critical">🔴 Critical (Halts Testing)</option>
                      <option value="High">🟡 High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-danger">
                  Log Blocker & Alert Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
