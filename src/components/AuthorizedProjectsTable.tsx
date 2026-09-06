import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  ArrowRight,
  Eye,
  Users,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Send,
  Sparkles,
  Trash2,
  ChevronDown,
  Edit3,
} from 'lucide-react';
import { Project, User, DailyReport, Blocker } from '../types';
import { StorageService } from '../services/storage';
import { DailyReportService } from '../services/dailyReportService';
import { ProjectService } from '../services/projectService';
import { BlockerService } from '../services/blockerService';
import { supabase } from '../services/supabaseClient';

interface AuthorizedProjectsTableProps {
  currentUser: User;
  onNavigateToProject: (projectId: string) => void;
  onOpenCreateProject?: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthorizedProjectsTable: React.FC<AuthorizedProjectsTableProps> = ({
  currentUser,
  onNavigateToProject,
  onOpenCreateProject,
  title = 'Authorized Projects',
  subtitle = 'Projects you have explicit authorization and role membership in',
}) => {
  const [projects, setProjects] = useState<Project[]>(StorageService.getProjects());
  const [reports, setReports] = useState<DailyReport[]>(StorageService.getDailyReports());
  const [blockers, setBlockers] = useState<Blocker[]>(BlockerService.getBlockers());
  const [progressValues, setProgressValues] = useState<Record<string, number>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'In Progress' | 'Blocked'>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN PROGRESS' | 'BLOCKED' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const users = StorageService.getUsers();

  const loadData = async () => {
    const cloudProjects = await StorageService.syncProjectsWithDisk();
    setProjects(cloudProjects);
    setProgressValues((prev) => {
      const next = { ...prev };
      cloudProjects.forEach((p) => {
        if (next[p.id] === undefined) {
          next[p.id] = p.qaProgress ?? 0;
        }
      });
      return next;
    });
    const synced = await DailyReportService.syncTelegramReports();
    setReports(synced);
    const cloudBlockers = await BlockerService.syncBlockers();
    setBlockers(cloudBlockers);
    setLastSyncTime(new Date());
  };

  const handleDeleteProject = async (projectToDelete: Project) => {
    setIsDeleting(true);
    try {
      await ProjectService.deleteProject(projectToDelete.id, currentUser.id);
      await loadData();
      setDeleteConfirmProject(null);
    } catch (err: any) {
      console.error('Error deleting project:', err);
      alert(err?.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadData();

    // Poll for live Telegram reports and blockers every 8 seconds
    const interval = setInterval(() => {
      loadData();
    }, 8000);

    const handleStorage = () => loadData();
    window.addEventListener('aegis_storage_change', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('aegis_storage_change', handleStorage);
    };
  }, []);

  // Get latest daily standup for a project (merged in-app + Telegram)
  const getLatestProjectStandup = (projectId: string): DailyReport | undefined => {
    const projectReports = reports.filter(
      (r) => r.projectId === projectId || r.projectName?.toLowerCase() === projects.find((p) => p.id === projectId)?.name.toLowerCase()
    );
    if (!projectReports || projectReports.length === 0) return undefined;

    // Sort by submittedAt descending
    return [...projectReports].sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    })[0];
  };

  // Determine effective project status with instant override support
  const getProjectStatus = (project: Project): 'In Progress' | 'Blocked' => {
    if (statusOverrides[project.id]) {
      return statusOverrides[project.id];
    }
    if (project.status === 'Blocked' || project.status === 'On Hold') return 'Blocked';
    if (project.status === 'In Progress') return 'In Progress';

    return isProjectBlocked(project) ? 'Blocked' : 'In Progress';
  };

