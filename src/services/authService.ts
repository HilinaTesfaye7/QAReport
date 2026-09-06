import { User, TestingSkill, ProjectAllocation, BaselineContext, UserRole } from '../types';
import { StorageService } from './storage';

export const AuthService = {
  getCurrentUser: (): User => {
    const users = StorageService.getUsers();
    const currentId = StorageService.getCurrentUserId();
    const found = users.find((u) => u.id === currentId);
    if (found) return found;
    return users[0] || ({} as User);
  },

  getAllUsers: (): User[] => {
    return StorageService.getUsers();
  },

  switchUser: (userId: string): User => {
    StorageService.setCurrentUserId(userId);
    return AuthService.getCurrentUser();
  },

  isQALead: (user?: User): boolean => {
    const u = user || AuthService.getCurrentUser();
    if (!u || !u.role) return false;
    const r = String(u.role).toLowerCase();
    return r === 'qa_lead' || r.includes('lead') || r.includes('manager') || r === 'admin';
  },

  isQAEngineer: (user?: User): boolean => {
    const u = user || AuthService.getCurrentUser();
    return !AuthService.isQALead(u);
  },

  // RBAC Permission Guard
  requireLeadPermission: (actorId?: string): void => {
    const current = actorId
      ? StorageService.getUsers().find((u) => u.id === actorId)
      : AuthService.getCurrentUser();

    if (!current || !AuthService.isQALead(current)) {
      throw new Error('FORBIDDEN: This operation requires QA Lead administration permissions.');
    }
  },

  completeOnboarding: (data: {
    name: string;
    email: string;
    role: UserRole;
    experienceYears: number;
    skills: TestingSkill[];
    projectAllocations: ProjectAllocation[];
    baselineContext: BaselineContext;
  }): User => {
    const users = StorageService.getUsers();
    const newUserId = `usr-${Date.now().toString(36)}`;
    const newUser: User = {
      id: newUserId,
      name: data.name,
      email: data.email,
      role: data.role,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      experienceYears: data.experienceYears,
      skills: data.skills,
      projectAllocations: data.projectAllocations,
      onboardingCompleted: true,
      baselineContext: data.baselineContext,
    };

    users.push(newUser);
    StorageService.saveUsers(users);
    StorageService.setCurrentUserId(newUser.id);
    return newUser;
  },
};
