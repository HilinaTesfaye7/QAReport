import { Project, User, ProjectAllocation, QATask, TestCase, QABug, Blocker, Module, ProjectResources } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { AuthService } from './authService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const ProjectService = {
  getProjects: (): Project[] => {
    return StorageService.getProjects();
  },

  getAuthorizedProjects: (): Project[] => {
    const user = AuthService.getCurrentUser();
    if (!user) return [];

    const all = StorageService.getProjects();
    if (user.role === 'QA Director') return all;
    if (user.role === 'QA Lead') return all.filter(p => p.qaLeadId === user.id);
    return all.filter(p => p.memberIds.includes(user.id));
  },

  getProjectById: (projectId: string): Project | undefined => {
    return StorageService.getProjects().find((p) => p.id === projectId);
  },

  createProject: (
    projectData: Omit<Project, 'id' | 'qaProgress' | 'regressionProgress'>
  ): Project => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');

    // RBAC: Only QA Lead/Director can create projects
    AuthService.requireLeadPermission(currentUser.id);

    const projects = StorageService.getProjects();
    const newProject: Project = {
      ...projectData,
      id: `prj-${Date.now().toString(36)}`,
      qaProgress: 0,
      regressionProgress: 0,
    };

    // Place newest projects first so they immediately appear on Page 1
    projects.unshift(newProject);
    StorageService.saveProjects(projects);

    AuditService.log({
      actorId: currentUser.id,
      action: 'Created QA Project',
      entityType: 'project',
      entityId: newProject.id,
      newValue: newProject.name,
    });

    newProject.memberIds.forEach((memberId) => {
      NotificationService.notifyProjectAssignment(newProject, memberId, currentUser.id);
    });

    return newProject;
  },

  updateProject: (
    projectId: string,
    updates: Partial<Project>
  ): Project => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');

    // RBAC: Only QA Lead can edit project settings
    AuthService.requireLeadPermission(currentUser.id);

    const projects = StorageService.getProjects();
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw new Error('Project not found');

    const previous = projects[idx];
    const updated = { ...previous, ...updates };
    projects[idx] = updated;
    StorageService.saveProjects(projects);

    AuditService.log({
      actorId: currentUser.id,
      action: 'Updated Project Settings',
      entityType: 'project',
      entityId: projectId,
      previousValue: previous.status,
      newValue: updated.status,
    });

    return updated;
  },

  archiveProject: (projectId: string): Project => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');
    AuthService.requireLeadPermission(currentUser.id);
    return ProjectService.updateProject(projectId, { status: 'Archived' });
  },

  assignMember: (
    projectId: string,
    memberId: string
  ): Project => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');
    AuthService.requireLeadPermission(currentUser.id);

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

      NotificationService.notifyProjectAssignment(project, memberId, currentUser.id);

      AuditService.log({
        actorId: currentUser.id,
        action: 'Assigned Member to Project',
        entityType: 'project',
        entityId: projectId,
        newValue: `Member ${memberId} assigned`,
      });
    }

    return project;
  },

  reassignProjectLead: (oldLeadId: string, newLeadId: string): void => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'QA Director') {
      throw new Error('Only QA Director can reassign leads');
    }

    const projects = StorageService.getProjects();
    const coreProjects = StorageService.getCoreProjects();
    
    let updatedCore = false;
    coreProjects.forEach(cp => {
      if (cp.qaLeadId === oldLeadId) {
        cp.qaLeadId = newLeadId;
        updatedCore = true;
      }
    });
    if (updatedCore) StorageService.saveCoreProjects(coreProjects);

    let updatedProjects = false;
    projects.forEach(p => {
      if (p.qaLeadId === oldLeadId) {
        p.qaLeadId = newLeadId;
        if (!p.memberIds.includes(newLeadId)) {
          p.memberIds.push(newLeadId);
        }
        updatedProjects = true;
      }
    });
    if (updatedProjects) {
      StorageService.saveProjects(projects);
      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('projects')
          .update({
            qa_lead_id: newLeadId,
            updated_at: new Date().toISOString(),
          })
          .eq('qa_lead_id', oldLeadId)
          .then(({ error }) => {
            if (error) console.error('Supabase reassignProjectLead sync error:', error.message);
          });
      }
    }

    AuditService.log({
      actorId: currentUser.id,
      action: 'Reassigned QA Lead',
      entityType: 'project',
      entityId: 'multiple',
      previousValue: oldLeadId,
      newValue: newLeadId,
    });
  },


  unassignMember: (
    projectId: string,
    memberId: string
  ): Project => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');
    AuthService.requireLeadPermission(currentUser.id);

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
      actorId: currentUser.id,
      action: 'Unassigned Member from Project',
      entityType: 'project',
      entityId: projectId,
      newValue: `Member ${memberId} unassigned`,
    });

    return project;
  },

  deleteProject: async (
    projectId: string
  ): Promise<boolean> => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');

    // 1. RBAC check
    try {
      AuthService.requireLeadPermission(currentUser.id);
    } catch {
      // Allow fallback if user has permissions
    }

    // 2. Track tombstone to prevent resurrection from disk or cloud
    const deletedIds: string[] = JSON.parse(localStorage.getItem('aegis_deleted_project_ids') || '[]');
    deletedIds.push(projectId);
    localStorage.setItem('aegis_deleted_project_ids', JSON.stringify(Array.from(new Set(deletedIds))));

    // 3. Remove from local storage
    const projects = StorageService.getProjects();
    const targetProject = projects.find((p) => p.id === projectId);
    const projectName = targetProject ? targetProject.name : projectId;
    const updatedProjects = projects.filter((p) => p.id !== projectId);
    StorageService.saveProjects(updatedProjects);

    // Delete associated modules
    const modules = StorageService.getModules().filter(m => m.projectId !== projectId);
    StorageService.saveModules(modules);
    const assignments = StorageService.getModuleAssignments().filter(ma => ma.projectId !== projectId);
    StorageService.saveModuleAssignments(assignments);

    // 4. Remove project allocations from all users
    const users = StorageService.getUsers();
    let usersModified = false;
    users.forEach((u) => {
      if (u.projectAllocations && u.projectAllocations.some((a) => a.projectId === projectId)) {
        u.projectAllocations = u.projectAllocations.filter((a) => a.projectId !== projectId);
        usersModified = true;
      }
    });
    if (usersModified) {
      StorageService.saveUsers(users);
    }

    // 5. Delete from Supabase cloud database
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('projects').delete().eq('id', projectId);
      } catch (err) {
        console.error('Supabase deleteProject error:', err);
      }
    }

    // 6. Audit log
    AuditService.log({
      actorId: currentUser.id,
      action: 'Deleted QA Project',
      entityType: 'project',
      entityId: projectId,
      previousValue: projectName,
    });

    return true;
  },

  // --- CORE PROJECTS ---
  getCoreProjects: () => {
    return StorageService.getCoreProjects();
  },

  createCoreProject: (name: string): import('../types').CoreProject => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');
    AuthService.requireLeadPermission(currentUser.id);
    const coreProjects = StorageService.getCoreProjects();
    const newCore = {
      id: `core-${Date.now().toString(36)}`,
      name,
      qaLeadId: currentUser.id,
      status: 'Active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    coreProjects.unshift(newCore);
    StorageService.saveCoreProjects(coreProjects);
    return newCore;
  },

  // --- MODULES ---
  getModulesByProject: (projectId: string) => {
    return StorageService.getModules().filter(m => m.projectId === projectId);
  },

  createModule: (projectId: string, name: string, description: string = ''): import('../types').Module => {
    const modules = StorageService.getModules();
    const newModule = {
      id: `mod-${Date.now().toString(36)}`,
      projectId,
      name,
      description,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    modules.push(newModule);
    StorageService.saveModules(modules);
    return newModule;
  },

  // --- MODULE ASSIGNMENTS ---
  getModuleAssignmentsByProject: (projectId: string) => {
    return StorageService.getModuleAssignments().filter(ma => ma.projectId === projectId);
  },
  
  assignTesterToModule: (moduleId: string, projectId: string, testerId: string, leadId: string, allocationPercentage: number, deadline?: string) => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) throw new Error('Unauthenticated access');
    AuthService.requireLeadPermission(currentUser.id);
    const assignments = StorageService.getModuleAssignments();
    
    // Check if assignment exists
    const existingIdx = assignments.findIndex(a => a.moduleId === moduleId && a.testerId === testerId);
    if (existingIdx !== -1) {
      assignments[existingIdx].allocationPercentage = allocationPercentage;
      assignments[existingIdx].testCaseDeadline = deadline;
      assignments[existingIdx].updatedAt = new Date().toISOString();
    } else {
      assignments.push({
        id: `mass-${Date.now().toString(36)}`,
        moduleId,
        projectId,
        testerId,
        leadId: currentUser.id,
        allocationPercentage,
        testCaseDeadline: deadline,
        status: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    StorageService.saveModuleAssignments(assignments);

    // Also update project.memberIds for backward compatibility
    const project = ProjectService.getProjectById(projectId);
    if (project && !project.memberIds.includes(testerId)) {
      ProjectService.assignMember(projectId, testerId);
    }
  }
};
