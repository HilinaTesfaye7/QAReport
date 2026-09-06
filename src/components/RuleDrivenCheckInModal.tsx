import React, { useState, useEffect } from 'react';
import { X, Send, Check, AlertTriangle, MessageSquare, CheckCircle2, AlertOctagon } from 'lucide-react';
import { User, Blocker } from '../types';
import { RuleEngine } from '../services/ruleEngine';
import { DailyReportService } from '../services/dailyReportService';
import { BlockerService } from '../services/blockerService';

interface RuleDrivenCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onReportSubmitted?: () => void;
}

export const RuleDrivenCheckInModal: React.FC<RuleDrivenCheckInModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onReportSubmitted,
}) => {
  const [data, setData] = useState(RuleEngine.generateRuleDrivenCheckInQuestions(currentUser.id));
  const [todayWorkingOn, setTodayWorkingOn] = useState(
    'Executed Payment API endpoint test suite and retested BUG-142.'
  );
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockers, setBlockers] = useState('');
  const [risks, setRisks] = useState('');
  const [nextPlan, setNextPlan] = useState('Run regression suite and verify checkout flow.');
  const [majorAchievement, setMajorAchievement] = useState('Completed 12 test cases and verified Login biometrics.');
  const [progressPercentage, setProgressPercentage] = useState(75);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeUserBlocker, setActiveUserBlocker] = useState<Blocker | null>(null);
  const [blockerResolvedNotice, setBlockerResolvedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const generated = RuleEngine.generateRuleDrivenCheckInQuestions(currentUser.id);
      setData(generated);
      setIsSuccess(false);
      setBlockerResolvedNotice(false);

      const allBlockers = BlockerService.getBlockers();
      const myBlocker = allBlockers.find(
        (b) =>
          (b.memberId === currentUser.id ||
            (b.reportedBy && b.reportedBy.toLowerCase().includes(currentUser.name.toLowerCase())) ||
            (currentUser.telegramChatId && (b.memberId === `usr-${currentUser.telegramChatId}` || b.memberId === currentUser.telegramChatId))) &&
          b.status !== 'Resolved'
      );

      if (myBlocker) {
        setActiveUserBlocker(myBlocker);
        setIsBlocked(true);
        setBlockers(myBlocker.description || myBlocker.title);
      } else {
        setActiveUserBlocker(null);
        if (generated.openBlockersCount > 0) {
          setIsBlocked(true);
          setBlockers('Staging API payment gateway sandbox mock returning 502 Bad Gateway');
        } else {
          setIsBlocked(false);
          setBlockers('');
        }
      }
    }
  }, [isOpen, currentUser]);

  const handleResolvePreviousBlocker = () => {
    if (activeUserBlocker) {
      BlockerService.updateBlockerStatus(activeUserBlocker.id, 'Resolved', currentUser.id);
      setActiveUserBlocker(null);
      setIsBlocked(false);
      setBlockers('');
      setBlockerResolvedNotice(true);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const projectId = currentUser.projectAllocations[0]?.projectId || 'prj-banking';
    const hasBlocker = Boolean(isBlocked && blockers.trim().length > 0 && blockers.toLowerCase() !== 'none');

    const draft = DailyReportService.saveReportDraft({
      memberId: currentUser.id,
      projectId,
      todayWorkingOn: todayWorkingOn.trim(),
      isBlocked: hasBlocker,
      blockers: hasBlocker ? blockers.trim() : 'None',
      risks: risks.trim() || 'None',
      nextPlan: nextPlan.trim(),
      majorAchievement: majorAchievement.trim() || 'None',
      yesterdayCompleted: majorAchievement.trim() || 'None',
      progressPercentage,
      expectedCompletion: nextPlan.trim() || 'Today',
      notes: JSON.stringify({
        workStatus: hasBlocker ? 'Blocked' : (risks && risks.toLowerCase() !== 'none' ? 'At Risk' : 'On Track'),
        statusEmoji: hasBlocker ? '🔴' : (risks && risks.toLowerCase() !== 'none' ? '🟡' : '🟢'),
        risks: risks.trim() || 'None',
        nextPlan: nextPlan.trim(),
        majorAchievement: majorAchievement.trim() || 'None',
      }),
    });

    DailyReportService.submitDailyReport(draft.id, currentUser.id);

    setIsSuccess(true);
    setTimeout(() => {
      if (onReportSubmitted) onReportSubmitted();
      onClose();
    }, 1400);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={20} color="#38bdf8" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Daily QA Check-In</h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Deterministic, rule-driven daily standup questionnaire (No AI required)
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Reminder for Previously Reported Blocker */}
        {activeUserBlocker && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} />
                <span>Reminder: Blocker Reported Yesterday / Previously</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                You previously reported: <strong>"{activeUserBlocker.title}: {activeUserBlocker.description}"</strong>. Is this now resolved?
              </div>
            </div>
            <button
              type="button"
              onClick={handleResolvePreviousBlocker}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#10b981',
                border: 'none',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
              }}
            >
              <Check size={13} />
              <span>Yes, Mark Resolved</span>
            </button>
          </div>
        )}

        {blockerResolvedNotice && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>Blocker marked as Resolved and removed from blocked tasks!</span>
          </div>
        )}

        {isSuccess ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
            }}
          >
            <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '6px' }}>
              Daily QA Report Submitted!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              QA Lead dashboard and daily team aggregation have been updated.
            </p>
          </div>
        ) : (
          <div>
            {/* Contextual Banner: Overdue / Blockers Rule Trigger */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-card)',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '6px', color: '#38bdf8' }}>
                {data.greeting}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Active tasks: <strong>{data.activeTasksCount}</strong> • Due today: <strong>{data.dueTodayTasksCount}</strong> • Retests: <strong>{data.retestBugsCount}</strong>
              </div>

              {/* Contextual Prompt questions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                {data.questions
                  .filter((q) => q.isContextual)
                  .map((q) => (
                    <div key={q.id} style={{ color: '#f59e0b', fontWeight: 600 }}>
                      {q.question}
                    </div>
                  ))}
              </div>
            </div>

            {/* Structured Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                {/* 1. What you worked on today */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                    1. What you worked on today
                  </label>
                  <textarea
                    value={todayWorkingOn}
                    onChange={(e) => setTodayWorkingOn(e.target.value)}
                    placeholder="Describe tasks, modules, test cases executed, API endpoints tested..."
                    style={{ width: '100%', minHeight: '52px', borderRadius: '8px', padding: '8px 12px' }}
                    required
                  />
                </div>

                {/* 2. Any blockers/challenges */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: isBlocked ? '#f43f5e' : 'var(--text-primary)' }}>
                      2. Any blockers/challenges
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', cursor: 'pointer', color: isBlocked ? '#f43f5e' : 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={isBlocked}
                        onChange={(e) => setIsBlocked(e.target.checked)}
                      />
                      <span>Active Blocker</span>
                    </label>
                  </div>
                  <textarea
                    value={blockers}
                    onChange={(e) => {
                      setBlockers(e.target.value);
                      if (e.target.value.trim().length > 0 && e.target.value.toLowerCase() !== 'none') {
                        setIsBlocked(true);
                      }
                    }}
                    placeholder="Specify any blockers/challenges, environment down, dependency stalled, or type None..."
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: isBlocked ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid var(--border-input)',
                    }}
                  />
                </div>

                {/* 3. risk you afraid of */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                    3. Risk you afraid of
                  </label>
                  <input
                    type="text"
                    value={risks}
                    onChange={(e) => setRisks(e.target.value)}
                    placeholder="Release risks, unstable third-party API, timeline pressure, or type None..."
                    style={{ width: '100%', borderRadius: '8px', padding: '8px 12px' }}
                  />
                </div>

                {/* 4. Next Plan */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    4. Next Plan
                  </label>
                  <input
                    type="text"
                    value={nextPlan}
                    onChange={(e) => setNextPlan(e.target.value)}
                    placeholder="Your next testing priority, test suite, or regression plan..."
                    style={{ width: '100%', borderRadius: '8px', padding: '8px 12px' }}
                    required
                  />
                </div>

                {/* 5. Major achievement today */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>
                    5. Major achievement today
                  </label>
                  <textarea
                    value={majorAchievement}
                    onChange={(e) => setMajorAchievement(e.target.value)}
                    placeholder="Key milestone, critical bug caught, regression completed, or None..."
                    style={{ width: '100%', minHeight: '48px', borderRadius: '8px', padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Send size={15} /> Submit Daily Report
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
