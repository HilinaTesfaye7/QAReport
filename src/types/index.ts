export type UserRole = 'qa_lead' | 'qa_engineer';

export type TestingSkill =
  | 'Manual Testing'
  | 'API Testing'
  | 'UI Testing'
  | 'Regression Testing'
  | 'UAT'
  | 'Automation Testing'
  | 'Playwright'
  | 'Selenium'
  | 'Cypress'
  | 'Postman'
  | 'REST Assured'
  | 'Performance Testing'
  | 'Mobile Testing'
  | 'Web Testing'
  | 'Desktop Testing'
  | 'Security Testing'
  | 'Database Testing'
  | 'Telegram Standup'
  | 'Functional QA'
  | 'Other';

export interface ProjectAllocation {
  projectId: string;
  percentage: number;
}

export interface BaselineContext {
  currentWork: string;
  mainTaskToday?: string;
  blockers?: string;
  biggestBlocker?: string;
  assignedTasks?: string;
  waitingOnOthers?: string;
  expectedToday: string;
  upcomingDeadlines?: string;
  leadNotes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  experienceYears: number;
  skills: TestingSkill[];
  projectAllocations: ProjectAllocation[];
  onboardingCompleted: boolean;
  baselineContext?: BaselineContext;
  telegramUsername?: string;
  telegramChatId?: string;
}

export type ProjectStatus =
  | 'Planning'
  | 'Active'
  | 'Testing'
  | 'UAT'
  | 'Ready for Release'
  | 'Released'
  | 'On Hold'
  | 'Completed'
  | 'Archived'
  | 'Blocked'
  | 'In Progress';

export interface TestCredential {
  role: string;
  user: string;
  pass: string;
  notes: string;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  fileName: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  version: string;
  downloadUrl?: string;
}

export interface ProjectResources {
  prdTitle: string;
  prdUrl: string;
  prdContent: string;
  prdDocuments?: DocumentMetadata[];
  figmaUrl: string;
  figmaName?: string;
  figmaDescription?: string;
  figmaVersion?: string;
  figmaPreviewTitle: string;
  requirements: string[];
  testEnvUrl: string;
  repoUrl: string;
  buildVersion?: string;
  apiDocUrl: string;
  testCredentials: TestCredential[];
  releaseInfo: string;
  importantNotes: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  targetReleaseDate: string;
  projectOwner: string;
  qaLeadId: string;
  memberIds: string[];
  resources: ProjectResources;
  qaProgress: number;
  regressionProgress: number;
}

export type TaskStatus =
  | 'Backlog'
  | 'Assigned'
  | 'In Progress'
  | 'Blocked'
  | 'In Review'
  | 'Completed'
  | 'Cancelled';

export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface QATask {
  id: string;
  title: string;
  description: string;
  projectId: string;
  module: string;
  assigneeId: string;
  priority: TaskPriority;
  estimatedEffortHours: number;
  actualEffortHours?: number;
  startDate?: string;
  dueDate: string;
  completionDate?: string;
  status: TaskStatus;
  blockerReason?: string;
  relatedRequirement?: string;
  relatedTestCaseId?: string;
  relatedBugId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type BugStatus =
  | 'Open'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Retest'
  | 'Closed'
  | 'Reopened'
  | 'Rejected'
  | 'Duplicate';

export interface QABug {
  id: string;
  title: string;
  description: string;
  projectId: string;
  module: string;
  environment: string;
  buildVersion: string;
  severity: BugSeverity;
  priority: TaskPriority;
  status: BugStatus;
  reporterId: string;
  assigneeId: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedDate?: string;
  lastActivityAt: string;
  reopenedCount: number;
  comments?: { author: string; text: string; date: string }[];
  relatedTestCaseId?: string;
  relatedRequirement?: string;
}

export type TestType =
  | 'Functional'
  | 'Regression'
  | 'Smoke'
  | 'Sanity'
  | 'UAT'
  | 'API'
  | 'UI'
  | 'Integration'
  | 'Negative'
  | 'Edge Case';

export type TestCaseStatus = 'Draft' | 'Ready' | 'Active' | 'Deprecated';

export type TestExecutionStatus =
  | 'Not Run'
  | 'Passed'
  | 'Failed'
  | 'Blocked'
  | 'Skipped';

export interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
}

