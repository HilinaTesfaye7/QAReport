import React, { useState } from 'react';
import { X, Check, CheckCircle2, UserCheck, ShieldCheck } from 'lucide-react';
import { QATask, User } from '../types';
import { StorageService } from '../services/storage';
import { RuleEngine } from '../services/ruleEngine';
import { TaskService } from '../services/taskService';

interface WorkloadAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTaskId?: string;
  onTaskAssigned?: () => void;
  leadId: string;
}

export const WorkloadAssignmentModal: React.FC<WorkloadAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedTaskId,
  onTaskAssigned,
  leadId,
}) => {
  const tasks = StorageService.getTasks().filter((t) => t.status !== 'Completed');
  const [currentTaskId, setCurrentTaskId] = useState<string>(selectedTaskId || tasks[0]?.id || '');
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTask = tasks.find((t) => t.id === currentTaskId);
  const recommendation = currentTask
    ? RuleEngine.recommendAssigneeForTask({
        projectId: currentTask.projectId,
        estimatedEffortHours: currentTask.estimatedEffortHours,
        priority: currentTask.priority,
        title: currentTask.title,
        module: currentTask.module,
      })
    : null;

  const handleConfirmAssignment = (assigneeId: string) => {
    if (!currentTask) return;
    TaskService.assignTask(currentTask.id, assigneeId, leadId);
    setAssignmentSuccess(`Successfully assigned "${currentTask.title}"!`);
    setTimeout(() => {
      setAssignmentSuccess(null);
      if (onTaskAssigned) onTaskAssigned();
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Rule-Based Task Assignment</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Deterministic recommendation based on skills match, workload score, and project assignment.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Task Selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
            Select Task to Distribute:
          </label>
          <select
            value={currentTaskId}
            onChange={(e) => setCurrentTaskId(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem' }}
          >
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.priority}] {t.title} ({t.estimatedEffortHours}h) - Current: {t.assigneeId}
              </option>
            ))}
          </select>
        </div>

        {assignmentSuccess ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              background: 'rgba(16, 185, 129, 0.12)',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontWeight: 700,
            }}
          >
            <Check size={32} style={{ margin: '0 auto 8px' }} />
            <div>{assignmentSuccess}</div>
          </div>
        ) : recommendation ? (
          <div>
            {/* Primary Recommendation Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="badge" style={{ background: '#38bdf8', color: '#000', fontWeight: 800 }}>
                  Rule Engine Recommendation
                </span>
                <span className={`badge badge-${recommendation.workload.classification.toLowerCase()}`}>
                  Workload: {recommendation.workload.score}% ({recommendation.workload.classification})
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <img
                  src={recommendation.recommendedMember.avatar}
                  alt={recommendation.recommendedMember.name}
                  style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #38bdf8' }}
                />
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                    {recommendation.recommendedMember.name}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Skills: {recommendation.recommendedMember.skills.slice(0, 4).join(' • ')}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Rule Evaluation Criteria:
                </div>
                <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {recommendation.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleConfirmAssignment(recommendation.recommendedMember.id)}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Assign Task to {recommendation.recommendedMember.name.split(' ')[0]} <Check size={16} />
              </button>
            </div>

            {/* Alternative Candidate */}
            {recommendation.alternativeMember && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={recommendation.alternativeMember.avatar}
                    alt={recommendation.alternativeMember.name}
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Alternative: {recommendation.alternativeMember.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Workload: {recommendation.alternativeWorkload?.score}% (
                      {recommendation.alternativeWorkload?.classification})
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleConfirmAssignment(recommendation.alternativeMember!.id)}
                  className="btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                >
                  Assign Alternative
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
