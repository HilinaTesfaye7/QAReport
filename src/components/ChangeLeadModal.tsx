import React, { useState } from 'react';
import { X, AlertTriangle, Users } from 'lucide-react';
import { User, Project } from '../types';

interface ChangeLeadModalProps {
  currentLead: User;
  allLeads: User[];
  projects: Project[];
  onClose: () => void;
  onConfirm: (newLeadId: string) => void;
}

export const ChangeLeadModal: React.FC<ChangeLeadModalProps> = ({ currentLead, allLeads, projects, onClose, onConfirm }) => {
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [confirmStep, setConfirmStep] = useState(false);

  const availableLeads = allLeads.filter(l => l.id !== currentLead.id && l.role === 'QA Lead' && l.isActive);
  const leadProjects = projects.filter(p => p.qaLeadId === currentLead.id);

  const handleNext = () => {
    if (selectedLead) setConfirmStep(true);
  };

  const handleSubmit = () => {
    if (selectedLead) onConfirm(selectedLead);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px',
        width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="#f59e0b" /> Change QA Lead
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {!confirmStep ? (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                You are about to reassign all <strong>{leadProjects.length} projects</strong> currently owned by <strong>{currentLead.name}</strong>. Please select the new QA Lead to transfer ownership.
              </p>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Select New QA Lead</label>
                <select
                  value={selectedLead}
                  onChange={(e) => setSelectedLead(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Choose Lead --</option>
                  {availableLeads.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={onClose}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={!selectedLead}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: selectedLead ? '#f59e0b' : 'var(--border-color)',
                    color: selectedLead ? '#000' : 'var(--text-muted)',
                    fontWeight: 700, cursor: selectedLead ? 'pointer' : 'not-allowed'
                  }}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
                <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 700 }}>Confirm Transfer</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Are you sure you want to transfer all projects and modules from <strong>{currentLead.name}</strong> to <strong>{availableLeads.find(l => l.id === selectedLead)?.name}</strong>?
                    <br/><br/>
                    This action will preserve all history, test cases, blockers, and check-ins, but will immediately notify both Leads via Telegram and shift ownership across the portal.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setConfirmStep(false)}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: '#f43f5e', color: '#fff',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Yes, Transfer Projects
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