  // Determine if project is currently Blocked or In Progress
  const isProjectBlocked = (project: Project): boolean => {
    if (statusOverrides[project.id]) {
      return statusOverrides[project.id] === 'Blocked';
    }
    if (project.status === 'Blocked' || project.status === 'On Hold') return true;
    if (project.status === 'In Progress') return false;

    // Check open blockers recorded in blocker service
    const hasActiveBlockers = blockers.some(
      (b) =>
        b.status !== 'Resolved' &&
        (b.projectId === project.id || b.projectName?.toLowerCase() === project.name.toLowerCase())
    );
    if (hasActiveBlockers) return true;

    // Check latest standup report
    const standup = getLatestProjectStandup(project.id);
    if (standup) {
      if (standup.isBlocked) return true;
      if (standup.workStatus && standup.workStatus.toLowerCase().includes('block')) return true;
      if (standup.blockers && standup.blockers.toLowerCase() !== 'none' && standup.blockers.trim().length > 0) return true;
    }

    // Check any report for this project
    const projectReports = reports.filter(
      (r) => r.projectId === project.id || r.projectName?.toLowerCase() === project.name.toLowerCase()
    );
    return projectReports.some((r) => {
      if (r.isBlocked) return true;
      if (r.workStatus && r.workStatus.toLowerCase().includes('block')) return true;
      if (r.blockers && r.blockers.toLowerCase() !== 'none' && r.blockers.trim().length > 0) return true;
      return false;
    });
  };

