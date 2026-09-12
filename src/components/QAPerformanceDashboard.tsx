import React from 'react';
import { User, MemberWorkload } from '../types';
import { WorkloadService } from '../services/workloadService';
import { TrendingUp, Award, AlertTriangle, Target } from 'lucide-react';

interface QAPerformanceDashboardProps {
  currentUser: User;
}

export const QAPerformanceDashboard: React.FC<QAPerformanceDashboardProps> = ({ currentUser }) => {
  const isLeadOrDirector = currentUser.role === 'QA Lead' || currentUser.role === 'QA Director';
  
  // For Tester, show only their workload. For Lead/Director, show all.
  const workloads: MemberWorkload[] = isLeadOrDirector 
    ? WorkloadService.getAllMembersWorkload()
    : [WorkloadService.computeMemberWorkload(currentUser.id)];

  // Sort by score descending
  workloads.sort((a, b) => b.score - a.score);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <TrendingUp size={28} color="#38bdf8" />
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            QA Performance & Workload Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {isLeadOrDirector ? 'Team workload distribution and scoring' : 'Your personal workload and performance metrics'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {workloads.map((workload) => (
          <div
            key={workload.memberId}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Top accent bar based on classification */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: workload.classification === 'Overloaded' ? '#f43f5e' :
                          workload.classification === 'High' ? '#f59e0b' :
                          workload.classification === 'Balanced' ? '#10b981' : '#38bdf8'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{isLeadOrDirector ? workload.memberId : 'You'}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Workload Score: <strong>{workload.score}</strong>
                </div>
              </div>
              <div style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: workload.classification === 'Overloaded' ? 'rgba(244, 63, 94, 0.15)' :
                            workload.classification === 'High' ? 'rgba(245, 158, 11, 0.15)' :
                            workload.classification === 'Balanced' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: workload.classification === 'Overloaded' ? '#f43f5e' :
                       workload.classification === 'High' ? '#f59e0b' :
                       workload.classification === 'Balanced' ? '#10b981' : '#38bdf8'
              }}>
                {workload.classification.toUpperCase()}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              <AlertTriangle size={14} color="#f59e0b" />
              <span>{workload.explanation}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <Target size={14} /> Active Tasks
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{workload.taskCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{workload.criticalTasksCount} Critical</div>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <Award size={14} /> Open Bugs
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: workload.openBugsCount > 5 ? '#f43f5e' : 'inherit' }}>
                  {workload.openBugsCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Assigned</div>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
