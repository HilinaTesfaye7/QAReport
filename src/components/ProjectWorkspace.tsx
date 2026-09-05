import React, { useState, useEffect } from 'react';
import { Project, User } from '../types';
import { StorageService } from '../services/storage';
import { AuthorizedProjectsTable } from './AuthorizedProjectsTable';
import { ProjectDetailView } from './ProjectDetailView';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectWorkspaceProps {
  currentUser: User;
  activeProjectId?: string;
  onSelectProject?: (id: string) => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  currentUser,
  activeProjectId,
  onSelectProject,
}) => {
  const [projects, setProjects] = useState<Project[]>(StorageService.getProjects());
  const [selectedId, setSelectedId] = useState<string>(activeProjectId || projects[0]?.id || '');
  const [viewMode, setViewMode] = useState<'directory' | 'workspace'>(activeProjectId ? 'workspace' : 'directory');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const reloadProjects = () => {
    setProjects(StorageService.getProjects());
  };

  useEffect(() => {
    reloadProjects();
    const handleStorage = () => reloadProjects();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      setSelectedId(activeProjectId);
      setViewMode('workspace');
    }
  }, [activeProjectId]);

  const currentProject = projects.find((p) => p.id === selectedId) || projects[0];
  const isLead = currentUser.role === 'qa_lead';

  if (!currentProject && projects.length === 0) {
    return <div style={{ padding: '24px' }}>No projects available.</div>;
  }

  return (
    <div>
      {viewMode === 'directory' ? (
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
          <AuthorizedProjectsTable
            currentUser={currentUser}
            onNavigateToProject={(id) => {
              setSelectedId(id);
              setViewMode('workspace');
              if (onSelectProject) onSelectProject(id);
            }}
            onOpenCreateProject={isLead ? () => setIsCreateModalOpen(true) : undefined}
          />
        </div>
      ) : (
        <ProjectDetailView
          project={currentProject}
          allProjects={projects}
          currentUser={currentUser}
          onBackToProjects={() => setViewMode('directory')}
          onSelectProject={(id) => {
            setSelectedId(id);
            if (onSelectProject) onSelectProject(id);
          }}
          onOpenCreateProject={isLead ? () => setIsCreateModalOpen(true) : undefined}
        />
      )}

      {/* Portal Administrator Create Project Modal (with PRD, Design, and Member Notifications) */}
      {isCreateModalOpen && (
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUser={currentUser}
          onProjectCreated={(newProj) => {
            reloadProjects();
            setSelectedId(newProj.id);
            setViewMode('workspace');
            if (onSelectProject) onSelectProject(newProj.id);
          }}
        />
      )}
    </div>
  );
};
