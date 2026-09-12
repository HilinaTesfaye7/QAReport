import { User, TestingSkill, ProjectAllocation, BaselineContext, UserRole } from '../types';
import { StorageService } from './storage';

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
    if (user.role === 'QA Director' || user.role === 'QA Lead') return all;
    if (user.role === 'QA Tester' || user.role === 'Automation QA Engineer') {
      return all.filter(u => u.id === user.id);
    }
    return all;
  },

  switchUser: (userId: string): User | null => {
    StorageService.setCurrentUserId(userId);
    return AuthService.getCurrentUser();
  },

  fetchMe: async (): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const user: User = {
          ...data,
          isActive: true
        };
        // Update local mock store for frontend compatibility
        const users = StorageService.getUsers();
        const existingIdx = users.findIndex(u => u.id === user.id);
        if (existingIdx >= 0) {
          users[existingIdx] = { ...users[existingIdx], ...user };
        } else {
          users.push(user as any); // mock fields if needed
        }
        StorageService.saveUsers(users);
        StorageService.setCurrentUserId(user.id);
        return user;
      }
      return null;
    } catch {
      return null;
    }
  },

  login: async (username: string, passwordPlain: string): Promise<User> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: passwordPlain })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Invalid credentials');
    }

    const data = await res.json();
    const user: User = { ...data, isActive: true };
    
    // For compatibility with mock storage
    const users = StorageService.getUsers();
    const existingIdx = users.findIndex(u => u.id === user.id);
    if (existingIdx >= 0) {
      users[existingIdx] = { ...users[existingIdx], ...user };
    } else {
      users.push(user as any);
    }
    StorageService.saveUsers(users);
    StorageService.setCurrentUserId(user.id);
    return user;
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore
    }
    StorageService.setCurrentUserId('');
  },

  changePassword: async (currentPass: string, newPass: string): Promise<User> => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to change password');
    }

    const user = AuthService.getCurrentUser();
    if (user) {
      user.mustChangePassword = false;
      const users = StorageService.getUsers();
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        users[idx] = user;
        StorageService.saveUsers(users);
      }
    }
    return user as User;
  },

  forgotPassword: async (username: string): Promise<string> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      return data.message || "If the account exists, password reset instructions have been sent.";
    } catch {
      return "If the account exists, password reset instructions have been sent.";
    }
  },

  isQALead: (user?: User): boolean => {
    const u = user || AuthService.getCurrentUser();
    if (!u) return false;
    return u.role === 'QA Lead' || u.role === 'QA Director';
  },

  isQAEngineer: (user?: User): boolean => {
    const u = user || AuthService.getCurrentUser();
    if (!u) return false;
    return u.role === 'QA Tester' || u.role === 'Automation QA Engineer';
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

  completeOnboarding: (data: any): User => {
    // Legacy mock function
    const users = StorageService.getUsers();
    const newUserId = `usr-${Date.now().toString(36)}`;
    const newUser: User = {
      id: newUserId,
      name: data.name,
      email: data.email,
      role: data.role,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      username: data.email.split('@')[0],
      passwordHash: '',
      isActive: true,
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
