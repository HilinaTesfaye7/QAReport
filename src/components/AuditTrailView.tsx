import React, { useState } from 'react';
import { History, Shield, Check, X, Sparkles, Filter } from 'lucide-react';
import { AuditLog } from '../types';
import { StorageService } from '../services/storage';

export const AuditTrailView: React.FC = () => {
  const [logs] = useState<AuditLog[]>(StorageService.getAuditLogs());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAIOnly, setFilterAIOnly] = useState<boolean>(false);

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.entityType !== filterType) return false;
    if (filterAIOnly && !log.isAIGenerated) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>System Audit Trail & Accountability</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Immutable record of every task assignment, priority change, AI recommendation, and human approval.
          </p>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="all">All Entity Types</option>
          <option value="task">Tasks</option>
          <option value="bug">Bugs</option>
          <option value="project">Projects</option>
          <option value="report">Reports</option>
          <option value="recommendation">AI Recommendations</option>
          <option value="risk">Risks</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterAIOnly}
            onChange={(e) => setFilterAIOnly(e.target.checked)}
          />
          Show AI-Generated Operations Only
        </label>
      </div>

      {/* Log Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px' }}>Timestamp</th>
              <th style={{ padding: '10px' }}>Actor</th>
              <th style={{ padding: '10px' }}>Action</th>
              <th style={{ padding: '10px' }}>Entity</th>
              <th style={{ padding: '10px' }}>Previous Value</th>
              <th style={{ padding: '10px' }}>New Value</th>
              <th style={{ padding: '10px' }}>AI Origin</th>
              <th style={{ padding: '10px' }}>Human Approved</th>
              <th style={{ padding: '10px' }}>Channel</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {log.timestamp}
                </td>
                <td style={{ padding: '10px', fontWeight: 700 }}>{log.actorName}</td>
                <td style={{ padding: '10px', color: '#38bdf8', fontWeight: 600 }}>{log.action}</td>
                <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  {log.entityType} ({log.entityId})
                </td>
                <td style={{ padding: '10px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.previousValue || '—'}
                </td>
                <td style={{ padding: '10px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.newValue || '—'}
                </td>
                <td style={{ padding: '10px' }}>
                  {log.isAIGenerated ? (
                    <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                      <Sparkles size={11} /> AI
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                      Manual
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px' }}>
                  {log.humanApproved ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                      <Check size={13} /> Yes
                    </span>
                  ) : (
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      Pending
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                  {log.channel.replace('_', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
