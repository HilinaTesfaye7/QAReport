import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { QALeadDashboard } from './components/QALeadDashboard';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { TaskManagement } from './components/TaskManagement';
import { BugManagement } from './components/BugManagement';
import { TestCaseManagement } from './components/TestCaseManagement';
import { RegressionManagement } from './components/RegressionManagement';
import { BlockerManagement } from './components/BlockerManagement';
import { ReleaseReadinessDashboard } from './components/ReleaseReadinessDashboard';
import { ReportsAndExportView } from './components/ReportsAndExportView';
import { DailyReportsView } from './components/DailyReportsView';
import { TeamManagement } from './components/TeamManagement';
import { NotificationCenter } from './components/NotificationCenter';
import { AuditTrailView } from './components/AuditTrailView';
import { OnboardingModal } from './components/OnboardingModal';
import { RuleDrivenCheckInModal } from './components/RuleDrivenCheckInModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { WorkloadAssignmentModal } from './components/WorkloadAssignmentModal';
import { AuthService } from './services/authService';
import { StorageService } from './services/storage';
import { CreateProjectModal } from './components/CreateProjectModal';
import { User } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(AuthService.getCurrentUser());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<string>('command-center');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  // Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isWorkloadAssignOpen, setIsWorkloadAssignOpen] = useState<boolean>(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initial cloud sync on mount from Supabase
  useEffect(() => {
    StorageService.syncProjectsWithDisk();
    StorageService.syncDailyReportsWithCloud();
    StorageService.syncBlockersWithCloud();
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleUserChange = (newUser: User) => {
    setCurrentUser(newUser);
  };

  const handleNavigateToProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTab('projects');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Left Sidebar (Screenshot 1-3 layout) */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onUserChange={handleUserChange}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
      />

      {/* Main Content View with Top Header */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopHeader
          currentUser={currentUser}
          activeTab={activeTab}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenCheckIn={() => setIsCheckInOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          onOpenCreateProject={() => setIsCreateProjectOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Content View Switcher */}
        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '60px' }}>
          {activeTab === 'command-center' && (
            <QALeadDashboard
              currentUser={currentUser}
              onNavigateToProject={handleNavigateToProject}
              onNavigateToTeam={() => setActiveTab('team')}
              onNavigateToTasks={() => setActiveTab('tasks')}
              onNavigateToBugs={() => setActiveTab('bugs')}
              onNavigateToRegression={() => setActiveTab('regression')}
              onNavigateToBlockers={() => setActiveTab('blockers')}
              onNavigateToReadiness={() => setActiveTab('readiness')}
              onNavigateToReports={() => setActiveTab('team')}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectWorkspace
              currentUser={currentUser}
              activeProjectId={selectedProjectId}
              onSelectProject={(id) => setSelectedProjectId(id)}
            />
          )}

          {activeTab === 'tasks' && <TaskManagement currentUser={currentUser} />}

          {activeTab === 'bugs' && <BugManagement currentUser={currentUser} />}

          {activeTab === 'test-cases' && <TestCaseManagement currentUser={currentUser} />}

          {activeTab === 'regression' && <RegressionManagement currentUser={currentUser} />}

          {activeTab === 'blockers' && <BlockerManagement currentUser={currentUser} />}

          {activeTab === 'readiness' && <ReleaseReadinessDashboard currentUser={currentUser} />}

          {activeTab === 'workload' && <ReleaseReadinessDashboard currentUser={currentUser} />}

          {activeTab === 'team' && (
            <TeamManagement
              currentUser={currentUser}
              onNavigateToProject={handleNavigateToProject}
            />
          )}

          {activeTab === 'reports' && <ReportsAndExportView currentUser={currentUser} />}

          {(activeTab === 'team-reports' || activeTab === 'daily-report') && (
            <DailyReportsView currentUser={currentUser} />
          )}

          {activeTab === 'audit' && <AuditTrailView />}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => {
          const user = AuthService.getCurrentUser();
          handleUserChange(user);
        }}
      />

      {/* Deterministic Rule-Driven Check-In Standup Modal (100% Non-AI) */}
      <RuleDrivenCheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        currentUser={currentUser}
        onReportSubmitted={() => {
          // Re-render
        }}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(tab, entityId) => {
          if (tab === 'projects' && entityId) {
            setSelectedProjectId(entityId);
          }
          setActiveTab(tab);
        }}
      />

      {/* Internal Notification & Telegram Dispatch Center */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        currentUser={currentUser}
      />

      {/* Workload Assignment Modal */}
      <WorkloadAssignmentModal
        isOpen={isWorkloadAssignOpen}
        onClose={() => setIsWorkloadAssignOpen(false)}
        leadId={currentUser.id}
      />

      {/* Create QA Project Modal (Accessible via Top Header & Sidebar icons) */}
      {isCreateProjectOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
          currentUser={currentUser}
          onProjectCreated={(newProject) => {
            handleNavigateToProject(newProject.id);
          }}
        />
      )}
    </div>
  );
};

export default App;
