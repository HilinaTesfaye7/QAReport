import { Project, ProjectResources } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { AuthService } from './authService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const ProjectService = {
  getProjects: (): Project[] => {
    return StorageService.getProjects();
  },

  getProjectById: (projectId: string): Project | undefined => {
    return StorageService.getProjects().find((p) => p.id === projectId);
  },

  createProject: (
    projectData: Omit<Project, 'id' | 'qaProgress' | 'regressionProgress'>,
    actorId: string
  ): Project => {
    // RBAC: Only QA Lead can create projects
    AuthService.requireLeadPermission(actorId);

    const projects = StorageService.getProjects();
    const newProject: Project = {
      ...projectData,
      id: `prj-${Date.now().toString(36)}`,
      qaProgress: 0,
      regressionProgress: 0,
    };

    projects.push(newProject);
    StorageService.saveProjects(projects);

    AuditService.log({
      actorId,
      action: 'Created QA Project',
      entityType: 'project',
      entityId: newProject.id,
      newValue: newProject.name,
    });

    newProject.memberIds.forEach((memberId) => {
      NotificationService.notifyProjectAssignment(newProject, memberId, actorId);
    });

    return newProject;
  },

  updateProject: (
    projectId: string,
    updates: Partial<Project>,
    actorId: string
  ): Project => {
    // RBAC: Only QA Lead can edit project settings
    AuthService.requireLeadPermission(actorId);

    const projects = StorageService.getProjects();
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw new Error('Project not found');

    const previous = projects[idx];
    const updated = { ...previous, ...updates };
    projects[idx] = updated;
    StorageService.saveProjects(projects);

    AuditService.log({
      actorId,
      action: 'Updated Project Settings',
      entityType: 'project',
      entityId: projectId,
      previousValue: previous.status,
      newValue: updated.status,
    });

    return updated;
  },

  archiveProject: (projectId: string, actorId: string): Project => {
    AuthService.requireLeadPermission(actorId);
    return ProjectService.updateProject(projectId, { status: 'Archived' }, actorId);
  },

  assignMember: (
    projectId: string,
    memberId: string,
    actorId: string
  ): Project => {
    AuthService.requireLeadPermission(actorId);

    const projects = StorageService.getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found');

    if (!project.memberIds.includes(memberId)) {
      project.memberIds.push(memberId);
      StorageService.saveProjects(projects);

      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('projects')
          .update({
            member_ids: project.memberIds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .then(({ error }) => {
            if (error) console.error('Supabase assignMember sync error:', error.message);
          });
      }

      NotificationService.notifyProjectAssignment(project, memberId, actorId);

      AuditService.log({
        actorId,
        action: 'Assigned Member to Project',
        entityType: 'project',
        entityId: projectId,
        newValue: `Member ${memberId} assigned`,
      });
    }

    return project;
  },

  unassignMember: (
    projectId: string,
    memberId: string,
    actorId: string
  ): Project => {
    AuthService.requireLeadPermission(actorId);

    const projects = StorageService.getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found');

    project.memberIds = project.memberIds.filter((id) => id !== memberId);
    StorageService.saveProjects(projects);

    if (isSupabaseConfigured() && supabase) {
      supabase
        .from('projects')
        .update({
          member_ids: project.memberIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .then(({ error }) => {
          if (error) console.error('Supabase unassignMember sync error:', error.message);
        });
    }

    AuditService.log({
      actorId,
      action: 'Unassigned Member from Project',
      entityType: 'project',
      entityId: projectId,
      newValue: `Member ${memberId} unassigned`,
    });

    return project;
  },
};