export interface TestCase {
  id: string;
  suiteId: string;
  projectId: string;
  title: string;
  module: string;
  preconditions?: string;
  steps: TestStep[];
  expectedResult: string;
  priority: TaskPriority;
  type: TestType;
  author: string;
  status: TestCaseStatus;
  requirement?: string;
  assigneeId: string;
  executionStatus: TestExecutionStatus;
  lastExecutedAt?: string;
  lastExecutedBy?: string;
  linkedBugId?: string;
  executionNotes?: string;
  notes?: string;
}

export interface TestSuite {
  id: string;
  projectId: string;
  title: string;
  description: string;
  module: string;
}

export interface RegressionCycle {
  id: string;
  projectId: string;
  title: string;
  buildVersion: string;
  environment: string;
  startDate: string;
  endDate: string;
  assignedMemberIds: string[];
  testCaseIds: string[];
  status: 'Planning' | 'In Progress' | 'Completed';
  passRate: number;
  createdAt: string;
}

export type BlockerSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type BlockerStatus = 'Open' | 'Investigating' | 'Waiting' | 'Resolved';

export interface Blocker {
  id: string;
  title: string;
  description: string;
  projectId: string;
  projectName?: string;
  taskId?: string;
  memberId: string;
  reportedBy?: string;
  severity: BlockerSeverity;
  status: BlockerStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface DailyReport {
  id: string;
  date: string;
  memberId: string;
  memberName?: string;
  chatId?: string;
  role?: string;
  projectId: string;
  projectName?: string;
  yesterdayCompleted?: string;
  todayWorkingOn: string; // What did you work on today?
  workStatus?: string;
  statusEmoji?: string;
  isBlocked: boolean;
  blockers: string; // Blocker / challenges
  risks?: string; // Risk you afraid of
  nextPlan?: string; // Next Plan
  majorAchievement?: string; // Major achievement today
  progressPercentage: number;
  expectedCompletion: 'Today' | 'Tomorrow' | 'Later' | string;
  notes: string;
  status: 'draft' | 'submitted';
  submittedAt?: string;
  source?: 'telegram' | 'in_app';
}

export type WorkloadClassification = 'Low' | 'Balanced' | 'High' | 'Overloaded';

export interface MemberWorkload {
  memberId: string;
  score: number; // 0 - 100
  classification: WorkloadClassification;
  projectsCount: number;
  activeProjectsCount?: number;
  taskCount: number;
  estimatedHoursTotal: number;
  capacityRemainingHours?: number;
  criticalTasksCount: number;
  openBugsCount: number;
  testCasesCount: number;
  blockedTasksCount: number;
  explanation: string;
}

export type ReleaseStatus = 'READY' | 'READY_WITH_RISKS' | 'NOT_READY' | 'BLOCKED';

export interface RuleEvaluationResult {
  ruleName: string;
  passed: boolean;
  details: string;
}

export interface ProjectReleaseReadiness {
  projectId: string;
  projectName: string;
  status: ReleaseStatus;
  overallStatus?: ReleaseStatus;
  testCompletionRate: number;
  passRate: number;
  regressionPassRate?: number;
  criticalBugsCount: number;
  highBugsCount: number;
  openBlockersCount: number;
  regressionStatus: string;
  uatStatus: string;
  rulesEvaluated: RuleEvaluationResult[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType:
    | 'task'
    | 'bug'
    | 'project'
    | 'report'
    | 'workload'
    | 'blocker'
    | 'regression'
    | 'readiness';
  entityId: string;
  previousValue?: string;
  newValue?: string;
  channel?: string;
  isAIGenerated?: boolean;
  humanApproved?: boolean;
  originalPromptOrResponse?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type:
    | 'assignment'
    | 'reassignment'
    | 'deadline'
    | 'overdue'
    | 'bug_assigned'
    | 'bug_status'
    | 'bug_resolved'
    | 'bug_retest'
    | 'regression_assigned'
    | 'daily_report_reminder'
    | 'blocker'
    | 'blocker_created'
    | 'blocker_resolved'
    | 'announcement';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  payload?: Record<string, unknown>;
}
