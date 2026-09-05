import {
  User,
  Project,
  QATask,
  QABug,
  TestSuite,
  TestCase,
  DailyReport,
  RegressionCycle,
  Blocker,
  AuditLog,
  AppNotification,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_BUGS,
  INITIAL_TEST_SUITES,
  INITIAL_TEST_CASES,
  INITIAL_DAILY_REPORTS,
  INITIAL_REGRESSION_CYCLES,
  INITIAL_BLOCKERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
} from './seedData';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  USERS: 'aegis_users',
  CURRENT_USER_ID: 'aegis_current_user_id',
  PROJECTS: 'aegis_projects',
  TASKS: 'aegis_tasks',
  BUGS: 'aegis_bugs',
  TEST_SUITES: 'aegis_test_suites',
  TEST_CASES: 'aegis_test_cases',
  DAILY_REPORTS: 'aegis_daily_reports',
  REGRESSION_CYCLES: 'aegis_regression_cycles',
  BLOCKERS: 'aegis_blockers',
  NOTIFICATIONS: 'aegis_notifications',
  AUDIT_LOGS: 'aegis_audit_logs',
  CHANNELS: 'aegis_channels_config',
};

// Dispatch custom event for cross-component reactivity
const emitChange = (key: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aegis_storage_change', { detail: { key } }));
  }
};

