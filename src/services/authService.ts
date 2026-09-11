import { User, TestingSkill, ProjectAllocation, BaselineContext, UserRole } from '../types';
import { StorageService } from './storage';

import { CryptoService } from './cryptoService';

export const AuthService = {
  getCurrentUser: (): User | null => {
    const users = StorageService.getUsers();
    const currentId = StorageService.getCurrentUserId();
    if (!currentId) return null;
    const found = users.find((u) => u.id === currentId);
    return found || null;
  },

  getAllUsers: (): User[] => {
    return StorageService.getUsers();
  },

  getAuthorizedUsers: (user: User): User[] => {
    const all = StorageService.getUsers();
    if (user.role === 'QA Director') return all;
    // A QA Lead should see themselves and any users they are managing?
    // Let's keep it simple: Directors see all, Leads see all (they need to assign them). 
    // Actually, "QA Lead sees only authorized Lead data". But they need to be able to assign any tester to their projects.
    // For now, let's return all, except maybe testers see only themselves.
    if (user.role === 'QA Tester' || user.role === 'Automation QA Engineer') {
      return all.filter(u => u.id === user.id);
    }
    return all;
  },

  switchUser: (userId: string): User | null => {
    StorageService.setCurrentUserId(userId);
    return AuthService.getCurrentUser();
  },

  login: async (username: string, passwordPlain: string): Promise<User> => {
    const users = StorageService.getUsers();
    const user = users.find(u => u.username === username);
    
    if (!user) {
      throw new Error('Invalid username or password');
    }
    
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    const hashed = await CryptoService.hashPassword(passwordPlain);
    
    if (user.passwordHash !== hashed) {
      throw new Error('Invalid username or password');
    }

    // Success
    user.lastLoginAt = new Date().toISOString();
    StorageService.saveUsers(users);
    StorageService.setCurrentUserId(user.id);
    
    return user;
  },

  logout: () => {
    StorageService.setCurrentUserId('');
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

  requireDirectorPermission: (actorId?: string): void => {
    const current = actorId
      ? StorageService.getUsers().find((u) => u.id === actorId)
      : AuthService.getCurrentUser();

    if (!current || current.role !== 'QA Director') {
      throw new Error('FORBIDDEN: This operation requires QA Director permissions.');
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
