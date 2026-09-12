import React, { useState, useEffect } from 'react';
import { X, FolderKanban, Plus } from 'lucide-react';
import { User, CoreProject } from '../types';
import { ProjectService } from '../services/projectService';
import { StorageService } from '../services/storage';

interface AssignPendingLeadModalProps {
  pendingLead: User;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignPendingLeadModal: React.FC<AssignPendingLeadModalProps> = ({ pendingLead, onClose, onAssigned }) => {
  const [coreProjects, setCoreProjects] = useState<CoreProject[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedCoreProjectId, setSelectedCoreProjectId] = useState<string>('');
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setCoreProjects(ProjectService.getCoreProjects());
  }, []);

  const handleAssign = async () => {
    setErrorMsg('');
    let finalProjectName = '';

    if (isCreatingNew) {
      if (!newProjectName.trim()) {
        setErrorMsg('Please provide a name for the new Main Project.');
        return;
      }
      finalProjectName = newProjectName.trim();
    } else {
      if (!selectedCoreProjectId) {
        setErrorMsg('Please select a Main Project.');
        return;
      }
      const cp = coreProjects.find(c => c.id === selectedCoreProjectId);
      if (!cp) return;
      finalProjectName = cp.name;
    }

    setIsLoading(true);
    try {
      // Extract telegram Chat ID from user ID (e.g. usr-123456 -> 123456)
      const telegramChatId = pendingLead.id.replace('usr-', '');
      
      const res = await fetch('/api/assign-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telegramChatId,
          mainProjectName: finalProjectName
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign lead');
      }

      const data = await res.json();
      
      // Update local storage
      let targetCoreProjectId = selectedCoreProjectId;
      if (isCreatingNew) {
        const newCp = ProjectService.createCoreProject(newProjectName.trim(), newProjectDesc.trim(), data.user.id);
        targetCoreProjectId = newCp.id;
      } else {
        ProjectService.updateCoreProject(targetCoreProjectId, { qaLeadId: data.user.id });
      }

      // We need to sync users locally so the new user appears Active immediately
      await StorageService.syncUsersWithCloud();

      onAssigned();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  };

  const contentStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '500px',
    padding: '24px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    color: 'var(--text-primary)'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    background: 'rgba(0,0,0,0.2)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    marginBottom: '16px'
  };

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderKanban color="#38bdf8" /> Assign Main Project
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>Pending QA Lead</h4>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            <strong>{pendingLead.name}</strong> will receive their portal credentials in Telegram once assigned to a Main Project.
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setIsCreatingNew(false)}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
              background: !isCreatingNew ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: '1px solid', borderColor: !isCreatingNew ? 'var(--border-color)' : 'transparent',
              color: !isCreatingNew ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600
            }}
          >
            Select Existing
          </button>
          <button
            onClick={() => setIsCreatingNew(true)}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              background: isCreatingNew ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: '1px solid', borderColor: isCreatingNew ? 'var(--border-color)' : 'transparent',
              color: isCreatingNew ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600
            }}
          >
            <Plus size={16} /> Create New
          </button>
        </div>

        {!isCreatingNew ? (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Main Project</label>
            <select
              value={selectedCoreProjectId}
              onChange={(e) => setSelectedCoreProjectId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Choose a Main Project --</option>
              {coreProjects.map(cp => (
                <option key={cp.id} value={cp.id}>{cp.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>New Main Project Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. Dashen, CBE"
              style={inputStyle}
            />
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description (Optional)</label>
            <textarea
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="Brief description of the main project"
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }} disabled={isLoading}>
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={isLoading}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Assigning...' : 'Assign & Notify Lead'}
          </button>
        </div>
      </div>
    </div>
  );
};
