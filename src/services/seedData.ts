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

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-director',
    name: 'Alex Director',
    email: 'alex.director@qa-aegis.com',
    role: 'QA Director',
    username: 'alex.director',
    passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    isActive: true,
    mustChangePassword: true,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    experienceYears: 10,
    skills: ['QA Strategy', 'Leadership', 'Test Management'],
    projectAllocations: [],
    onboardingCompleted: true,
  },
  {
    id: 'usr-lead-a',
    name: 'Sarah (Lead A)',
    email: 'sarah.lead.a@qa-aegis.com',
    role: 'QA Lead',
    username: 'sarah.lead.a',
    passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    isActive: true,
    mustChangePassword: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    experienceYears: 8,
    skills: ['Manual Testing', 'API Testing', 'Performance Testing', 'Security Testing', 'Regression Testing', 'Postman'],
    projectAllocations: [],
    onboardingCompleted: true,
  },
  {
    id: 'usr-lead-b',
    name: 'David (Lead B)',
    email: 'david.lead.b@qa-aegis.com',
    role: 'QA Lead',
    username: 'david.lead.b',
    passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    isActive: true,
    mustChangePassword: true,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    experienceYears: 7,
    skills: ['Manual Testing', 'Mobile Testing', 'Test Management'],
    projectAllocations: [],
    onboardingCompleted: true,
  },
  {
    id: 'usr-tester-coco',
    name: 'Coco',
    email: 'coco.tester@qa-aegis.com',
    role: 'QA Tester',
    username: 'coco.tester',
    passwordHash: 'ad1c23d68c5f939091167346bf9ae50687fa58e322ad7a4e3c0399bcd2abe794',
    isActive: true,
    mustChangePassword: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    experienceYears: 3,
    skills: ['Manual Testing', 'API Testing', 'Mobile Testing', 'Web Testing', 'Postman', 'Regression Testing'],
    projectAllocations: [],
    onboardingCompleted: true,
  }
];

export const INITIAL_PROJECTS: Project[] = [];
export const INITIAL_TASKS: QATask[] = [];
export const INITIAL_BUGS: QABug[] = [];
export const INITIAL_TEST_SUITES: TestSuite[] = [];
export const INITIAL_TEST_CASES: TestCase[] = [];
export const INITIAL_REGRESSION_CYCLES: RegressionCycle[] = [];
export const INITIAL_BLOCKERS: Blocker[] = [];
export const INITIAL_DAILY_REPORTS: DailyReport[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
