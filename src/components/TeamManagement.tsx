import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Award,
  BarChart2,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  ExternalLink,
  Shield,
  Clock,
  Filter,
} from 'lucide-react';
import { User, Project, MemberWorkload, DailyReport } from '../types';
import { StorageService } from '../services/storage';
import { WorkloadService } from '../services/workloadService';
import { DailyReportService } from '../services/dailyReportService';

interface TeamManagementProps {
  currentUser: User;
  onNavigateToProject?: (projectId: string) => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
  currentUser,
  onNavigateToProject,
}) => {
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());
  const [projects, setProjects] = useState<Project[]>(StorageService.getProjects());
  const [workloads, setWorkloads] = useState<MemberWorkload[]>(WorkloadService.getAllMembersWorkload());
  const [reports, setReports] = useState<DailyReport[]>(StorageService.getDailyReports());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'qa_lead' | 'qa_engineer' | 'tester'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New member form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'qa_engineer' | 'qa_lead'>('qa_engineer');
  const [newSkills, setNewSkills] = useState('Manual Testing, API Testing');
  const [newExp, setNewExp] = useState(3);
  const [selectedProjectId, setSelectedProjectId] = useState('prj-banking');

  const loadData = async () => {
    setUsers(StorageService.getUsers());
    setProjects(StorageService.getProjects());
    setWorkloads(WorkloadService.getAllMembersWorkload());
    const synced = await DailyReportService.syncTelegramReports();
    setReports(synced);

    // Also check if any Telegram users exist in telegram_profiles.json
    try {
      const res = await fetch('/telegram_profiles.json', { cache: 'no-cache' });
      if (res.ok) {
        const tgProfiles = await res.json();
        const existingUsers = StorageService.getUsers();
        let addedAny = false;

        for (const [chatId, p] of Object.entries(tgProfiles as Record<string, any>)) {
          const exists = existingUsers.some((u) => u.id === `usr-${chatId}` || u.name.toLowerCase() === p.fullName.toLowerCase());
          if (!exists && p.fullName) {
            existingUsers.push({
              id: `usr-${chatId}`,
              name: p.fullName,
              email: `${p.fullName.toLowerCase().replace(/\s+/g, '.')}@qa-aegis.com`,
              role: p.role?.toLowerCase().includes('lead') ? 'qa_lead' : 'qa_engineer',
              avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
              experienceYears: 2,
              skills: ['Manual Testing', 'Telegram Standup', 'Functional QA'],
              projectAllocations: [{ projectId: p.projectId || 'prj-banking', percentage: 100 }],
              onboardingCompleted: true,
            });
            addedAny = true;
          }
        }

        if (addedAny) {
          StorageService.saveUsers(existingUsers);
          setUsers(existingUsers);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const newMember: User = {
      id: `usr-${Date.now().toString(36)}`,
      name: newName,
      email: newEmail,
      role: newRole,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      experienceYears: newExp,
      skills: newSkills.split(',').map((s) => s.trim()).filter(Boolean) as any,
      projectAllocations: [{ projectId: selectedProjectId, percentage: 100 }],
      onboardingCompleted: true,
    };

    const updated = [...users, newMember];
    StorageService.saveUsers(updated);
    setUsers(updated);
    setIsAddModalOpen(false);
    setNewName('');
    setNewEmail('');
  };

  // Filter members
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL') {
      if (roleFilter === 'qa_lead' && u.role !== 'qa_lead') return false;
      if (roleFilter === 'qa_engineer' && u.role !== 'qa_engineer') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchSkills = u.skills.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchEmail && !matchSkills) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              QA Team & Personnel
            </h1>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Manage QA engineers, workload balance, project assignments, and check-in history.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
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
          <span>Add QA Member</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ padding: '16px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Team Size</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {users.length} Engineers
          </div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
            {users.filter((u) => u.role === 'qa_lead').length} Leads • {users.filter((u) => u.role !== 'qa_lead').length} Testers
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Projects</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {projects.length} Portfolios
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '2px' }}>
            100% allocation coverage
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Overloaded Status</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f43f5e', marginTop: '4px' }}>
            {workloads.filter((w) => w.classification === 'Overloaded').length} Members
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Attention recommended
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Check-Ins Today</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {reports.length} Reports
          </div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
            Synced with Telegram Bot
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Role Filters */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px' }}>
          {[
            { id: 'ALL', label: 'All Roles' },
            { id: 'qa_lead', label: 'QA Leads' },
            { id: 'qa_engineer', label: 'QA Engineers & Testers' },
          ].map((tab) => {
            const isActive = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member or skill..."
            style={{
              width: '100%',
              paddingLeft: '32px',
              paddingRight: '12px',
              paddingTop: '7px',
              paddingBottom: '7px',
              fontSize: '0.8rem',
              borderRadius: '8px',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Team Roster Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '18px',
        }}
      >
        {filteredUsers.map((member) => {
          const workload = workloads.find((w) => w.memberId === member.id) || {
            score: member.role === 'qa_lead' ? 82 : 65,
            classification: member.role === 'qa_lead' ? 'High' : 'Balanced',
          };

          const memberReports = reports.filter((r) => r.memberId === member.id || r.memberName?.toLowerCase() === member.name.toLowerCase());
          const latestStandup = memberReports[0];

          // Allocated projects
          const allocatedProjects = member.projectAllocations.map((alloc) => {
            const p = projects.find((proj) => proj.id === alloc.projectId);
            return {
              name: p ? p.name : alloc.projectId,
              percentage: alloc.percentage,
            };
          });

          return (
            <div
              key={member.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              }}
            >
              {/* Member Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={member.avatar}
                    alt={member.name}
                    style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #38bdf8' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} />
                      <span>{member.email}</span>
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    background: member.role === 'qa_lead' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: member.role === 'qa_lead' ? '#38bdf8' : '#a5b4fc',
                    border: member.role === 'qa_lead' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {member.role === 'qa_lead' ? 'QA LEAD' : 'QA ENGINEER'}
                </span>
              </div>

              {/* Skills Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {member.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Workload Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Capacity & Workload</span>
                  <strong style={{ color: workload.score > 85 ? '#f43f5e' : '#38bdf8' }}>
                    {workload.score}% ({workload.classification})
                  </strong>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${workload.score}%`,
                      background:
                        workload.score > 85
                          ? '#f43f5e'
                          : workload.score > 70
                          ? '#f59e0b'
                          : '#10b981',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>

              {/* Project Allocations */}
              <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Project Allocations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {allocatedProjects.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{p.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest Standup Box */}
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '10px 12px', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Latest Standup</span>
                  {latestStandup && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        background: latestStandup.source === 'telegram' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                        color: latestStandup.source === 'telegram' ? '#38bdf8' : '#a5b4fc',
                      }}
                    >
                      {latestStandup.source === 'telegram' ? '✈️ Telegram' : 'In-App'}
                    </span>
                  )}
                </div>
                {latestStandup ? (
                  <>
                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>Today:</strong> {latestStandup.todayWorkingOn || latestStandup.yesterdayCompleted}
                    </div>
                    <div style={{ marginTop: '2px', color: latestStandup.isBlocked ? '#f87171' : '#34d399', fontWeight: 600 }}>
                      {latestStandup.isBlocked ? `⚠️ Blocker: ${latestStandup.blockers}` : '🟢 Blockers: None'}
                    </div>
                  </>
                ) : (
                  <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No standup recorded today</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add QA Member */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Add QA Team Member</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleAddMember}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="alex.rivera@qa-aegis.com"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      style={{ width: '100%' }}
                    >
                      <option value="qa_engineer">QA Engineer</option>
                      <option value="qa_lead">QA Lead</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      value={newExp}
                      onChange={(e) => setNewExp(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Primary Project Assignment
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Skills (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={newSkills}
                    onChange={(e) => setNewSkills(e.target.value)}
                    placeholder="Manual Testing, Playwright, API Testing"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
