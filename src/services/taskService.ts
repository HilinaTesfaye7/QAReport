import { QATask, TaskStatus, TaskPriority } from '../types';
import { StorageService } from './storage';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { AuthService } from './authService';

export const TaskService = {
  getTasks: (): QATask[] => {
    return StorageService.getTasks();
  },

  getTaskById: (id: string): QATask | undefined => {
    return StorageService.getTasks().find((t) => t.id === id);
  },

  getTasksByAssignee: (assigneeId: string): QATask[] => {
    return StorageService.getTasks().filter((t) => t.assigneeId === assigneeId);
  },

  getTasksByProject: (projectId: string): QATask[] => {
    return StorageService.getTasks().filter((t) => t.projectId === projectId);
  },

  createTask: (
    taskData: Omit<QATask, 'id' | 'createdAt' | 'updatedAt'>,
    actorId: string
  ): QATask => {
    // RBAC: Only QA Lead creates tasks
    AuthService.requireLeadPermission(actorId);

    const tasks = StorageService.getTasks();
    const now = new Date().toISOString().split('T')[0];
    const newTask: QATask = {
      ...taskData,
      id: `tsk-${Date.now().toString(36)}`,
      createdAt: now,
      updatedAt: now,
    };

    tasks.unshift(newTask);
    StorageService.saveTasks(tasks);

    AuditService.log({
      actorId,
      action: 'Created QA Task',
      entityType: 'task',
      entityId: newTask.id,
      newValue: `[${newTask.priority}] ${newTask.title}`,
    });

    if (newTask.assigneeId) {
      NotificationService.notifyTaskAssignment(newTask, newTask.assigneeId);
    }

    return newTask;
  },

  updateTaskStatus: (
    taskId: string,
    newStatus: TaskStatus,
    actorId: string,
    notes?: string
  ): QATask => {
    const tasks = StorageService.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const previousStatus = task.status;
    task.status = newStatus;
    task.updatedAt = new Date().toISOString().split('T')[0];

    if (newStatus === 'Completed') {
      task.completionDate = new Date().toISOString().split('T')[0];
    }
    if (notes) {
      task.notes = notes;
    }

    StorageService.saveTasks(tasks);

    AuditService.log({
      actorId,
      action: 'Task Status Updated',
      entityType: 'task',
      entityId: taskId,
      previousValue: previousStatus,
      newValue: newStatus + (notes ? ` (Notes: ${notes})` : ''),
    });

    return task;
  },

  assignTask: (
    taskId: string,
    newAssigneeId: string,
    actorId: string
  ): QATask => {
    AuthService.requireLeadPermission(actorId);

    const tasks = StorageService.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const prevAssignee = task.assigneeId;
    task.assigneeId = newAssigneeId;
    task.updatedAt = new Date().toISOString().split('T')[0];
    StorageService.saveTasks(tasks);

    AuditService.log({
      actorId,
      action: 'Reassigned QA Task',
      entityType: 'task',
      entityId: taskId,
      previousValue: `Assignee: ${prevAssignee}`,
      newValue: `Assignee: ${newAssigneeId}`,
    });

    NotificationService.notifyTaskAssignment(task, newAssigneeId);

    return task;
  },

  updateTask: (
    taskId: string,
    updates: Partial<QATask>,
    actorId: string
  ): QATask => {
    const tasks = StorageService.getTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error('Task not found');

    const previous = tasks[idx];
    tasks[idx] = {
      ...previous,
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    StorageService.saveTasks(tasks);

    AuditService.log({
      actorId,
      action: 'Updated QA Task Details',
      entityType: 'task',
      entityId: taskId,
      newValue: updates.title || 'Task updated',
    });

    return tasks[idx];
  },
};
