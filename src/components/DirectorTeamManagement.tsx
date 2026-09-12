import React, { useState, useEffect } from 'react';
import { User, Project, MemberWorkload, Blocker } from '../types';
import { StorageService } from '../services/storage';
import { WorkloadService } from '../services/workloadService';
import { Users, Plus, Edit, Shield, FolderKanban } from 'lucide-react';
import { NotificationService } from '../services/notificationService';

interface DirectorTeamManagementProps {
  currentUser: User;
}

export const DirectorTeamManagement: React.FC<DirectorTeamManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workloads, setWorkloads] = useState<MemberWorkload[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAssignProjectsOpen, setIsAssignProjectsOpen] = useState(false);
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<User | null>(null);
  
  // New Lead Form State
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newTelegram, setNewTelegram] = useState('');

  // Assign Projects Form State
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);

  const loadData = () => {
    setUsers(StorageService.getUsers());
    setProjects(StorageService.getProjects());
    setWorkloads(WorkloadService.getAllMembersWorkload());
    setBlockers(StorageService.getBlockers());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('aegis_storage_change', loadData);
    return () => window.removeEventListener('aegis_storage_change', loadData);
  }, []);

  const qaLeads = users.filter(u => u.role === 'QA Lead');

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newFullName,
          username: newUsername,
          password: newPassword,
          role: 'QA Lead',
          is_active: newIsActive,
          must_change_password: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create QA Lead');
      }

      const createdUser = await response.json();
      
      // Real app would refetch from backend. Let's refetch users:
      const res2 = await fetch('/api/users');
      if (res2.ok) {
        const fetchedUsers = await res2.json();
        // map backend users to frontend type
        const updatedUsers = fetchedUsers.map((u: any) => ({
          ...u,
          name: u.full_name || u.name,
          mustChangePassword: u.must_change_password,
          isActive: u.is_active
        }));
        StorageService.saveUsers(updatedUsers);
      } else {
         // Fallback manual update
         const currentUsers = StorageService.getUsers();
         currentUsers.push({
           ...createdUser,
           name: createdUser.full_name,
           mustChangePassword: createdUser.must_change_password,
           isActive: createdUser.is_active
         });
         StorageService.saveUsers(currentUsers);
      }
      
      if (newTelegram) {
        NotificationService.dispatch({
          recipientId: createdUser.id,
          title: 'Welcome to AegisQA',
          message: `Hello ${newFullName}, your QA Lead account has been created.\nUsername: ${newUsername}\nPassword: ${newPassword}\nPlease login and change your password.`,
          type: 'announcement'
        });
      }

      loadData();
      setIsAddLeadOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewPassword('');
      setNewTelegram('');
    } catch (e) {
      console.error(e);
      alert('Error creating lead');
    }
  };

  const handleOpenAssign = (lead: User) => {
    setSelectedLeadForAssign(lead);
    const currentlyAssigned = projects.filter(p => p.qaLeadId === lead.id || (p as any).qa_lead_id === lead.id).map(p => p.id);
    setAssignedProjectIds(currentlyAssigned);
    setIsAssignProjectsOpen(true);
  };

  const handleToggleAssignProject = (projectId: string) => {
    setAssignedProjectIds(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSaveAssignments = async () => {
    if (!selectedLeadForAssign) return;

    try {
      // 1. Find projects to update
      const projectsToUpdate = [];
      const updatedProjects = [...projects];

      updatedProjects.forEach(p => {
        // Was assigned, now unassigned
        if ((p.qaLeadId === selectedLeadForAssign.id || (p as any).qa_lead_id === selectedLeadForAssign.id) && !assignedProjectIds.includes(p.id)) {
           p.qaLeadId = 'unassigned';
           projectsToUpdate.push(p);
        }
        // Newly assigned
        else if (assignedProjectIds.includes(p.id) && p.qaLeadId !== selectedLeadForAssign.id && (p as any).qa_lead_id !== selectedLeadForAssign.id) {
          p.qaLeadId = selectedLeadForAssign.id;
          projectsToUpdate.push(p);
        }
      });

      if (projectsToUpdate.length > 0) {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectsToUpdate)
        });

        if (!response.ok) {
          throw new Error('Failed to assign projects on backend');
        }
      }

      StorageService.saveProjects(updatedProjects);
      loadData();
      setIsAssignProjectsOpen(false);
      setSelectedLeadForAssign(null);
    } catch (e) {
      console.error(e);
      alert('Error assigning projects');
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>QA Leadership</h1>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Manage QA Leads, assign projects, and oversee leadership portfolio performance.
          </p>
        </div>

        <button
          onClick={() => setIsAddLeadOpen(true)}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 18px',
            fontSize: '0.84rem',
            fontWeight: 700,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
          }}
        >
          <Plus size={16} />
          <span>Add QA Lead</span>
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>QA Lead</th>
              <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Username</th>
              <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Projects</th>
              <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Team Size</th>
              <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {qaLeads.map(lead => {
              const leadProjects = projects.filter(p => p.qaLeadId === lead.id || (p as any).qa_lead_id === lead.id);
              const totalProjects = leadProjects.length;
              
              const teamMembers = new Set<string>();
              leadProjects.forEach(p => {
                const pMembers = Array.isArray(p.memberIds) ? p.memberIds : (p as any).member_ids || [];
                pMembers.forEach((m: string) => teamMembers.add(m));
              });
              const teamSize = teamMembers.size;

              return (
                <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>{lead.name}</td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>@{lead.username || lead.email?.split('@')[0]}</td>
                  <td style={{ padding: '16px', color: 'var(--text-primary)' }}>{totalProjects}</td>
                  <td style={{ padding: '16px', color: 'var(--text-primary)' }}>{teamSize}</td>
                  <td style={{ padding: '16px' }}>
                    <button 
                      onClick={() => handleOpenAssign(lead)}
                      style={{ 
                        background: 'transparent', 
                        border: '1px solid var(--border-subtle)', 
                        padding: '6px 12px', 
                        borderRadius: '6px', 
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <FolderKanban size={14} />
                      Assign Projects
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '40px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>QA Testers Workload</h2>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>QA Tester</th>
                <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Role</th>
                <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Workload</th>
                <th style={{ padding: '14px 16px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.role === 'QA Tester' || u.role === 'Automation QA Engineer').map(tester => {
                const wl = workloads.find((w) => w.memberId === tester.id) || { score: 0, classification: 'Balanced' };
                const badgeColor =
                  wl.classification === 'Overloaded'
                    ? '#f43f5e'
                    : wl.classification === 'High'
                    ? '#f59e0b'
                    : wl.classification === 'Balanced'
                    ? '#38bdf8'
                    : '#10b981';

                return (
                  <tr key={tester.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>{tester.name}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{tester.role}</td>
                    <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, maxWidth: '100px', height: '6px', background: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(wl.score, 100)}%`, background: badgeColor, borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{wl.score}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 10px', background: `${badgeColor}15`, color: badgeColor, borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {wl.classification}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isAddLeadOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Add QA Lead</h2>
              <button onClick={() => setIsAddLeadOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Full Name</label>
                <input type="text" value={newFullName} onChange={e => setNewFullName(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'white' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Username</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'white' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Temporary Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'white' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>User will be required to change this upon first login.</span>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Telegram Username (Optional)</label>
                <input type="text" placeholder="@username" value={newTelegram} onChange={e => setNewTelegram(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'white' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Role</label>
                <input type="text" value="QA Lead" disabled style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }} />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={newIsActive} onChange={e => setNewIsActive(e.target.checked)} />
                  Active Account
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsAddLeadOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create QA Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignProjectsOpen && selectedLeadForAssign && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '440px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Assign Projects</h2>
              <button onClick={() => setIsAssignProjectsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select existing projects to assign to <strong>{selectedLeadForAssign.name}</strong>.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
               {projects.map(p => (
                 <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                   <input 
                     type="checkbox" 
                     checked={assignedProjectIds.includes(p.id)}
                     onChange={() => handleToggleAssignProject(p.id)}
                   />
                   <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                 </label>
               ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAssignProjectsOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveAssignments} className="btn-primary">Save Assignments</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