  // Change project status from dropdown (In Progress or Blocked) with ZERO lag
  const handleStatusChange = async (project: Project, newStatus: string) => {
    const isNowBlocked = newStatus === 'Blocked';
    const statusVal: 'Blocked' | 'In Progress' = isNowBlocked ? 'Blocked' : 'In Progress';

    // 1. INSTANT LOCAL STATE UPDATE (0ms lag, updates dropdown and colors immediately!)
    setStatusOverrides((prev) => ({ ...prev, [project.id]: statusVal }));
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: statusVal } : p))
    );

    // 2. Synchronous local storage update
    try {
      const all = StorageService.getProjects();
      const pIdx = all.findIndex((x) => x.id === project.id);
      if (pIdx !== -1) {
        all[pIdx].status = statusVal;
        StorageService.saveProjects(all);
      }
    } catch {}

    // 3. Optimistically reconcile blockers in state
    if (!isNowBlocked) {
      setBlockers((prev) =>
        prev.map((b) =>
          b.projectId === project.id || b.projectName?.toLowerCase() === project.name.toLowerCase()
            ? { ...b, status: 'Resolved', resolvedAt: new Date().toISOString().split('T')[0] }
            : b
        )
      );
    } else {
      setBlockers((prev) => {
        const hasOpen = prev.some(
          (b) =>
            b.status !== 'Resolved' &&
            (b.projectId === project.id || b.projectName?.toLowerCase() === project.name.toLowerCase())
        );
        if (!hasOpen) {
          const newBlk: Blocker = {
            id: `blk-${Date.now().toString(36)}`,
            title: `Project ${project.name} marked as Blocked`,
            description: `Status changed to Blocked by ${currentUser.name}`,
            severity: 'Critical',
            status: 'Open',
            projectId: project.id,
            projectName: project.name,
            memberId: currentUser.id,
            reportedBy: currentUser.name,
            createdAt: new Date().toISOString().split('T')[0],
          };
          return [newBlk, ...prev];
        }
        return prev;
      });
    }

    // 4. Background persistence without stalling or delaying UI
    (async () => {
      try {
        ProjectService.updateProject(project.id, { status: statusVal }, currentUser.id);
      } catch {}

      if (supabase) {
        try {
          await supabase
            .from('projects')
            .update({ status: statusVal, updated_at: new Date().toISOString() })
            .eq('id', project.id);
        } catch (err) {
          console.warn('Supabase status update error:', err);
        }
      }

      if (!isNowBlocked) {
        const openBlks = StorageService.getBlockers().filter(
          (b) =>
            b.status !== 'Resolved' &&
            (b.projectId === project.id || b.projectName?.toLowerCase() === project.name.toLowerCase())
        );
        for (const b of openBlks) {
          try {
            BlockerService.updateBlockerStatus(b.id, 'Resolved', currentUser.id);
          } catch {}
        }
      } else {
        const openBlks = StorageService.getBlockers().filter(
          (b) =>
            b.status !== 'Resolved' &&
            (b.projectId === project.id || b.projectName?.toLowerCase() === project.name.toLowerCase())
        );
        if (openBlks.length === 0) {
          try {
            BlockerService.createBlocker(
              {
                title: `Project ${project.name} marked as Blocked`,
                description: `Status changed to Blocked by ${currentUser.name}`,
                severity: 'Critical',
                status: 'Open',
                projectId: project.id,
                projectName: project.name,
                memberId: currentUser.id,
                reportedBy: currentUser.name,
              },
              currentUser.id
            );
          } catch {}
        }
      }
    })();
  };

  // Save updated delivery progress percentage with instant feedback
  const handleProgressSave = async (project: Project, newProgress: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newProgress)));
    setProgressValues((prev) => ({ ...prev, [project.id]: clamped }));
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, qaProgress: clamped } : p))
    );

    try {
      const all = StorageService.getProjects();
      const idx = all.findIndex((p) => p.id === project.id);
      if (idx !== -1) {
        all[idx].qaProgress = clamped;
        StorageService.saveProjects(all);
      }
    } catch {}

    // Direct cloud sync to Supabase projects table in background
    (async () => {
      try {
        ProjectService.updateProject(project.id, { qaProgress: clamped }, currentUser.id);
      } catch {}

      if (supabase) {
        try {
          await supabase
            .from('projects')
            .update({ qa_progress: clamped, updated_at: new Date().toISOString() })
            .eq('id', project.id);
        } catch (err) {
          console.warn('Supabase qa_progress update error:', err);
        }
      }
    })();
  };

  // Filter projects by status and search
  const filteredProjects = projects.filter((project) => {
    const isBlocked = getProjectStatus(project) === 'Blocked';

    // Status filter
    if (statusFilter === 'IN PROGRESS') {
      if (isBlocked) return false;
      if (project.status === 'Completed' || project.status === 'Ready for Release') return false;
    } else if (statusFilter === 'BLOCKED') {
      if (!isBlocked) return false;
    } else if (statusFilter === 'COMPLETED') {
      if (project.status !== 'Ready for Release' && project.status !== 'UAT' && project.status !== 'Completed') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = project.name.toLowerCase().includes(q);
      const matchDesc = project.description?.toLowerCase().includes(q);
      const matchOwner = project.projectOwner?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchOwner) return false;
    }

    return true;
  });

  // Get user role for this project
  const getUserRoleForProject = (project: Project): string => {
    if (project.qaLeadId === currentUser.id) return 'QA LEAD';
    if (project.memberIds.includes(currentUser.id)) {
      return currentUser.role === 'qa_engineer' ? 'QA ENGINEER' : 'TESTER';
    }
    return currentUser.role === 'qa_lead' ? 'QA LEAD' : 'PROJECT MANAGER';
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        padding: '24px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header with Title and + New Project Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            {subtitle}
          </p>
        </div>

        {onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>+ New Project</span>
          </button>
        )}
      </div>

      {/* Control Bar: Filter Pills on Left, Search & View Switcher on Right */}
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
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px' }}>
          {(['ALL', 'IN PROGRESS', 'BLOCKED', 'COMPLETED'] as const).map((filter) => {
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Right Controls: Search & Table/Grid View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
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

          {/* Table / Grid Toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-app)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '6px',
                background: viewMode === 'table' ? '#2563eb' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '6px',
                background: viewMode === 'grid' ? '#2563eb' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredProjects.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No projects found matching the criteria.
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Pixel-perfect matching user's reference) */
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
            <thead>
              <tr
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Project
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Project Status(inprogress,blocked)
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Delivery Progress
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Members
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  daily standup update
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>
                  Action (view,delete)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const standup = getLatestProjectStandup(project.id);
                const memberCount = project.memberIds.length + 1; // including QA lead
                const currentStatus = getProjectStatus(project);
                const blocked = currentStatus === 'Blocked';

                return (
                  <tr
                    key={project.id}
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
                    {/* 1. Project */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {project.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Target: {project.targetReleaseDate || '2026-11-30'}
                      </div>
                    </td>

                    {/* 2. Project Status(inprogress,blocked) - Dropdown Selector */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <select
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(project, e.target.value)}
                          title="Choose project status: In Progress or Blocked"
                          style={{
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            padding: '5px 28px 5px 12px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            background: blocked
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                            color: blocked ? '#f87171' : '#34d399',
                            border: blocked
                              ? '1px solid rgba(239, 68, 68, 0.4)'
                              : '1px solid rgba(16, 185, 129, 0.4)',
                            boxShadow: blocked
                              ? '0 0 10px rgba(239, 68, 68, 0.15)'
                              : '0 0 10px rgba(16, 185, 129, 0.15)',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <option
                            value="In Progress"
                            style={{ background: '#0f172a', color: '#34d399', fontWeight: 700 }}
                          >
                            🟢 IN PROGRESS
                          </option>
                          <option
                            value="Blocked"
                            style={{ background: '#0f172a', color: '#f87171', fontWeight: 700 }}
                          >
                            🔴 BLOCKED
                          </option>
                        </select>
                        <ChevronDown
                          size={12}
                          style={{
                            position: 'absolute',
                            right: '9px',
                            pointerEvents: 'none',
                            color: blocked ? '#f87171' : '#34d399',
                          }}
                        />
                      </div>
                    </td>

                    {/* 3. Delivery Progress - Editable */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', minWidth: '160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Delivery Progress</span>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '6px',
                            padding: '1px 5px',
                            transition: 'border-color 0.15s ease',
                          }}
                          title="Click to edit progress percentage (0 - 100)"
                        >
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={progressValues[project.id] ?? project.qaProgress ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val = raw === '' ? 0 : parseInt(raw, 10);
                              const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
                              setProgressValues((prev) => ({ ...prev, [project.id]: clamped }));
                            }}
                            onBlur={() => {
                              const finalVal = progressValues[project.id] ?? project.qaProgress ?? 0;
                              handleProgressSave(project, finalVal);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            style={{
                              width: '38px',
                              padding: '1px 2px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: '#38bdf8',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              textAlign: 'right',
                            }}
                          />
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>%</span>
                        </div>
                      </div>
                      <div style={{ height: '6px', width: '100%', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(0, progressValues[project.id] ?? project.qaProgress ?? 0))}%`,
                            background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                            borderRadius: '3px',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                    </td>

                    {/* 4. Members */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Users size={14} color="#38bdf8" />
                        <span style={{ fontWeight: 600 }}>{memberCount}</span>
                      </div>
                    </td>

                    {/* 5. daily standup update */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', minWidth: '320px', maxWidth: '420px' }}>
                      {standup ? (
                        <div
                          style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: standup.isBlocked ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '0.78rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {/* Standup Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 800, color: '#38bdf8' }}>
                              {standup.memberName || 'QA Member'}{' '}
                              <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                ({standup.role ? standup.role.replace(/_/g, ' ') : 'QA_ENGINEER'})
                              </span>
                            </div>
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
                          </div>

                          {/* Standup Tasks Q1/Q2 */}
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Q1:</strong> {standup.yesterdayCompleted || standup.todayWorkingOn}
                          </div>

                          {/* Blockers Flag */}
                          {standup.isBlocked ? (
                            <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} />
                              <span>Blocker: {standup.blockers || 'Reported'}</span>
                            </div>
                          ) : (
                            <div style={{ color: '#34d399', fontWeight: 600, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>🟢</span>
                              <span>Blockers: None</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          No standup recorded today
                        </div>
                      )}
                    </td>

                    {/* 6. Action (view,delete) */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => onNavigateToProject(project.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                            e.currentTarget.style.borderColor = '#38bdf8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
                          }}
                          title={`View ${project.name}`}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmProject(project);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                            e.currentTarget.style.color = '#f87171';
                          }}
                          title={`Delete ${project.name}`}
                          aria-label={`Delete ${project.name}`}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW (Compact modernized cards with the latest standup embed) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredProjects.map((project) => {
            const roleName = getUserRoleForProject(project);
            const standup = getLatestProjectStandup(project.id);
            const currentStatus = getProjectStatus(project);
            const blocked = currentStatus === 'Blocked';

            return (
              <div
                key={project.id}
                style={{
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => onNavigateToProject(project.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {project.name}
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Target: {project.targetReleaseDate}
                    </span>
                  </div>
                  {/* Status Dropdown in Grid */}
                  <div
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(project, e.target.value)}
                      title="Choose project status: In Progress or Blocked"
                      style={{
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        padding: '3px 22px 3px 8px',
                        borderRadius: '10px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        background: blocked
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(16, 185, 129, 0.15)',
                        color: blocked ? '#f87171' : '#34d399',
                        border: blocked
                          ? '1px solid rgba(239, 68, 68, 0.35)'
                          : '1px solid rgba(16, 185, 129, 0.35)',
                        outline: 'none',
                      }}
                    >
                      <option value="In Progress" style={{ background: '#0f172a', color: '#34d399', fontWeight: 700 }}>
                        🟢 IN PROGRESS
                      </option>
                      <option value="Blocked" style={{ background: '#0f172a', color: '#f87171', fontWeight: 700 }}>
                        🔴 BLOCKED
                      </option>
                    </select>
                    <ChevronDown
                      size={11}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        pointerEvents: 'none',
                        color: blocked ? '#f87171' : '#34d399',
                      }}
                    />
                  </div>
                </div>

                {/* Progress bar - Editable in Grid */}
                <div onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Delivery Progress</span>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '4px',
                        padding: '1px 4px',
                      }}
                      title="Edit progress (0-100)"
                    >
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={progressValues[project.id] ?? project.qaProgress ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === '' ? 0 : parseInt(raw, 10);
                          const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
                          setProgressValues((prev) => ({ ...prev, [project.id]: clamped }));
                        }}
                        onBlur={() => {
                          const finalVal = progressValues[project.id] ?? project.qaProgress ?? 0;
                          handleProgressSave(project, finalVal);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        style={{
                          width: '32px',
                          padding: '1px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: '#38bdf8',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          textAlign: 'right',
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>%</span>
                    </div>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, progressValues[project.id] ?? project.qaProgress ?? 0))}%`,
                        background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                        borderRadius: '3px',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Standup Box in Grid */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {standup ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                          {standup.memberName} ({standup.role})
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#38bdf8' }}>
                          {standup.source === 'telegram' ? '✈️ Telegram' : '📋 In-App'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Q1: {standup.yesterdayCompleted || standup.todayWorkingOn}
                      </div>
                      <div style={{ marginTop: '2px', color: standup.isBlocked ? '#f87171' : '#34d399', fontWeight: 600 }}>
                        {standup.isBlocked ? `⚠️ Blocker: ${standup.blockers}` : '🟢 Blockers: None'}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      No standup recorded today
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#a5b4fc',
                    }}
                  >
                    {roleName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmProject(project);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                        e.currentTarget.style.borderColor = '#ef4444';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        e.currentTarget.style.color = '#f87171';
                      }}
                      title={`Delete ${project.name}`}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                      <Eye size={13} />
                      <span>View</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteConfirmProject && (
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
          onClick={() => !isDeleting && setDeleteConfirmProject(null)}
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
              Are you sure you want to delete <strong style={{ color: '#ffffff' }}>"{deleteConfirmProject.name}"</strong>? This will remove all QA configurations, test progress, and member assignments from both the dashboard and the Telegram QA bot.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmProject(null)}
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
                onClick={() => handleDeleteProject(deleteConfirmProject)}
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
