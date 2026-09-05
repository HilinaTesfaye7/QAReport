import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Sliders,
  Check,
  X,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { ProjectReleaseReadiness, ReleaseStatus, User } from '../types';
import { StorageService } from '../services/storage';
import { RuleEngine, ReleaseRulesConfig } from '../services/ruleEngine';

interface ReleaseReadinessDashboardProps {
  currentUser: User;
}

export const ReleaseReadinessDashboard: React.FC<ReleaseReadinessDashboardProps> = ({ currentUser }) => {
  const projects = StorageService.getProjects();
  const isLead = currentUser.role === 'qa_lead';

  // Configurable rules state
  const [config, setConfig] = useState<ReleaseRulesConfig>({
    minRegressionPassRate: 90,
    minTestExecutionRate: 85,
    maxHighBugsAllowedForRisks: 3,
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const evaluations: ProjectReleaseReadiness[] = projects.map((p) =>
    RuleEngine.evaluateReleaseReadiness(p.id, config)
  );

  const getStatusBadge = (status: ReleaseStatus) => {
    switch (status) {
      case 'READY':
        return <span className="badge badge-available" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>🟢 READY FOR RELEASE</span>;
      case 'READY_WITH_RISKS':
        return <span className="badge badge-high" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>🟡 READY WITH RISKS</span>;
      case 'NOT_READY':
        return <span className="badge badge-critical" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>🔴 NOT READY</span>;
      case 'BLOCKED':
        return <span className="badge badge-critical" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>⛔ RELEASE BLOCKED</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>QA Release Readiness Center</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Deterministic decision engine evaluating defect density, blockers, regression pass rates, and sign-off criteria.
          </p>
        </div>

        {isLead && (
          <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="btn-secondary">
            <Sliders size={15} /> Configure Decision Rules
          </button>
        )}
      </div>

      {/* Config Drawer for QA Lead */}
      {isConfigOpen && (
        <div className="card" style={{ marginBottom: '20px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-card)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '12px' }}>
            QA Lead Release Threshold Configuration
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Minimum Regression Pass Rate (%)
              </label>
              <input
                type="number"
                min="70"
                max="100"
                value={config.minRegressionPassRate}
                onChange={(e) => setConfig({ ...config, minRegressionPassRate: parseInt(e.target.value) || 90 })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Minimum Test Execution Rate (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={config.minTestExecutionRate}
                onChange={(e) => setConfig({ ...config, minTestExecutionRate: parseInt(e.target.value) || 85 })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Max High Severity Bugs for "Risks" Status
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.maxHighBugsAllowedForRisks}
                onChange={(e) => setConfig({ ...config, maxHighBugsAllowedForRisks: parseInt(e.target.value) || 3 })}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Evaluations Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {evaluations.map((item) => (
          <div
            key={item.projectId}
            className="card"
            style={{
              background: 'var(--bg-card-subtle)',
              borderLeft:
                item.status === 'READY'
                  ? '4px solid #10b981'
                  : item.status === 'READY_WITH_RISKS'
                  ? '4px solid #f59e0b'
                  : '4px solid #f43f5e',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{item.projectName}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  UAT Status: <strong>{item.uatStatus}</strong> • Regression: <strong>{item.regressionStatus}</strong>
                </div>
              </div>
              {getStatusBadge(item.status)}
            </div>

            {/* Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Test Execution</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px' }}>{item.testCompletionRate}%</div>
              </div>
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pass Rate</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: '#10b981' }}>{item.passRate}%</div>
              </div>
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Critical Bugs</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: item.criticalBugsCount > 0 ? '#f43f5e' : '#10b981' }}>
                  {item.criticalBugsCount}
                </div>
              </div>
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>High Severity Bugs</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: item.highBugsCount > 0 ? '#f59e0b' : 'inherit' }}>
                  {item.highBugsCount}
                </div>
              </div>
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active Blockers</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: item.openBlockersCount > 0 ? '#f43f5e' : '#10b981' }}>
                  {item.openBlockersCount}
                </div>
              </div>
            </div>

            {/* Rule Checklist */}
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Decision Rules Evaluated:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                {item.rulesEvaluated.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.78rem',
                      padding: '4px 0',
                    }}
                  >
                    {rule.passed ? (
                      <CheckCircle2 size={16} color="#10b981" />
                    ) : (
                      <AlertOctagon size={16} color="#f43f5e" />
                    )}
                    <div>
                      <span style={{ fontWeight: 600 }}>{rule.ruleName}:</span>{' '}
                      <span style={{ color: rule.passed ? 'var(--text-muted)' : '#f43f5e' }}>{rule.details}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
