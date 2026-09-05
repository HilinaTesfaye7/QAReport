import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Edit3,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Palette,
  Send,
  Globe,
  Clock,
  Plus,
  FolderKanban,
  Check,
  ChevronRight,
  Shield,
  Sparkles,
  Layers,
  UserMinus,
} from 'lucide-react';
import { Project, User, DailyReport } from '../types';
import { StorageService } from '../services/storage';
import { DailyReportService } from '../services/dailyReportService';
import { ProjectService } from '../services/projectService';
import { NotificationService } from '../services/notificationService';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectDetailViewProps {
  project: Project;
  allProjects?: Project[];
  currentUser: User;
  onBackToProjects: () => void;
  onSelectProject?: (id: string) => void;
  onOpenCheckIn?: () => void;
  onOpenCreateProject?: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  allProjects,
  currentUser,
  onBackToProjects,
  onSelectProject,
  onOpenCheckIn,
  onOpenCreateProject,
}) => {
  // Streamlined tabs: PRD, Design (Figma), Members, and Standups
  const [activeTab, setActiveTab] = useState<'prd' | 'figma' | 'members' | 'standups'>('prd');
  const [reports, setReports] = useState<DailyReport[]>(StorageService.getDailyReports());
  const [isUpdatingVelocity, setIsUpdatingVelocity] = useState(false);
  const [progressVal, setProgressVal] = useState(project.qaProgress);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Add Member inline modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>('');
  const [memberToast, setMemberToast] = useState<string | null>(null);

  const isLead = currentUser.role === 'qa_lead';
  const projectsList = allProjects || StorageService.getProjects();
  const allUsers = StorageService.getUsers();
  const projectMembers = allUsers.filter((u) => project.memberIds.includes(u.id));
  const leadUser = allUsers.find((u) => u.id === project.qaLeadId);

  // Users not yet on this project
  const availableUsersToAdd = allUsers.filter((u) => !project.memberIds.includes(u.id));

  // Sync Telegram reports
  useEffect(() => {
    DailyReportService.syncTelegramReports().then((synced) => {
      setReports(synced);
    });

    const handleStorage = () => {
      setReports(DailyReportService.getDailyReports());
    };
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, [project.id]);

  useEffect(() => {
    setProgressVal(project.qaProgress);
  }, [project.qaProgress]);

  // Filter standups for this project
  const projectStandups = reports.filter(
    (r) =>
      r.projectId === project.id ||
      r.projectName?.toLowerCase() === project.name.toLowerCase()
  );

  const handleSaveVelocity = () => {
    const all = StorageService.getProjects();
    const target = all.find((p) => p.id === project.id);
    if (target) {
      target.qaProgress = progressVal;
      StorageService.saveProjects(all);
    }
    setIsUpdatingVelocity(false);
  };

  const handleAssignNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberToAdd) return;

    try {
      const updatedProj = ProjectService.assignMember(project.id, selectedMemberToAdd, currentUser.id);
      const targetUser = allUsers.find((u) => u.id === selectedMemberToAdd);
      const memberName = targetUser ? targetUser.name : 'QA Member';

      // Explicitly notify member
      NotificationService.notifyProjectAssignment(
        updatedProj,
        selectedMemberToAdd,
        currentUser.id,
        'You have been added to the QA Squad for this project.'
      );

      setMemberToast(`Assigned ${memberName} to ${project.name} and dispatched assignment notification!`);
      setIsAddMemberOpen(false);
      setSelectedMemberToAdd('');

      setTimeout(() => setMemberToast(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error assigning member');
    }
  };

  const handleUnassignMember = (memberId: string) => {
    try {
      ProjectService.unassignMember(project.id, memberId, currentUser.id);
      const targetUser = allUsers.find((u) => u.id === memberId);
      const memberName = targetUser ? targetUser.name : 'QA Member';
      setMemberToast(`Removed ${memberName} from this project squad.`);
      setTimeout(() => setMemberToast(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error unassigning member');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Top Bar: Back Button, Projects List Chips ("beside the list of the projects"), and Add Project Button */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={onBackToProjects}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#38bdf8';
              e.currentTarget.style.color = '#38bdf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <ArrowLeft size={14} />
            <span>All Projects Table</span>
          </button>

          {/* Quick Projects Switcher List beside details */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 6px',
              borderRadius: '10px',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              overflowX: 'auto',
              maxWidth: '65vw',
            }}
          >
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0 6px', textTransform: 'uppercase' }}>
              Projects:
            </span>
            {projectsList.map((p) => {
              const isCurrent = p.id === project.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject && onSelectProject(p.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: isCurrent ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                    border: isCurrent ? '1px solid #38bdf8' : '1px solid transparent',
                    color: isCurrent ? '#38bdf8' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: isCurrent ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: isCurrent ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                      color: isCurrent ? '#0b0f19' : 'var(--text-muted)',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.name[0]}
                  </span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Portal Administrator "+ Add Project" Action */}
        {isLead && (
          <button
            onClick={onOpenCreateProject || (() => setIsCreateModalOpen(true))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            }}
          >
            <Plus size={15} />
            <span>Add Project</span>
          </button>
        )}
      </div>

      {/* Member assignment confirmation banner */}
      {memberToast && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.16)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{memberToast}</span>
        </div>
      )}

      {/* Project Hero Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Title Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {project.name}
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                {project.status === 'Testing' ? 'ACTIVE' : project.status.toUpperCase()}
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                {currentUser.role === 'qa_lead' ? 'QA LEAD' : 'QA ENGINEER'}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '850px', lineHeight: 1.5 }}>
              {project.description}
            </p>
          </div>

          <button
            onClick={() => setIsUpdatingVelocity(!isUpdatingVelocity)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Edit3 size={14} />
            <span>Update Velocity</span>
          </button>
        </div>

        {/* Velocity editor popup */}
        {isUpdatingVelocity && (
          <div style={{ padding: '12px', background: 'var(--bg-card-subtle)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>QA Delivery Progress:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progressVal}
              onChange={(e) => setProgressVal(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8', minWidth: '40px' }}>
              {progressVal}%
            </span>
            <button onClick={handleSaveVelocity} className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.76rem' }}>
              Save
            </button>
          </div>
        )}

        {/* Delivery Progress Bar */}
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Delivery Progress</span>
            <strong style={{ color: '#38bdf8', fontWeight: 800 }}>{progressVal}%</strong>
          </div>
          <div style={{ height: '7px', width: '100%', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)' }}>
            <div
              style={{
                height: '100%',
                width: `${progressVal}%`,
                background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Metadata Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Project Manager / QA Lead:</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
              {leadUser ? leadUser.name : 'Sarah Jenkins'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Product Owner:</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
              {project.projectOwner || 'David Chen (VP Product)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Start Date:</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
              {project.startDate || '2026-08-01'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Target Delivery:</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8', marginTop: '2px' }}>
              {project.targetReleaseDate || '2026-09-12'}
            </div>
          </div>
        </div>
      </div>

      {/* Streamlined Sub-Tabs Navigation (PRD, Design, Members, Standups) */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '2px',
          marginBottom: '20px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'prd', label: 'PRD & Specs', icon: FileText },
          { id: 'figma', label: 'Design (Figma)', icon: Palette },
          { id: 'members', label: `Members (${projectMembers.length})`, icon: Users },
          { id: 'standups', label: `Daily Standups (${projectStandups.length})`, icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                background: isActive ? '#1e293b' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? '#38bdf8' : 'currentColor'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: PRD & FUNCTIONAL SPECIFICATIONS */}
      {activeTab === 'prd' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {project.resources.prdTitle || `${project.name} Product Requirements Document`}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Requirements baseline & acceptance criteria for QA test planning
              </p>
            </div>

            {project.resources.prdUrl && (
              <a
                href={project.resources.prdUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                <span>Open External Document</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* PRD Content */}
          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.86rem',
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
            }}
          >
            {project.resources.prdContent || 'No PRD specifications provided.'}
          </div>

          {/* Acceptance Criteria Chips */}
          {project.resources.requirements && project.resources.requirements.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                Key Acceptance Requirements
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {project.resources.requirements.map((req, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{req}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                      Verified Scope
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DESIGN (FIGMA SPECS) */}
      {activeTab === 'figma' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {project.resources.figmaPreviewTitle || 'Figma UI/UX Specifications'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Interactive prototype, design tokens, and UI state models
              </p>
            </div>

            {project.resources.figmaUrl && (
              <a
                href={project.resources.figmaUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#c084fc',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                }}
              >
                <span>Open in Figma</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Interactive Prototype Mock Container */}
          <div
            style={{
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: '#090d16',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '260px',
              marginBottom: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                marginBottom: '12px',
                boxShadow: '0 8px 24px rgba(168, 85, 247, 0.3)',
              }}
            >
              <Palette size={26} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {project.resources.figmaName || `${project.name} UI Prototype`}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '520px', marginBottom: '16px' }}>
              {project.resources.figmaDescription || 'Auto-layout design tokens with mobile and desktop responsive viewport specifications.'}
            </div>
            {project.resources.figmaUrl && (
              <a
                href={project.resources.figmaUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Launch Interactive Prototype</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong>QA Design Tokens Reference:</strong> Ensure spacing matches 8pt baseline grid. All biometric auth modal flows, error states, and network disconnection banners are specified in the Figma canvas.
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MEMBERS & SQUAD (WITH NOTIFICATION STATUS) */}
      {activeTab === 'members' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Assigned QA Team Squad
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                All assigned members receive automatic In-App & Telegram notifications
              </p>
            </div>

            {isLead && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                <Plus size={15} />
                <span>Assign QA Member & Notify</span>
              </button>
            )}
          </div>

          {/* Members Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {projectMembers.map((m) => {
              const isTelegram = m.name.toLowerCase() === 'coco' || m.id.includes('347835367');
              return (
                <div
                  key={m.id}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={m.avatar}
                        alt={m.name}
                        style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #38bdf8' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{m.email}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: m.role === 'qa_lead' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: m.role === 'qa_lead' ? '#a5b4fc' : '#38bdf8',
                          border: m.role === 'qa_lead' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        {m.role === 'qa_lead' ? 'QA Lead' : 'QA Engineer'}
                      </span>
                      {isLead && m.id !== currentUser.id && (
                        <button
                          onClick={() => handleUnassignMember(m.id)}
                          title={`Unassign ${m.name} from this project`}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <UserMinus size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Skills tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {m.skills.slice(0, 3).map((s, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Notification Status Badge */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 700 }}>
                      <CheckCircle2 size={13} />
                      <span>Notified & Synced</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        ✓ In-App
                      </span>
                      {isTelegram && (
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                          }}
                        >
                          ✈️ Telegram
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal to Assign New Member & Notify */}
          {isAddMemberOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(3, 7, 18, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 110,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle)',
                  padding: '24px',
                  width: '100%',
                  maxWidth: '460px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Assign QA Member to {project.name}
                  </h3>
                  <button onClick={() => setIsAddMemberOpen(false)} style={{ color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAssignNewMember}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Select an unassigned QA team member. They will receive an instant assignment notification via In-App alert and Telegram bot message.
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Available QA Members:
                    </label>
                    {availableUsersToAdd.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-card-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        All team members are already assigned to this project squad.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {availableUsersToAdd.map((u) => {
                          const isSelected = selectedMemberToAdd === u.id;
                          return (
                            <div
                              key={u.id}
                              onClick={() => setSelectedMemberToAdd(u.id)}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'var(--bg-card-subtle)',
                                border: isSelected ? '1.5px solid #38bdf8' : '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img src={u.avatar} alt={u.name} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>{u.name}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.role === 'qa_lead' ? 'QA Lead' : 'QA Engineer'}</div>
                                </div>
                              </div>
                              <input type="radio" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer' }} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsAddMemberOpen(false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedMemberToAdd}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: selectedMemberToAdd ? 'pointer' : 'not-allowed',
                        opacity: selectedMemberToAdd ? 1 : 0.6,
                      }}
                    >
                      Assign & Notify
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: DAILY STANDUPS */}
      {activeTab === 'standups' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Daily Team Standups & Check-ins
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                Live responses submitted via Telegram Bot (<code>@QAEaglebot</code>) and Web Command Center
              </p>
            </div>

            {onOpenCheckIn && (
              <button
                onClick={onOpenCheckIn}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} />
                <span>Submit Daily Standup</span>
              </button>
            )}
          </div>

          {projectStandups.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              No standups recorded yet for {project.name}. Team members can submit using <code>/checkin</code> on Telegram.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '180px' }}>
                      Team Member
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '130px' }}>
                      Source & Time
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      1. Accomplishments
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      2. Next Priorities
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      3. Blockers & Risks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectStandups.map((standup) => (
                    <tr
                      key={standup.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {(standup.memberName || 'Q')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                              {standup.memberName || 'QA Tester'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 700 }}>
                              {(standup.role || 'QA_ENGINEER').toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            background: standup.source === 'telegram' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                            color: standup.source === 'telegram' ? '#38bdf8' : '#a5b4fc',
                            border: standup.source === 'telegram' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                          }}
                        >
                          {standup.source === 'telegram' ? '✈️ Telegram' : '📋 In-App'}
                        </span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {standup.submittedAt ? new Date(standup.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : standup.date}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {standup.yesterdayCompleted || '—'}
                      </td>

                      <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {standup.todayWorkingOn || '—'}
                      </td>

                      <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.78rem', lineHeight: 1.4 }}>
                        {standup.isBlocked ? (
                          <div style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={13} />
                            <span>{standup.blockers || 'Blocked'}</span>
                          </div>
                        ) : (
                          <div style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>🟢</span>
                            <span>None, everything is running smoothly</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Portal Administrator Create Project Modal */}
      {isCreateModalOpen && (
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUser={currentUser}
          onProjectCreated={(newProj) => {
            if (onSelectProject) onSelectProject(newProj.id);
          }}
        />
      )}
    </div>
  );
};
