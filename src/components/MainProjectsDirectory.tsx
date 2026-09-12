import React, { useState, useEffect } from 'react';
import { FolderKanban } from 'lucide-react';
import { User, Project, CoreProject } from '../types';
import { ProjectService } from '../services/projectService';
import { CreateCoreProjectModal } from './CreateCoreProjectModal';
import { ChangeLeadModal } from './ChangeLeadModal';

interface MainProjectsDirectoryProps {
  currentUser: User;
}

export const MainProjectsDirectory: React.FC<MainProjectsDirectoryProps> = ({
  currentUser,
}) => {
  const [coreProjects, setCoreProjects] = useState<CoreProject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateCoreOpen, setIsCreateCoreOpen] = useState(false);
  const [selectedCoreProjectForLeadChange, setSelectedCoreProjectForLeadChange] = useState<string | null>(null);

  useEffect(() => {
    setCoreProjects(ProjectService.getCoreProjects());
    
    // Also fetch users and projects from StorageService since we need them
    import('../services/storage').then(({ StorageService }) => {
      setUsers(StorageService.getUsers());
      setProjects(StorageService.getProjects());
    });
  }, []);

  const refreshCoreProjects = () => {
    setCoreProjects(ProjectService.getCoreProjects());
  };

  const cardStyle = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ ...cardStyle, marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={20} color="#38bdf8" />
              Main Projects Directory
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Top-level projects (Core Projects). QA Leads manage the subprojects under them.
            </p>
          </div>
          <button
            onClick={() => setIsCreateCoreOpen(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Create Main Project
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {coreProjects.map((cp) => {
            const lead = users.find((u) => u.id === cp.qaLeadId);
            const subprojectCount = projects.filter(p => p.coreProjectId === cp.id).length;
            
            return (
              <div
                key={cp.id}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cp.name}</h3>
                  <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '6px', fontWeight: 600 }}>
                    {cp.status}
                  </span>
                </div>
                
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {cp.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#38bdf8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                      {lead?.name.charAt(0) || '?'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>QA Lead</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{lead?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                  
                  {currentUser.role === 'QA Director' && (
                    <button
                      onClick={() => setSelectedCoreProjectForLeadChange(cp.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Change Lead
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <FolderKanban size={12} /> {subprojectCount} Subprojects
                </div>
              </div>
            );
          })}
          {coreProjects.length === 0 && (
             <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '20px 0' }}>No Main Projects exist yet.</div>
          )}
        </div>
      </div>

      {selectedCoreProjectForLeadChange && (
        <ChangeLeadModal
          onClose={() => setSelectedCoreProjectForLeadChange(null)}
          currentLead={users.find(u => u.id === coreProjects.find(cp => cp.id === selectedCoreProjectForLeadChange)?.qaLeadId) || users[0]}
          allLeads={users}
          projects={projects.filter(p => p.coreProjectId === selectedCoreProjectForLeadChange)}
          onConfirm={(newLeadId) => {
            ProjectService.updateCoreProject(selectedCoreProjectForLeadChange, { qaLeadId: newLeadId });
            refreshCoreProjects();
            setSelectedCoreProjectForLeadChange(null);
          }}
        />
      )}

      <CreateCoreProjectModal
        isOpen={isCreateCoreOpen}
        onClose={() => setIsCreateCoreOpen(false)}
        users={users}
        onProjectCreated={refreshCoreProjects}
      />
    </div>
  );
};