export const StorageService = {
  // Reset all data to factory demo seed
  resetAll: () => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'usr-sarah'); // Default QA Lead
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
    localStorage.setItem(STORAGE_KEYS.BUGS, JSON.stringify(INITIAL_BUGS));
    localStorage.setItem(STORAGE_KEYS.TEST_SUITES, JSON.stringify(INITIAL_TEST_SUITES));
    localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(INITIAL_TEST_CASES));
    localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(INITIAL_DAILY_REPORTS));
    localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(INITIAL_REGRESSION_CYCLES));
    localStorage.setItem(STORAGE_KEYS.BLOCKERS, JSON.stringify(INITIAL_BLOCKERS));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    emitChange('ALL');
  },

  // USERS
  getUsers: (): User[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    return JSON.parse(raw);
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    emitChange(STORAGE_KEYS.USERS);
  },
  getCurrentUserId: (): string => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || 'usr-sarah';
  },
  setCurrentUserId: (id: string) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
    emitChange(STORAGE_KEYS.CURRENT_USER_ID);
  },

  // PROJECTS
  getProjects: (): Project[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    return JSON.parse(raw);
  },
  syncProjectsWithDisk: async (): Promise<Project[]> => {
    // 1. Try Supabase Cloud Database first
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const cloudProjects: Project[] = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            status: p.status,
            startDate: p.start_date || '',
            targetReleaseDate: p.target_release_date || '',
            projectOwner: p.project_owner || '',
            qaLeadId: p.qa_lead_id || 'usr-sarah',
            memberIds: Array.isArray(p.member_ids) ? p.member_ids : [],
            resources: p.resources || {},
            qaProgress: Number(p.qa_progress || 0),
            regressionProgress: Number(p.regression_progress || 0),
          }));

          localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(cloudProjects));
          emitChange(STORAGE_KEYS.PROJECTS);
          return cloudProjects;
        }
      } catch (err) {
        console.warn('Supabase projects sync failed, checking local API/cache:', err);
      }
    }

    // 2. Fall back to local dev-server API or localStorage
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/projects', { cache: 'no-cache' });
        if (res.ok) {
          const diskProjects = await res.json();
          if (Array.isArray(diskProjects) && diskProjects.length > 0) {
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(diskProjects));
            emitChange(STORAGE_KEYS.PROJECTS);
            return diskProjects;
          }
        }
      } catch {}
    }
    return StorageService.getProjects();
  },
  saveProjects: (projects: Project[]) => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    emitChange(STORAGE_KEYS.PROJECTS);

    // Save to Supabase Cloud Database
    if (isSupabaseConfigured() && supabase) {
      const rows = projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        start_date: p.startDate,
        target_release_date: p.targetReleaseDate,
        project_owner: p.projectOwner,
        qa_lead_id: p.qaLeadId,
        member_ids: p.memberIds,
        resources: p.resources,
        qa_progress: p.qaProgress,
        regression_progress: p.regressionProgress,
        updated_at: new Date().toISOString(),
      }));

      supabase
        .from('projects')
        .upsert(rows)
        .then(({ error }) => {
          if (error) console.error('Supabase saveProjects error:', error);
        });
    }

    // Dev-server disk backup
    if (typeof fetch !== 'undefined') {
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projects),
      }).catch(() => {});
    }
  },

  // TASKS
  getTasks: (): QATask[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }
    return JSON.parse(raw);
  },
  saveTasks: (tasks: QATask[]) => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    emitChange(STORAGE_KEYS.TASKS);
  },

  // BUGS
  getBugs: (): QABug[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.BUGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BUGS, JSON.stringify(INITIAL_BUGS));
      return INITIAL_BUGS;
    }
    return JSON.parse(raw);
  },
  saveBugs: (bugs: QABug[]) => {
    localStorage.setItem(STORAGE_KEYS.BUGS, JSON.stringify(bugs));
    emitChange(STORAGE_KEYS.BUGS);
  },

  // TEST SUITES & CASES
  getTestSuites: (): TestSuite[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.TEST_SUITES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TEST_SUITES, JSON.stringify(INITIAL_TEST_SUITES));
      return INITIAL_TEST_SUITES;
    }
    return JSON.parse(raw);
  },
  getTestCases: (): TestCase[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.TEST_CASES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(INITIAL_TEST_CASES));
      return INITIAL_TEST_CASES;
    }
    return JSON.parse(raw);
  },
  saveTestCases: (cases: TestCase[]) => {
    localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(cases));
    emitChange(STORAGE_KEYS.TEST_CASES);
  },

  // REGRESSION CYCLES
  getRegressionCycles: (): RegressionCycle[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.REGRESSION_CYCLES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(INITIAL_REGRESSION_CYCLES));
      return INITIAL_REGRESSION_CYCLES;
    }
    return JSON.parse(raw);
  },
  saveRegressionCycles: (cycles: RegressionCycle[]) => {
    localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(cycles));
    emitChange(STORAGE_KEYS.REGRESSION_CYCLES);
  },

  // BLOCKERS
  getBlockers: (): Blocker[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.BLOCKERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BLOCKERS, JSON.stringify(INITIAL_BLOCKERS));
      return INITIAL_BLOCKERS;
    }
    return JSON.parse(raw);
  },
  syncBlockersWithCloud: async (): Promise<Blocker[]> => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('blockers')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped: Blocker[] = data.map((b: any) => ({
            id: b.id,
            title: b.title,
            description: b.description || '',
            projectId: b.project_id,
            projectName: b.project_name || '',
            memberId: b.member_id || b.chat_id || 'usr-qa',
            severity: b.severity || 'High',
            status: b.status || 'Open',
            reportedBy: b.reported_by || 'QA Engineer',
            createdAt: b.created_at || new Date().toISOString(),
          }));

          localStorage.setItem(STORAGE_KEYS.BLOCKERS, JSON.stringify(mapped));
          emitChange(STORAGE_KEYS.BLOCKERS);
          return mapped;
        }
      } catch (e) {
        console.warn('Supabase blockers sync error:', e);
      }
    }
    return StorageService.getBlockers();
  },
  saveBlockers: (blockers: Blocker[]) => {
    localStorage.setItem(STORAGE_KEYS.BLOCKERS, JSON.stringify(blockers));
    emitChange(STORAGE_KEYS.BLOCKERS);

    if (isSupabaseConfigured() && supabase) {
      const rows = blockers.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        project_id: b.projectId,
        project_name: b.projectName || '',
        severity: b.severity,
        status: b.status,
        reported_by: b.reportedBy || 'QA Engineer',
        created_at: b.createdAt,
      }));

      supabase
        .from('blockers')
        .upsert(rows)
        .then(({ error }) => {
          if (error) console.error('Supabase saveBlockers error:', error);
        });
    }
  },

  // DAILY REPORTS
  getDailyReports: (): DailyReport[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_REPORTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(INITIAL_DAILY_REPORTS));
      return INITIAL_DAILY_REPORTS;
    }
    return JSON.parse(raw);
  },
  syncDailyReportsWithCloud: async (): Promise<DailyReport[]> => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('daily_reports')
          .select('*')
          .order('submitted_at', { ascending: false });

        if (!error && data) {
          const mapped: DailyReport[] = data.map((r: any) => ({
            id: r.id,
            date: r.date,
            chatId: r.chat_id,
            memberId: r.member_id || `usr-${r.chat_id || 'unknown'}`,
            memberName: r.member_name,
            role: r.role || 'QA Tester',
            projectId: r.project_id,
            projectName: r.project_name,
            yesterdayCompleted: r.yesterday_completed || '',
            todayWorkingOn: r.today_working_on || '',
            blockers: r.blockers || '',
            isBlocked: Boolean(r.is_blocked),
            progressPercentage: Number(r.progress_percentage || 50),
            expectedCompletion: (r.expected_completion as any) || 'Today',
            notes: r.notes || '',
            status: 'submitted' as const,
            submittedAt: r.submitted_at || new Date().toISOString(),
          }));

          localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(mapped));
          emitChange(STORAGE_KEYS.DAILY_REPORTS);
          return mapped;
        }
      } catch (e) {
        console.warn('Supabase daily_reports sync error:', e);
      }
    }
    return StorageService.getDailyReports();
  },
  saveDailyReports: (reports: DailyReport[]) => {
    localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(reports));
    emitChange(STORAGE_KEYS.DAILY_REPORTS);

    if (isSupabaseConfigured() && supabase) {
      const rows = reports.map((r) => ({
        id: r.id,
        date: r.date,
        chat_id: r.chatId || null,
        member_id: r.memberId,
        member_name: r.memberName || 'QA Member',
        role: r.role || 'tester',
        project_id: r.projectId,
        project_name: r.projectName || '',
        yesterday_completed: r.yesterdayCompleted,
        today_working_on: r.todayWorkingOn,
        blockers: r.blockers,
        is_blocked: r.isBlocked,
        expected_completion: r.expectedCompletion,
        notes: r.notes,
        submitted_at: r.submittedAt,
      }));

      supabase
        .from('daily_reports')
        .upsert(rows)
        .then(({ error }) => {
          if (error) console.error('Supabase saveDailyReports error:', error);
        });
    }
  },

  // NOTIFICATIONS
  getNotifications: (): AppNotification[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  },
  saveNotifications: (notifs: AppNotification[]) => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    emitChange(STORAGE_KEYS.NOTIFICATIONS);
  },

  // AUDIT LOGS
  getAuditLogs: (): AuditLog[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  },
  saveAuditLogs: (logs: AuditLog[]) => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
    emitChange(STORAGE_KEYS.AUDIT_LOGS);
  },

  // EXTERNAL CHANNELS CONFIG
  getChannelsConfig: () => {
    const raw = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    if (!raw) {
      const initial = {
        inApp: { enabled: true, connected: true },
        telegram: { enabled: true, botUsername: '@QAEaglebot', botToken: '8976092354:AAGROrwSrscf27zGsH5zRaXv2OCSwES8CA8', chatId: '347835367', connected: true },
        whatsApp: { enabled: false, phoneNumber: '+1 (555) 019-2831', connected: false },
        slack: { enabled: false, channel: '#qa-team-daily', connected: false },
        email: { enabled: true, sender: 'qa-notify@aegis-platform.internal', connected: true },
      };
      localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  },
  saveChannelsConfig: (config: any) => {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(config));
    emitChange(STORAGE_KEYS.CHANNELS);
  },
};
