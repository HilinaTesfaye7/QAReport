import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertOctagon,
  MinusCircle,
  Play,
  Layers,
  Plus,
  Filter,
  Search,
  Check,
} from 'lucide-react';
import { TestCase, TestSuite, TestExecutionStatus, User } from '../types';
import { StorageService } from '../services/storage';
import { TestCaseService } from '../services/testCaseService';

interface TestCaseManagementProps {
  currentUser: User;
}

export const TestCaseManagement: React.FC<TestCaseManagementProps> = ({ currentUser }) => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>(StorageService.getTestSuites());
  const [testCases, setTestCases] = useState<TestCase[]>(StorageService.getTestCases());
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('all');
  const [metrics, setMetrics] = useState(TestCaseService.getMetrics());

  const reload = () => {
    setTestSuites(StorageService.getTestSuites());
    setTestCases(StorageService.getTestCases());
    setMetrics(TestCaseService.getMetrics());
  };

  useEffect(() => {
    reload();
    const handleStorage = () => reload();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  const handleExecute = (testCaseId: string, status: TestExecutionStatus) => {
    let notes = undefined;
    if (status === 'Failed' || status === 'Blocked') {
      notes = prompt(`Add test execution notes for ${status} status:`) || undefined;
    }
    TestCaseService.executeTestCase(testCaseId, status, currentUser.id, notes);
    reload();
  };

  const filteredCases = testCases.filter((tc) => {
    if (selectedSuiteId !== 'all' && tc.suiteId !== selectedSuiteId) return false;
    return true;
  });

  const getStatusBadge = (status: TestExecutionStatus) => {
    switch (status) {
      case 'Passed':
        return <span className="badge badge-available">✓ Passed</span>;
      case 'Failed':
        return <span className="badge badge-critical">✕ Failed</span>;
      case 'Blocked':
        return <span className="badge badge-high">⚠ Blocked</span>;
      case 'Skipped':
        return <span className="badge badge-normal">Skipped</span>;
      default:
        return <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>Not Run</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="#10b981" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Test Case Execution Runner</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Execute test steps, record passes/fails/blockers, and track pass-rate metrics in real time.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="card">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL TEST CASES</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px' }}>{metrics.total}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>EXECUTED</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
            {metrics.executed}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>PASSED</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px', color: '#10b981' }}>
            {metrics.passed}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>FAILED</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px', color: '#f43f5e' }}>
            {metrics.failed}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>BLOCKED</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px', color: '#f59e0b' }}>
            {metrics.blocked}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>PASS RATE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
            {metrics.passRate}%
          </div>
        </div>
      </div>

      {/* Suite Selector Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setSelectedSuiteId('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            background: selectedSuiteId === 'all' ? 'linear-gradient(135deg, #38bdf8, #6366f1)' : 'var(--bg-card)',
            color: selectedSuiteId === 'all' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          All Test Suites
        </button>
        {testSuites.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSuiteId(s.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: selectedSuiteId === s.id ? 'linear-gradient(135deg, #38bdf8, #6366f1)' : 'var(--bg-card)',
              color: selectedSuiteId === s.id ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Test Cases List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredCases.map((tc) => (
          <div
            key={tc.id}
            className="card"
            style={{
              background: 'var(--bg-card-subtle)',
              borderLeft: tc.executionStatus === 'Passed' ? '4px solid #10b981' : tc.executionStatus === 'Failed' ? '4px solid #f43f5e' : tc.executionStatus === 'Blocked' ? '4px solid #f59e0b' : '4px solid var(--border-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#10b981' }}>
                    {tc.id.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{tc.title}</span>
                  {getStatusBadge(tc.executionStatus)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Module: {tc.module} • Requirement: {tc.requirement} • Priority: {tc.priority.replace('_', ' ')}
                </div>
              </div>

              {/* Fast Runner Action Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleExecute(tc.id, 'Passed')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                  title="Mark as Passed"
                >
                  ✓ Pass
                </button>
                <button
                  onClick={() => handleExecute(tc.id, 'Failed')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#f43f5e',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                  title="Mark as Failed"
                >
                  ✕ Fail
                </button>
                <button
                  onClick={() => handleExecute(tc.id, 'Blocked')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                  title="Mark as Blocked"
                >
                  ⚠ Block
                </button>
                <button
                  onClick={() => handleExecute(tc.id, 'Skipped')}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.74rem',
                  }}
                  title="Skip"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Test Steps */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Test Steps & Expected Results:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                {tc.steps.map((step) => (
                  <div key={step.stepNumber} style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>Step {step.stepNumber}:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{step.action}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→ Expected: {step.expectedResult}</span>
                  </div>
                ))}
              </div>
            </div>

            {tc.notes && (
              <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontStyle: 'italic' }}>
                Execution Note: {tc.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
