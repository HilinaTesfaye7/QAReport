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
  Trash2,
  Copy,
  ListChecks,
} from 'lucide-react';
import { Project, User, DailyReport } from '../types';
import { StorageService } from '../services/storage';
import { DailyReportService } from '../services/dailyReportService';
import { ProjectService } from '../services/projectService';
import { NotificationService } from '../services/notificationService';
import { AuthService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
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
  // Streamlined tabs: PRD, Design (Figma), Test Cases, Members, and Standups
  const [activeTab, setActiveTab] = useState<'prd' | 'figma' | 'testcases' | 'members' | 'standups'>('prd');
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [reports, setReports] = useState<DailyReport[]>(DailyReportService.getDailyReports());
  const [isUpdatingVelocity, setIsUpdatingVelocity] = useState(false);
  const [progressVal, setProgressVal] = useState(project.qaProgress);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await ProjectService.deleteProject(currentProject.id, currentUser.id);
      setIsDeleteModalOpen(false);
      onBackToProjects();
    } catch (err: any) {
      console.error('Error deleting project:', err);
      alert(err?.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add Member inline modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>('');
  const [memberToast, setMemberToast] = useState<string | null>(null);

  // Figma Link States & Handler
  const [isEditingFigmaUrl, setIsEditingFigmaUrl] = useState(false);
  const [editFigmaUrlVal, setEditFigmaUrlVal] = useState(project.resources?.figmaUrl || '');
  const [isCopiedFigma, setIsCopiedFigma] = useState(false);

  // Test Case Link States & Handler
  const [isEditingTestCaseUrl, setIsEditingTestCaseUrl] = useState(false);
  const [editTestCaseUrlVal, setEditTestCaseUrlVal] = useState(project.resources?.testCaseUrl || '');
  const [isCopiedTestCase, setIsCopiedTestCase] = useState(false);

  const isLead = AuthService.isQALead(currentUser);
  const projectsList = allProjects || StorageService.getProjects();
  const allUsers = StorageService.getUsers();
  const projectMembers = allUsers.filter((u) => currentProject.memberIds.includes(u.id));
  const leadUser = allUsers.find((u) => u.id === currentProject.qaLeadId);

  // Users not yet on this project
  const availableUsersToAdd = allUsers.filter((u) => !currentProject.memberIds.includes(u.id));

  useEffect(() => {
    setCurrentProject(project);
    setProgressVal(project.qaProgress);
  }, [project]);

  // Sync Telegram reports
  useEffect(() => {
    DailyReportService.syncTelegramReports().then((synced) => {
      setReports(synced);
    });

    const handleStorage = () => {
      setReports(DailyReportService.getDailyReports());
      const fresh = StorageService.getProjects().find((p) => p.id === currentProject.id);
      if (fresh) setCurrentProject(fresh);
    };
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, [currentProject.id]);

  useEffect(() => {
    setProgressVal(currentProject.qaProgress);
  }, [currentProject.qaProgress]);

  // Filter standups for this project
  const projectStandups = reports.filter(
    (r) =>
      r.projectId === currentProject.id ||
      r.projectName?.toLowerCase() === currentProject.name.toLowerCase()
  );

  const handleSaveVelocity = () => {
    const all = StorageService.getProjects();
    const target = all.find((p) => p.id === currentProject.id);
    if (target) {
      target.qaProgress = progressVal;
      StorageService.saveProjects(all);
      setCurrentProject({ ...target });
    }
    setIsUpdatingVelocity(false);
  };

  const handleAssignNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberToAdd) return;

    try {
      const updatedProj = ProjectService.assignMember(currentProject.id, selectedMemberToAdd, currentUser.id);
      setCurrentProject({ ...updatedProj });
      const targetUser = allUsers.find((u) => u.id === selectedMemberToAdd);
      const memberName = targetUser ? targetUser.name : 'QA Member';

      // Explicitly notify member
      NotificationService.notifyProjectAssignment(
        updatedProj,
        selectedMemberToAdd,
        currentUser.id,
        'Please prepare the test cases and submit them using /testcase'
      );

      setMemberToast(`Assigned ${memberName} to ${currentProject.name} and dispatched assignment notification!`);
      setIsAddMemberOpen(false);
      setSelectedMemberToAdd('');

      setTimeout(() => setMemberToast(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error assigning member');
    }
  };

  const handleUnassignMember = (memberId: string) => {
    try {
      const updatedProj = ProjectService.unassignMember(currentProject.id, memberId, currentUser.id);
      setCurrentProject({ ...updatedProj });
      const targetUser = allUsers.find((u) => u.id === memberId);
      const memberName = targetUser ? targetUser.name : 'QA Member';
      setMemberToast(`Removed ${memberName} from this project squad.`);
      setTimeout(() => setMemberToast(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error unassigning member');
    }
  };

  const handleSaveFigmaUrl = async () => {
    const trimmed = editFigmaUrlVal.trim();
    if (!trimmed) return;

    const all = StorageService.getProjects();
    const target = all.find((p) => p.id === currentProject.id);
    if (target) {
      target.resources = {
        ...target.resources,
        figmaUrl: trimmed,
      };
      StorageService.saveProjects(all);
      setCurrentProject({ ...target });
    }

    try {
      ProjectService.updateProject(
        currentProject.id,
        { resources: { ...currentProject.resources, figmaUrl: trimmed } },
        currentUser.id
      );
    } catch {}

    if (supabase) {
      try {
        await supabase
          .from('projects')
          .update({
            resources: { ...currentProject.resources, figmaUrl: trimmed },
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentProject.id);
      } catch (err) {
        console.warn('Supabase figmaUrl update error:', err);
      }
    }

    setIsEditingFigmaUrl(false);
  };

  useEffect(() => {
    setEditFigmaUrlVal(currentProject.resources?.figmaUrl || '');
  }, [currentProject.resources?.figmaUrl]);

  const handleSaveTestCaseUrl = async () => {
    const trimmed = editTestCaseUrlVal.trim();
    if (!trimmed) return;

    const all = StorageService.getProjects();
    const target = all.find((p) => p.id === currentProject.id);
    if (target) {
      target.resources = {
        ...target.resources,
        testCaseUrl: trimmed,
        testCaseTitle: target.resources?.testCaseTitle || 'Test Cases',
      };
      StorageService.saveProjects(all);
      setCurrentProject({ ...target });
    }

    try {
      ProjectService.updateProject(
        currentProject.id,
        { resources: { ...currentProject.resources, testCaseUrl: trimmed } },
        currentUser.id
      );
    } catch {}

    if (supabase) {
      try {
        await supabase
          .from('projects')
          .update({
            resources: { ...currentProject.resources, testCaseUrl: trimmed },
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentProject.id);
      } catch (err) {
        console.warn('Supabase testCaseUrl update error:', err);
      }
    }

    setIsEditingTestCaseUrl(false);
  };

  useEffect(() => {
    setEditTestCaseUrlVal(currentProject.resources?.testCaseUrl || '');
  }, [currentProject.resources?.testCaseUrl]);

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            <button
              onClick={() => setIsDeleteModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
              }}
              title={`Delete ${project.name}`}
            >
              <Trash2 size={14} />
              <span>Delete Project</span>
            </button>
          </div>
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
          { id: 'testcases', label: 'Test Cases', icon: ListChecks },
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

      {/* SUB-TAB 2: DESIGN (FIGMA SPECS) - THE LINK ONLY */}
      {activeTab === 'figma' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palette size={22} color="#c084fc" />
                <span>Design (Figma)</span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Click or touch the Figma link below to navigate directly to the Figma file.
              </p>
            </div>

            {currentProject.resources?.figmaUrl && (
              <a
                href={currentProject.resources.figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Navigate directly to Figma"
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                  boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <span>Open in Figma</span>
                <ExternalLink size={15} />
              </a>
            )}
          </div>

          {/* Figma Link Card - Direct Navigation */}
          {currentProject.resources?.figmaUrl ? (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                background: 'rgba(15, 23, 42, 0.75)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                  <a
                    href={currentProject.resources.figmaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Touch or click to navigate to Figma"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0,
                      textDecoration: 'none',
                      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <Palette size={24} />
                  </a>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Figma Link
                    </div>
                    <a
                      href={currentProject.resources.figmaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Touch or click to navigate to Figma"
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                        wordBreak: 'break-all',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{currentProject.resources.figmaUrl}</span>
                      <ExternalLink size={14} style={{ flexShrink: 0 }} />
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={currentProject.resources.figmaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                      color: '#fff',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    <span>Go to Figma</span>
                    <ExternalLink size={14} />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentProject.resources?.figmaUrl) {
                        navigator.clipboard.writeText(currentProject.resources.figmaUrl);
                        setIsCopiedFigma(true);
                        setTimeout(() => setIsCopiedFigma(false), 2000);
                      }
                    }}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      color: isCopiedFigma ? '#34d399' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {isCopiedFigma ? (
                      <>
                        <Check size={14} color="#34d399" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  {isLead && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditFigmaUrlVal(currentProject.resources?.figmaUrl || '');
                        setIsEditingFigmaUrl((v) => !v);
                      }}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Edit3 size={14} />
                      <span>{isEditingFigmaUrl ? 'Close' : 'Edit Link'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Editable Figma URL field */}
              {isEditingFigmaUrl && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="url"
                    value={editFigmaUrlVal}
                    onChange={(e) => setEditFigmaUrlVal(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveFigmaUrl}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      background: '#10b981',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingFigmaUrl(false)}
                    style={{
                      padding: '9px 14px',
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
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                borderRadius: '12px',
                border: '1px dashed rgba(168, 85, 247, 0.4)',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'rgba(15, 23, 42, 0.4)',
              }}
            >
              <Palette size={32} color="#c084fc" style={{ opacity: 0.7, marginBottom: '10px' }} />
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                No Figma link attached yet
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 16px' }}>
                Paste the Figma file or prototype URL to enable 1-touch navigation for your QA team.
              </p>
              <div style={{ display: 'inline-flex', gap: '8px', maxWidth: '480px', width: '100%' }}>
                <input
                  type="url"
                  placeholder="https://www.figma.com/file/..."
                  value={editFigmaUrlVal}
                  onChange={(e) => setEditFigmaUrlVal(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveFigmaUrl();
                    if (editFigmaUrlVal.trim()) {
                      window.open(editFigmaUrlVal.trim(), '_blank');
                    }
                  }}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Save & Open ↗
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: TEST CASES (BESIDE PRD & FIGMA) */}
      {activeTab === 'testcases' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ListChecks size={22} color="#10b981" />
                <span>Test Cases</span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                QA test specifications, test suites, and regression test checklists.
              </p>
            </div>

            {currentProject.resources?.testCaseUrl && (
              <a
                href={currentProject.resources.testCaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Navigate directly to Test Cases"
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <span>Open Test Cases</span>
                <ExternalLink size={15} />
              </a>
            )}
          </div>

          {/* Test Case Link Card - Direct Navigation */}
          {currentProject.resources?.testCaseUrl ? (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                background: 'rgba(15, 23, 42, 0.75)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                  <a
                    href={currentProject.resources.testCaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Touch or click to navigate to Test Cases"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0,
                      textDecoration: 'none',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <ListChecks size={24} />
                  </a>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Test Cases Link
                    </div>
                    <a
                      href={currentProject.resources.testCaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Touch or click to navigate to Test Cases"
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: '#34d399',
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                        wordBreak: 'break-all',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{currentProject.resources.testCaseUrl}</span>
                      <ExternalLink size={14} style={{ flexShrink: 0 }} />
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={currentProject.resources.testCaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      color: '#fff',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span>Open Sheet / Link</span>
                    <ExternalLink size={14} />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentProject.resources?.testCaseUrl) {
                        navigator.clipboard.writeText(currentProject.resources.testCaseUrl);
                        setIsCopiedTestCase(true);
                        setTimeout(() => setIsCopiedTestCase(false), 2000);
                      }
                    }}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      color: isCopiedTestCase ? '#34d399' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {isCopiedTestCase ? (
                      <>
                        <Check size={14} color="#34d399" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTestCaseUrlVal(currentProject.resources?.testCaseUrl || '');
                      setIsEditingTestCaseUrl((v) => !v);
                    }}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={14} />
                    <span>{isEditingTestCaseUrl ? 'Close' : 'Edit Link'}</span>
                  </button>
                </div>
              </div>

              {/* Editable Test Case URL field */}
              {isEditingTestCaseUrl && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="url"
                    value={editTestCaseUrlVal}
                    onChange={(e) => setEditTestCaseUrlVal(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveTestCaseUrl}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      background: '#10b981',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTestCaseUrl(false)}
                    style={{
                      padding: '9px 14px',
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
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                borderRadius: '12px',
                border: '1px dashed rgba(16, 185, 129, 0.4)',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'rgba(15, 23, 42, 0.4)',
              }}
            >
              <ListChecks size={32} color="#34d399" style={{ opacity: 0.7, marginBottom: '10px' }} />
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                No Test Cases link attached yet
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 16px' }}>
                QA members can submit test cases via the Telegram bot using <code>/testcase</code>, or paste your Google Sheets, Notion, TestRail, or Jira link below:
              </p>
              <div style={{ display: 'inline-flex', gap: '8px', maxWidth: '480px', width: '100%' }}>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={editTestCaseUrlVal}
                  onChange={(e) => setEditTestCaseUrlVal(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveTestCaseUrl();
                    if (editTestCaseUrlVal.trim()) {
                      window.open(editTestCaseUrlVal.trim(), '_blank');
                    }
                  }}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Save & Open ↗
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: MEMBERS & SQUAD (WITH NOTIFICATION STATUS) */}
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '200px' }}>
                      Team Member Name
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '220px' }}>
                      What did you work on today?
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '150px' }}>
                      Blocker
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '150px' }}>
                      Risk
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '180px' }}>
                      Next Plan
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '200px' }}>
                      Major achievement today
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectStandups.map((standup) => {
                    const hasBlocker = Boolean(
                      standup.isBlocked ||
                      (standup.blockers && standup.blockers.toLowerCase() !== 'none' && standup.blockers.trim().length > 0)
                    );
                    const hasRisk = Boolean(
                      standup.risks &&
                      standup.risks.toLowerCase() !== 'none' &&
                      standup.risks.trim().length > 0
                    );

                    return (
                      <tr
                        key={standup.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* 1. Team Member Name */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                background: standup.source === 'telegram' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                color: standup.source === 'telegram' ? '#38bdf8' : '#a5b4fc',
                                border: standup.source === 'telegram' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                              }}
                            >
                              {standup.source === 'telegram' ? '✈️ Telegram' : '📋 In-App'}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {standup.submittedAt ? new Date(standup.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : standup.date}
                            </span>
                          </div>
                        </td>

                        {/* 2. What did you work on today? */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {standup.todayWorkingOn || '—'}
                        </td>

                        {/* 3. Blocker */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.78rem' }}>
                          {hasBlocker ? (
                            <div
                              style={{
                                color: '#f87171',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                lineHeight: 1.3,
                              }}
                            >
                              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                              <span>{standup.blockers || 'Blocked'}</span>
                            </div>
                          ) : (
                            <div
                              style={{
                                color: '#34d399',
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>🟢</span>
                              <span>None</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Risk */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.78rem' }}>
                          {hasRisk ? (
                            <div
                              style={{
                                color: '#fbbf24',
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                lineHeight: 1.3,
                              }}
                            >
                              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                              <span>{standup.risks}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>None</span>
                          )}
                        </td>

                        {/* 5. Next Plan */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {standup.nextPlan || standup.expectedCompletion || '—'}
                        </td>

                        {/* 6. Major achievement today */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, lineHeight: 1.5 }}>
                          {standup.majorAchievement || standup.yesterdayCompleted || '—'}
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Delete Project Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '14px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Delete Project
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                  Permanent Action
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to delete <strong style={{ color: '#ffffff' }}>"{currentProject.name}"</strong>? This will remove all QA configurations, test progress, and member assignments from both the dashboard and the Telegram QA bot.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                }}
              >
                <Trash2 size={14} />
                <span>{isDeleting ? 'Deleting...' : 'Delete Project'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
