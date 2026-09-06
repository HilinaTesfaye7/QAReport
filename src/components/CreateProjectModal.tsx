import React, { useState } from 'react';
import {
  X,
  FolderKanban,
  FileText,
  Palette,
  Users,
  CheckCircle2,
  Calendar,
  Globe,
  Link,
  Shield,
  Send,
  Sparkles,
  Info,
  Layers,
  ListChecks,
} from 'lucide-react';
import { Project, User, DocumentMetadata } from '../types';
import { StorageService } from '../services/storage';
import { ProjectService } from '../services/projectService';
import { NotificationService } from '../services/notificationService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onProjectCreated: (newProject: Project) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProjectCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'prd' | 'design' | 'members'>('info');

  // Step 1: Project Info
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Testing' | 'Active' | 'Planning'>('Testing');
  const [targetReleaseDate, setTargetReleaseDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [testEnvUrl, setTestEnvUrl] = useState('https://staging-app.internal');
  const [projectOwner, setProjectOwner] = useState('David Chen (VP Product)');

  // Step 2: PRD (Requirements)
  const [prdTitle, setPrdTitle] = useState('');
  const [prdUrl, setPrdUrl] = useState('https://docs.bank.internal/prd/spec-v1');
  const [prdContent, setPrdContent] = useState(
    `# Functional Requirements & Acceptance Criteria\n\n## 1. Overview\nComprehensive QA validation of all feature modules and API services.\n\n## 2. Acceptance Criteria\n- Pass 100% of P0 smoke test cases before release.\n- 0 critical or blocker severity defects open in regression cycle.\n- API response time < 250ms for 95th percentile.\n- Figma layout tokens and responsive breakpoints verified.`
  );
  const [prdVersion, setPrdVersion] = useState('v1.0-RC');

  // Step 3: Design (Figma UI/UX) & Test Cases
  const [figmaUrl, setFigmaUrl] = useState('https://www.figma.com/file/aegis-design-system/prototype');
  const [testCaseUrl, setTestCaseUrl] = useState('');
  const [figmaPreviewTitle, setFigmaPreviewTitle] = useState('Mobile & Web UI Design Specs');
  const [figmaDescription, setFigmaDescription] = useState('Includes all responsive viewports, state machines, and micro-interaction tokens.');

  // Step 4: QA Team Members & Notifications
  const [allUsers, setAllUsers] = useState<User[]>(StorageService.getUsers());
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]); // Starts empty, no forced default members
  const [allowWithoutMembers, setAllowWithoutMembers] = useState(false);
  const [memberValidationError, setMemberValidationError] = useState<string | null>(null);
  const [notificationNote, setNotificationNote] = useState('Please prepare the test cases and submit them using /testcase');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      StorageService.syncUsersWithCloud().then((users) => {
        if (users && users.length > 0) setAllUsers(users);
      });
      setName('');
      setCode('');
      setDescription('');
      setStatus('Testing');
      setSelectedMemberIds([]);
      setAllowWithoutMembers(false);
      setMemberValidationError(null);
      setFeedbackMsg(null);
      setIsSubmitting(false);
      setActiveTab('info');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const updated = prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId];
      if (updated.length > 0) {
        setMemberValidationError(null);
      }
      return updated;
    });
  };

  const selectAllMembers = () => {
    setSelectedMemberIds(allUsers.map((u) => u.id));
    setMemberValidationError(null);
  };

  const clearAllMembers = () => {
    setSelectedMemberIds([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setActiveTab('info');
      return;
    }

    // If submitted while on an earlier tab (e.g. pressing Enter in an input), advance tab instead of closing
    if (activeTab !== 'members') {
      if (activeTab === 'info') setActiveTab('prd');
      else if (activeTab === 'prd') setActiveTab('design');
      else if (activeTab === 'design') setActiveTab('members');
      return;
    }

    // On final members tab: do not silently assign default or close without member selection
    if (selectedMemberIds.length === 0 && !allowWithoutMembers) {
      setMemberValidationError('⚠️ Please select at least one QA member below, or check "Create without assigning members".');
      return;
    }

    setMemberValidationError(null);
    setIsSubmitting(true);

    try {
      const documents: DocumentMetadata[] = [
        {
          id: `doc-${Date.now()}`,
          name: prdTitle || `${name} PRD Specification`,
          fileName: `${name.toLowerCase().replace(/\\s+/g, '-')}-prd.pdf`,
          fileSize: '2.4 MB',
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString().split('T')[0],
          version: prdVersion,
          downloadUrl: prdUrl,
        },
      ];

      const newProject = ProjectService.createProject(
        {
          name,
          description: description || `Quality assurance and test automation suite for ${name}.`,
          status,
          startDate: new Date().toISOString().split('T')[0],
          targetReleaseDate,
          projectOwner,
          qaLeadId: currentUser.id,
          memberIds: selectedMemberIds,
          resources: {
            prdTitle: prdTitle || `${name} Functional Specifications`,
            prdUrl,
            prdContent,
            prdDocuments: documents,
            figmaUrl,
            figmaName: `${name} UI Prototype`,
            figmaPreviewTitle: figmaPreviewTitle || `${name} UI/UX Specifications`,
            figmaDescription,
            figmaVersion: 'v2.4',
            testCaseUrl: testCaseUrl.trim() || undefined,
            testCaseTitle: testCaseUrl.trim() ? `${name} Test Cases` : undefined,
            requirements: [
              'REQ-01: Authentication & Token Lifecycle',
              'REQ-02: Core Feature Flow and Business Logic Validation',
              'REQ-03: Responsive Design Breakpoints Verification',
            ],
            testEnvUrl,
            repoUrl: `https://github.com/company/${name.toLowerCase().replace(/\\s+/g, '-')}`,
            buildVersion: 'v1.0.0-rc1',
            apiDocUrl: `${testEnvUrl}/swagger-ui`,
            testCredentials: [
              {
                role: 'QA Automation Engineer',
                user: 'qa.test@company.internal',
                pass: 'AegisPass#2026',
                notes: 'Staging environment pre-loaded test data profile',
              },
            ],
            releaseInfo: 'Sprint candidate validation window closes prior to release deployment.',
            importantNotes: 'Review all Figma auto-layout padding specs before marking UI tickets complete.',
          },
        },
        currentUser.id
      );

      // Ensure tombstone does not block newly created project
      const deletedIds: string[] = JSON.parse(localStorage.getItem('aegis_deleted_project_ids') || '[]');
      const filteredDeleted = deletedIds.filter((id) => id !== newProject.id);
      localStorage.setItem('aegis_deleted_project_ids', JSON.stringify(filteredDeleted));

      // Ensure Supabase cloud database receives the new project immediately
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('projects').upsert([{
            id: newProject.id,
            name: newProject.name,
            description: newProject.description,
            status: newProject.status,
            start_date: newProject.startDate,
            target_release_date: newProject.targetReleaseDate,
            project_owner: newProject.projectOwner,
            qa_lead_id: newProject.qaLeadId,
            member_ids: newProject.memberIds,
            resources: newProject.resources,
            qa_progress: newProject.qaProgress,
            regression_progress: newProject.regressionProgress,
            updated_at: new Date().toISOString(),
          }]);
        } catch (cloudErr) {
          console.warn('Supabase initial project upsert error:', cloudErr);
        }
      }

      // Explicitly trigger instant assignment notifications for all selected members
      if (selectedMemberIds.length > 0) {
        for (const mId of selectedMemberIds) {
          NotificationService.notifyProjectAssignment(
            newProject,
            mId,
            currentUser.id,
            notificationNote
          );

          // Update assigned project in Supabase telegram_profiles
          if (isSupabaseConfigured() && supabase) {
            const memberObj = allUsers.find((u) => u.id === mId);
            const chatId = memberObj?.telegramChatId || (mId.startsWith('usr-') ? mId.replace('usr-', '') : null);
            if (chatId && !isNaN(Number(chatId))) {
              supabase
                .from('telegram_profiles')
                .select('*')
                .eq('chat_id', chatId)
                .maybeSingle()
                .then(({ data: prof }) => {
                  if (prof) {
                    const updatedIds = Array.from(new Set([...(prof.assigned_project_ids || []), newProject.id]));
                    const updatedNames = Array.from(new Set([...(prof.assigned_projects || []), newProject.name]));
                    supabase
                      .from('telegram_profiles')
                      .update({
                        assigned_project_ids: updatedIds,
                        assigned_projects: updatedNames,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('chat_id', chatId)
                      .then(() => {});
                  }
                });
            }
          }
        }
      }

      // Cross-component broadcast
      window.dispatchEvent(new CustomEvent('aegis_storage_change', { detail: { key: 'aegis_projects' } }));

      setFeedbackMsg(
        selectedMemberIds.length > 0
          ? `Project "${newProject.name}" created! ${selectedMemberIds.length} member(s) assigned & notified.`
          : `Project "${newProject.name}" created (0 members assigned).`
      );

      setTimeout(() => {
        onProjectCreated(newProject);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to create project:', err);
      alert(err?.message || 'Error creating project.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
            >
              <FolderKanban size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Create QA Project & Allocate Squad
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                Portal Administrator • Add PRD, Design, and automatically notify assigned QA members
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Nav Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '0 16px',
          }}
        >
          {[
            { id: 'info', label: '1. Project Essentials', icon: FolderKanban },
            { id: 'prd', label: '2. PRD & Specs', icon: FileText },
            { id: 'design', label: '3. Design (Figma)', icon: Palette },
            { id: 'members', label: `4. Members & Notify (${selectedMemberIds.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                  background: 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} color={isActive ? '#38bdf8' : 'currentColor'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {feedbackMsg && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{feedbackMsg}</span>
              </div>
            )}

            {/* TAB 1: PROJECT ESSENTIALS */}
            {activeTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Project Name <span style={{ color: '#f43f5e' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NextGen Retail Mobile Banking"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!code) {
                          setCode(
                            e.target.value
                              .split(' ')
                              .map((w) => w[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 4)
                          );
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Short Code / Prefix
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. NMB"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                        textTransform: 'uppercase',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    QA Scope & Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the QA testing scope, key target platforms, and high-level milestones..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Initial Project Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                      }}
                    >
                      <option value="Testing">Active Testing</option>
                      <option value="Planning">Planning & Test Authoring</option>
                      <option value="Active">Active Development</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Target Release Date
                    </label>
                    <input
                      type="date"
                      value={targetReleaseDate}
                      onChange={(e) => setTargetReleaseDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Staging / Test Environment URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://staging.internal"
                      value={testEnvUrl}
                      onChange={(e) => setTestEnvUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Product Owner / Stakeholder
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. David Chen (VP Product)"
                      value={projectOwner}
                      onChange={(e) => setProjectOwner(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRD (PRODUCT REQUIREMENTS DOCUMENT) */}
            {activeTab === 'prd' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <FileText size={16} color="#38bdf8" />
                  <span>Attach PRD specifications, links, and acceptance criteria so assigned QA members can begin writing test cases immediately.</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      PRD Document Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Core Banking & Biometric Login PRD"
                      value={prdTitle}
                      onChange={(e) => setPrdTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Doc Version
                    </label>
                    <input
                      type="text"
                      placeholder="v1.0-RC"
                      value={prdVersion}
                      onChange={(e) => setPrdVersion(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    PRD External Document Link (Confluence / Google Doc / Notion)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="url"
                        placeholder="https://docs.company.internal/prd/..."
                        value={prdUrl}
                        onChange={(e) => setPrdUrl(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 34px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                        }}
                      />
                      <Link size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    PRD Content & Key Acceptance Criteria (Markdown supported)
                  </label>
                  <textarea
                    rows={7}
                    value={prdContent}
                    onChange={(e) => setPrdContent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      lineHeight: 1.6,
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: DESIGN (FIGMA SPECS) */}
            {activeTab === 'design' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Palette size={16} color="#c084fc" />
                  <span>Connect the Figma UI/UX prototype and design tokens for visual regression and responsive layout verification.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Figma Prototype / File URL <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="url"
                      required
                      placeholder="https://www.figma.com/file/..."
                      value={figmaUrl}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 34px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                      }}
                    />
                    <Palette size={14} color="#c084fc" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Test Cases Link (Google Sheets, Notion, TestRail, Jira - Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/... or Notion / TestRail"
                      value={testCaseUrl}
                      onChange={(e) => setTestCaseUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 34px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                      }}
                    />
                    <ListChecks size={14} color="#10b981" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Design System / Flow Reference Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. iOS & Android Design System v2.4"
                    value={figmaPreviewTitle}
                    onChange={(e) => setFigmaPreviewTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.86rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Design Specifications & UX Notes
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Detail specific layout tokens, spacing grids, auto-layout variants, dark mode requirements, etc..."
                    value={figmaDescription}
                    onChange={(e) => setFigmaDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 4: MEMBERS & AUTOMATIC NOTIFICATIONS */}
            {activeTab === 'members' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Send size={16} color="#10b981" />
                  <div>
                    <strong style={{ color: '#10b981' }}>Automatic Notification Guarantee:</strong> Every selected member will be automatically notified via In-App notification and Telegram message upon project creation.
                  </div>
                </div>

                {memberValidationError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      fontSize: '0.8rem',
                      color: '#f87171',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Info size={16} />
                    <span>{memberValidationError}</span>
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Select QA Team Members to Assign ({selectedMemberIds.length} selected):
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={selectAllMembers}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllMembers}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={allowWithoutMembers}
                        onChange={(e) => {
                          setAllowWithoutMembers(e.target.checked);
                          if (e.target.checked) setMemberValidationError(null);
                        }}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      <span>Create project without assigning team members now (Draft / Planning mode)</span>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    {allUsers.map((user) => {
                      const isSelected = selectedMemberIds.includes(user.id);
                      const isTelegramUser = user.name.toLowerCase() === 'coco' || user.id.includes('347835367');

                      return (
                        <div
                          key={user.id}
                          onClick={() => toggleMember(user.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-card-subtle)',
                            border: isSelected ? '1.5px solid #38bdf8' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={user.avatar}
                              alt={user.name}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', border: isSelected ? '2px solid #38bdf8' : '1px solid var(--border-subtle)' }}
                            />
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{user.name}</span>
                                {isTelegramUser && (
                                  <span
                                    style={{
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(56, 189, 248, 0.2)',
                                      color: '#38bdf8',
                                      fontSize: '0.62rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    ✈️ Telegram
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {user.role === 'qa_lead' ? 'QA Lead' : 'QA Engineer / Tester'} • {user.experienceYears}y exp
                              </div>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by card click
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Custom Assignment Message for Members
                  </label>
                  <textarea
                    rows={2}
                    value={notificationNote}
                    onChange={(e) => setNotificationNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              {activeTab !== 'info' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'prd') setActiveTab('info');
                    if (activeTab === 'design') setActiveTab('prd');
                    if (activeTab === 'members') setActiveTab('design');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Back
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              {activeTab !== 'members' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'info') setActiveTab('prd');
                    else if (activeTab === 'prd') setActiveTab('design');
                    else if (activeTab === 'design') setActiveTab('members');
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Next: {activeTab === 'info' ? 'PRD & Specs →' : activeTab === 'prd' ? 'Design (Figma) →' : 'Members →'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Send size={15} />
                  <span>
                    {isSubmitting
                      ? 'Creating...'
                      : selectedMemberIds.length > 0
                      ? `Create Project & Notify (${selectedMemberIds.length})`
                      : 'Create Project (No Members)'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
