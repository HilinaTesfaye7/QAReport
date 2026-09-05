import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Users,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { RegressionCycle, User } from '../types';
import { StorageService } from '../services/storage';
import { RegressionService } from '../services/regressionService';

interface RegressionManagementProps {
  currentUser: User;
}

export const RegressionManagement: React.FC<RegressionManagementProps> = ({ currentUser }) => {
  const [cycles, setCycles] = useState<RegressionCycle[]>(RegressionService.getCycles());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Creation form fields
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('prj-banking');
  const [buildVersion, setBuildVersion] = useState('v2.4.0-rc3');
  const [environment, setEnvironment] = useState('Staging Web & Mobile');
  const [startDate, setStartDate] = useState('2026-09-05');
  const [endDate, setEndDate] = useState('2026-09-12');
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<string[]>(['tc-101', 'tc-102', 'tc-201', 'tc-202']);

  const projects = StorageService.getProjects();
  const users = StorageService.getUsers();
  const testCases = StorageService.getTestCases();
  const isLead = currentUser.role === 'qa_lead';

  const reload = () => {
    setCycles(RegressionService.getCycles());
  };

  useEffect(() => {
    reload();
    const handleStorage = () => reload();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    RegressionService.createCycle(
      {
        title,
        projectId,
        buildVersion,
        environment,
        startDate,
        endDate,
        assignedMemberIds: ['usr-hana', 'usr-ahmed'],
        testCaseIds: selectedTestCaseIds,
        status: 'In Progress',
      },
      currentUser.id
    );

    setIsCreateModalOpen(false);
    setTitle('');
    reload();
  };

  const toggleTestCase = (id: string) => {
    if (selectedTestCaseIds.includes(id)) {
      setSelectedTestCaseIds(selectedTestCaseIds.filter((tcId) => tcId !== id));
    } else {
      setSelectedTestCaseIds([...selectedTestCaseIds, id]);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Regression Test Cycles</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Schedule and monitor release build regression cycles across candidate environments.
          </p>
        </div>

        {isLead && (
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <Plus size={16} /> New Regression Cycle
          </button>
        )}
      </div>

      {/* Cycles Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cycles.map((cycle) => {
          const metrics = RegressionService.getCycleMetrics(cycle.id);
          const project = projects.find((p) => p.id === cycle.projectId);
          const assignedMembers = users.filter((u) => cycle.assignedMemberIds.includes(u.id));

          return (
            <div key={cycle.id} className="card" style={{ background: 'var(--bg-card-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{cycle.title}</h3>
                    <span className="badge badge-normal">{cycle.status}</span>
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                      Build: {cycle.buildVersion}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Project: {project?.name} • Env: {cycle.environment} • Timeline: {cycle.startDate} to {cycle.endDate}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: metrics.passRate >= 90 ? '#10b981' : '#f59e0b' }}>
                    {metrics.passRate}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pass Rate</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '14px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${metrics.passRate}%`,
                    background: metrics.passRate >= 90 ? '#10b981' : '#f59e0b',
                    borderRadius: '4px',
                  }}
                />
              </div>

              {/* Metrics Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{metrics.total}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Tests</div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>{metrics.executed}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Executed</div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>{metrics.passed}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Passed</div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f43f5e' }}>{metrics.failed}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Failed</div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{metrics.blocked}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Blocked</div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{metrics.remaining}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Remaining</div>
                </div>
              </div>

              {/* Assigned Members */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Assigned Squad:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {assignedMembers.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '12px' }}>
                      <img src={m.avatar} alt={m.name} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                      <span style={{ fontSize: '0.72rem' }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Regression Cycle */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Schedule Regression Test Cycle</h2>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCycle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Cycle Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Release Candidate 2.4.0 Regression Run"
                    required
                    style={{ width: '100%' }}
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
                      Build / Version
                    </label>
                    <input
                      type="text"
                      value={buildVersion}
                      onChange={(e) => setBuildVersion(e.target.value)}
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>

                {/* Test Cases Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
                    Select Test Cases for this Cycle ({selectedTestCaseIds.length} selected):
                  </label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {testCases.map((tc) => {
                      const selected = selectedTestCaseIds.includes(tc.id);
                      return (
                        <div
                          key={tc.id}
                          onClick={() => toggleTestCase(tc.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: selected ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                            background: selected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card-subtle)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                          }}
                        >
                          <span><strong>{tc.id.toUpperCase()}:</strong> {tc.title}</span>
                          <span className={`badge badge-${tc.priority.toLowerCase()}`}>{tc.priority}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Start Regression Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
