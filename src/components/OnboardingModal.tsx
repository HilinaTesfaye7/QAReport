import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Sparkles, Plus, Search, HelpCircle } from 'lucide-react';
import { TestingSkill, ProjectAllocation, UserRole, Project } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storage';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ALL_SKILLS: TestingSkill[] = [
  'Manual Testing',
  'UI Testing',
  'API Testing',
  'Performance Testing',
  'Mobile Testing',
  'Web Testing',
  'Desktop Testing',
  'Database Testing',
  'Security Testing',
  'Other',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const projects = StorageService.getProjects();

  // Step 1: Personal Info
  const [name, setName] = useState('Alex Rivera');
  const [email, setEmail] = useState('alex.rivera@qa-aegis.com');
  const [role, setRole] = useState<UserRole>('qa_engineer');
  const [experienceYears, setExperienceYears] = useState(4);
  const [selectedSkills, setSelectedSkills] = useState<TestingSkill[]>([
    'Manual Testing',
    'API Testing',
    'Mobile Testing',
  ]);

  // Step 2: Project Selection & Allocations
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(['prj-banking']);
  const [allocations, setAllocations] = useState<{ [key: string]: number }>({
    'prj-banking': 100,
  });
  const [customProjectRequested, setCustomProjectRequested] = useState('');

  // Step 3: Baseline QA Context
  const [currentWork, setCurrentWork] = useState('Setting up initial mobile regression test suites');
  const [biggestBlocker, setBiggestBlocker] = useState('Waiting on VPN configuration for Staging DB access');
  const [assignedTasks, setAssignedTasks] = useState('Onboarding documentation and test environment checkout');
  const [waitingOnOthers, setWaitingOnOthers] = useState('IT Security ticket #892 for test credentials');
  const [expectedToday, setExpectedToday] = useState('Complete baseline test execution on Banking SuperApp login');
  const [leadNotes, setLeadNotes] = useState('Available to assist with Payment API testing starting tomorrow');

  if (!isOpen) return null;

  const toggleSkill = (skill: TestingSkill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const toggleProject = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      const next = selectedProjectIds.filter((id) => id !== projectId);
      setSelectedProjectIds(next);
      const newAlloc = { ...allocations };
      delete newAlloc[projectId];
      // Distribute evenly
      if (next.length > 0) {
        const share = Math.floor(100 / next.length);
        next.forEach((id) => {
          newAlloc[id] = share;
        });
      }
      setAllocations(newAlloc);
    } else {
      const next = [...selectedProjectIds, projectId];
      setSelectedProjectIds(next);
      const share = Math.floor(100 / next.length);
      const newAlloc: { [key: string]: number } = {};
      next.forEach((id) => {
        newAlloc[id] = share;
      });
      setAllocations(newAlloc);
    }
  };

  const handleAllocationChange = (projectId: string, value: number) => {
    setAllocations({
      ...allocations,
      [projectId]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedAllocations: ProjectAllocation[] = selectedProjectIds.map((id) => ({
      projectId: id,
      percentage: allocations[id] || 50,
    }));

    AuthService.completeOnboarding({
      name,
      email,
      role,
      experienceYears,
      skills: selectedSkills,
      projectAllocations: formattedAllocations,
      baselineContext: {
        currentWork,
        biggestBlocker,
        assignedTasks,
        waitingOnOthers,
        expectedToday,
        leadNotes,
      },
    });

    onComplete();
    onClose();
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', padding: '28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#a855f7" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Welcome to AegisQA</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Step {step} of 3: {step === 1 ? 'Personal Profile & Skills' : step === 2 ? 'Project Selection & Allocations' : 'QA Baseline & Context'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: s <= step ? 'linear-gradient(90deg, #38bdf8, #6366f1)' : 'var(--border-subtle)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Step 1: Personal Info & Skills */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  QA Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  style={{ width: '100%' }}
                >
                  <option value="qa_engineer">QA Engineer / Tester</option>
                  <option value="qa_lead">QA Lead / Manager</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Years of QA Experience
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>
                Primary Testing Skills (Select all that apply)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ALL_SKILLS.map((skill) => {
                  const active = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: active ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: active ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card-subtle)',
                        color: active ? '#38bdf8' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {active && <Check size={14} />}
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setStep(2)} className="btn-primary">
                Next: Project Selection <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Project Selection & Allocations */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              "What project or projects are you currently working on?"
            </p>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search projects created by QA Lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '34px' }}
              />
            </div>

            {/* Project List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '16px' }}>
              {filteredProjects.map((prj) => {
                const selected = selectedProjectIds.includes(prj.id);
                return (
                  <div
                    key={prj.id}
                    onClick={() => toggleProject(prj.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: selected ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                      background: selected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{prj.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Status: {prj.status} • Env: {prj.resources.testEnvUrl}
                      </div>
                    </div>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: selected ? '2px solid #38bdf8' : '2px solid var(--border-subtle)',
                        background: selected ? '#38bdf8' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected && <Check size={14} color="#000" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Multi-Project Workload Allocation */}
            {selectedProjectIds.length > 1 && (
              <div style={{ padding: '12px', background: 'var(--bg-card-hover)', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#38bdf8' }}>
                  Workload Allocation Per Project (% Time)
                </div>
                {selectedProjectIds.map((id) => {
                  const prj = projects.find((p) => p.id === id);
                  const val = allocations[id] || 50;
                  return (
                    <div key={id} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span>{prj?.name}</span>
                        <span style={{ fontWeight: 700 }}>{val}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        value={val}
                        onChange={(e) => handleAllocationChange(id, parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#38bdf8' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Request Access to another project */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Working on a different project not listed above?
              </label>
              <input
                type="text"
                placeholder="Request access or name a project..."
                value={customProjectRequested}
                onChange={(e) => setCustomProjectRequested(e.target.value)}
                style={{ width: '100%', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button onClick={() => setStep(1)} className="btn-secondary">
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="btn-primary"
                disabled={selectedProjectIds.length === 0}
              >
                Next: Baseline Context <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: First-Time QA Baseline */}
        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Provide your initial QA baseline so the AI bot and QA Lead understand your current state:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  What are you currently working on?
                </label>
                <input
                  type="text"
                  value={currentWork}
                  onChange={(e) => setCurrentWork(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  What is your current biggest blocker?
                </label>
                <input
                  type="text"
                  value={biggestBlocker}
                  onChange={(e) => setBiggestBlocker(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Are you waiting for anything from another team?
                </label>
                <input
                  type="text"
                  value={waitingOnOthers}
                  onChange={(e) => setWaitingOnOthers(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  What do you expect to complete today?
                </label>
                <input
                  type="text"
                  value={expectedToday}
                  onChange={(e) => setExpectedToday(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Is there anything the QA Lead should know?
                </label>
                <input
                  type="text"
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="submit" className="btn-primary">
                Complete Onboarding & Start <Check size={16} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
