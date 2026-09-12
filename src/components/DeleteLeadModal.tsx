import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, UserMinus, ShieldAlert } from 'lucide-react';
import { User, CoreProject } from '../types';
import { ProjectService } from '../services/projectService';
import { StorageService } from '../services/storage';

interface DeleteLeadModalProps {
  leadToDelete: User;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteLeadModal: React.FC<DeleteLeadModalProps> = ({ leadToDelete, onClose, onDeleted }) => {
  const [ownedProjects, setOwnedProjects] = useState<CoreProject[]>([]);
  const [activeLeads, setActiveLeads] = useState<User[]>([]);
  
  // Mapping of CoreProject.id to newly selected User.id
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // 1. Find all Main Projects owned by this Lead
    const allCoreProjects = ProjectService.getCoreProjects();
    const owned = allCoreProjects.filter(cp => cp.qaLeadId === leadToDelete.id);
    setOwnedProjects(owned);

    // 2. Fetch all other Active QA Leads to allow reassignment
    const allUsers = StorageService.getUsers();
    const leads = allUsers.filter(u => u.role === 'QA Lead' && u.isActive && u.id !== leadToDelete.id);
    setActiveLeads(leads);
  }, [leadToDelete]);

  const handleReassignAll = async () => {
    // Ensure every owned project has a new lead selected
    const unassigned = ownedProjects.find(cp => !reassignments[cp.id]);
    if (unassigned) {
      setErrorMsg('Please select a new QA Lead for all listed Main Projects before continuing.');
      return;
    }

    setIsReassigning(true);
    setErrorMsg('');
    try {
      ownedProjects.forEach(cp => {
        const newLeadId = reassignments[cp.id];
        ProjectService.updateCoreProject(cp.id, { qaLeadId: newLeadId });
      });
      // Refresh local state to reflect reassignment
      setOwnedProjects([]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reassign projects.');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/users?id=${leadToDelete.id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete QA Lead.');
      }

      // Also update local storage to ensure immediate frontend reaction
      const users = StorageService.getUsers();
      const updatedUsers = users.map(u => {
        if (u.id === leadToDelete.id) {
          return { ...u, isActive: false, status: 'Inactive' as const };
        }
        return u;
      });
      
      // Also add to deleted list to prevent fetching again if we had a cloud sync issue
      const deletedIds = JSON.parse(localStorage.getItem('aegis_deleted_member_ids') || '[]');
      if (!deletedIds.includes(leadToDelete.id)) {
        deletedIds.push(leadToDelete.id);
        localStorage.setItem('aegis_deleted_member_ids', JSON.stringify(deletedIds));
      }
      
      StorageService.saveUsers(updatedUsers);

      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete QA Lead.');
    } finally {
      setIsDeleting(false);
    }
  };

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(6px)'
  };

  const contentStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '550px',
    padding: '32px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    color: 'var(--text-primary)'
  };

  const needsReassignment = ownedProjects.length > 0;

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e' }}>
            <UserMinus size={24} color="#f43f5e" /> Delete QA Lead
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        {needsReassignment ? (
          <div>
            <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', borderLeft: '4px solid #f59e0b', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#f59e0b', fontWeight: 700 }}>
                <AlertTriangle size={20} /> Action Blocked
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                This QA Lead currently owns <strong>{ownedProjects.length} Main Project{ownedProjects.length > 1 ? 's' : ''}</strong>. 
                Reassign all projects to another QA Lead before deleting this user to preserve all historical data and continuity.
              </p>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px', marginBottom: '24px' }}>
              {ownedProjects.map(cp => (
                <div key={cp.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', marginBottom: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '12px' }}>{cp.name}</div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Reassign to:
                  </label>
                  <select
                    value={reassignments[cp.id] || ''}
                    onChange={e => setReassignments(prev => ({ ...prev, [cp.id]: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-app)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Select Active QA Lead --</option>
                    {activeLeads.map(l => (
                      <option key={l.id} value={l.id}>{l.name} (@{l.username || 'unknown'})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={handleReassignAll}
                disabled={isReassigning}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  border: 'none',
                  cursor: isReassigning ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: isReassigning ? 0.7 : 1
                }}
              >
                {isReassigning ? 'Reassigning...' : 'Reassign All Projects'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ padding: '24px', background: 'rgba(244, 63, 94, 0.05)', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.2)', marginBottom: '32px', textAlign: 'center' }}>
              <ShieldAlert size={48} color="#f43f5e" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: '#f43f5e' }}>Confirm Deletion</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Are you sure you want to delete <strong>{leadToDelete.name}</strong>?<br/>
                This action cannot be undone. Their account will be deactivated, portal access revoked, and Telegram association removed. All historical records and check-ins will be preserved.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={onClose} disabled={isDeleting} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #e11d48, #be123c)',
                  color: '#fff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: isDeleting ? 0.7 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete QA Lead'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
