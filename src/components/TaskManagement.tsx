import React, { useState, useEffect } from 'react';
import {
  ListTodo,
  Columns,
  ListFilter,
  Plus,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  User,
  ChevronRight,
  Filter,
  UserCheck,
  Check,
} from 'lucide-react';
import { QATask, TaskStatus, TaskPriority, User as UserType } from '../types';
import { StorageService } from '../services/storage';
import { TaskService } from '../services/taskService';
import { WorkloadAssignmentModal } from './WorkloadAssignmentModal';

interface TaskManagementProps {
  currentUser: UserType;
}

const ALL_STATUSES: TaskStatus[] = [
  'Backlog',
  'Assigned',
  'In Progress',
  'Blocked',
  'In Review',
  'Completed',
  'Cancelled',
];

export const TaskManagement: React.FC<TaskManagementProps> = ({ currentUser }) => {
  const [tasks, setTasks] = useState<QATask[]>(StorageService.getTasks());
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedTaskForAI, setSelectedTaskForAI] = useState<string | undefined>();

  // Task Creation Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('prj-banking');
  const [module, setModule] = useState('Payment Module');
  const [assigneeId, setAssigneeId] = useState('usr-hana');
  const [priority, setPriority] = useState<TaskPriority>('High');
  const [estimatedHours, setEstimatedHours] = useState(4);
  const [dueDate, setDueDate] = useState('2026-09-08');
  const [relatedRequirement, setRelatedRequirement] = useState('REQ-102: Instant Wire Transfer');

  const projects = StorageService.getProjects();
  const users = StorageService.getUsers();

  const reload = () => {
    setTasks(StorageService.getTasks());
  };

  useEffect(() => {
    reload();
    const handleStorage = () => reload();
    window.addEventListener('aegis_storage_change', handleStorage);
    return () => window.removeEventListener('aegis_storage_change', handleStorage);
  }, []);

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    let blocker = undefined;
    if (newStatus === 'Blocked') {
      blocker = prompt('Enter reason for blocker (e.g. Staging sandbox 500 error):');
      if (!blocker) return;
    }
    TaskService.updateTaskStatus(taskId, newStatus, currentUser.id, blocker);
    reload();
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    TaskService.createTask(
      {
        title,
        description,
        projectId,
        module,
        assigneeId,
        priority,
        estimatedEffortHours: estimatedHours,
        dueDate,
        status: 'Assigned',
        relatedRequirement,
      },
      currentUser.id
    );

    setIsCreateModalOpen(false);
    setTitle('');
    setDescription('');
    reload();
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterProject !== 'all' && t.projectId !== filterProject) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Critical':
        return <span className="badge badge-critical">Critical</span>;
      case 'High':
        return <span className="badge badge-high">High</span>;
      case 'Medium':
        return <span className="badge badge-normal">Medium</span>;
      case 'Low':
        return <span className="badge badge-available">Low</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListTodo size={22} color="#38bdf8" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>QA Task Management</h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Track QA testing items, regression modules, Figma validation, and bug retests.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: viewMode === 'kanban' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'kanban' ? '#38bdf8' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Columns size={15} /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: viewMode === 'list' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'list' ? '#38bdf8' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ListFilter size={15} /> List
            </button>
          </div>

          {currentUser.role === 'qa_lead' && (
            <button
              onClick={() => {
                setSelectedTaskForAI(undefined);
                setIsAssistantOpen(true);
              }}
              className="btn-secondary"
              style={{ fontSize: '0.8rem' }}
              title="Open deterministic workload-based assignment recommender"
            >
              <UserCheck size={15} color="#38bdf8" /> Smart Assignment
            </button>
          )}

          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <Plus size={16} /> New QA Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="all">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(240px, 1fr))',
            gap: '14px',
            overflowX: 'auto',
            paddingBottom: '16px',
          }}
        >
          {ALL_STATUSES.map((status) => {
            const columnTasks = filteredTasks.filter((t) => t.status === status);

            return (
              <div
                key={status}
                style={{
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  padding: '12px',
                  minHeight: '520px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {status}
                  </span>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {columnTasks.map((t) => {
                    const assignee = users.find((u) => u.id === t.assigneeId);

                    return (
                      <div
                        key={t.id}
                        className="card card-interactive"
                        style={{
                          padding: '12px',
                          background: 'var(--bg-card)',
                          borderRadius: '8px',
                          border: t.status === 'Blocked' ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          {getPriorityBadge(t.priority)}
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {t.estimatedEffortHours}h est
                          </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', lineHeight: 1.3 }}>
                          {t.title}
                        </div>

                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                          Module: {t.module}
                        </div>

                        {t.blockerReason && (
                          <div style={{ fontSize: '0.72rem', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '4px 6px', borderRadius: '4px', marginBottom: '8px' }}>
                            ⚠ {t.blockerReason}
                          </div>
                        )}

                        {t.status === 'Blocked' && (
                          <div style={{ marginBottom: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(t.id, 'In Progress')}
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: '#10b981',
                                border: 'none',
                                color: '#fff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                              }}
                              title="Resolve blocker and move task to In Progress"
                            >
                              <Check size={12} />
                              <span>Resolve Blocker</span>
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {assignee && (
                              <img
                                src={assignee.avatar}
                                alt={assignee.name}
                                title={assignee.name}
                                style={{ width: '22px', height: '22px', borderRadius: '50%' }}
                              />
                            )}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {assignee ? assignee.name.split(' ')[0] : 'Unassigned'}
                            </span>
                          </div>

                          {/* Quick Status Advance */}
                          <select
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                            style={{ fontSize: '0.68rem', padding: '2px 4px' }}
                          >
                            {ALL_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>Task Title</th>
                <th style={{ padding: '10px' }}>Module</th>
                <th style={{ padding: '10px' }}>Priority</th>
                <th style={{ padding: '10px' }}>Assignee</th>
                <th style={{ padding: '10px' }}>Effort</th>
                <th style={{ padding: '10px' }}>Due Date</th>
                <th style={{ padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const assignee = users.find((u) => u.id === t.assigneeId);

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 700 }}>{t.title}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{t.module}</td>
                    <td style={{ padding: '12px 10px' }}>{getPriorityBadge(t.priority)}</td>
                    <td style={{ padding: '12px 10px' }}>{assignee ? assignee.name : 'None'}</td>
                    <td style={{ padding: '12px 10px' }}>{t.estimatedEffortHours} hrs</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{t.dueDate}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {t.status === 'Blocked' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(t.id, 'In Progress')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#10b981',
                              border: 'none',
                              color: '#fff',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                            }}
                            title="Resolve blocker and mark In Progress"
                          >
                            <Check size={11} />
                            <span>Resolve</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Task */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create New QA Task</h2>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Execute Payment API regression suite"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Description & Testing Scope
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details, test steps, or acceptance requirements..."
                    required
                    style={{ width: '100%', minHeight: '60px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Project
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Module
                    </label>
                    <input
                      type="text"
                      value={module}
                      onChange={(e) => setModule(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Assignee</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTaskForAI(undefined);
                          setIsAssistantOpen(true);
                        }}
                        style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}
                        title="Open deterministic workload assignment recommender"
                      >
                        Smart Assign Match
                      </button>
                    </div>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {users
                        .filter((u) => u.role === 'qa_engineer')
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      style={{ width: '100%' }}
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Estimated Effort (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(parseInt(e.target.value) || 1)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create & Notify Assignee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule-Based Workload Assignment Modal */}
      <WorkloadAssignmentModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        selectedTaskId={selectedTaskForAI}
        leadId={currentUser.id}
        onTaskAssigned={reload}
      />
    </div>
  );
};
