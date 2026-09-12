import fs from 'fs';
import path from 'path';
import { mockUsers } from './mockUsers.js';

export const INITIAL_TASKS = [];

export const INITIAL_BUGS = [];

export const INITIAL_TEST_CASES = [];

export const INITIAL_BLOCKERS = [];

// Read projects.json if it exists, otherwise return a minimal set
export function getMockProjects() {
  const projectsPath = path.resolve(process.cwd(), 'projects.json');
  if (fs.existsSync(projectsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      return data.map(p => ({
        ...p,
        qaLeadId: p.qaLeadId || p.qa_lead_id || 'usr-lead-a'
      }));
    } catch (e) {
      return [];
    }
  }
  return [];
}

export function getMockUsers() {
  return mockUsers;
}

export function getMockTasks() {
  return INITIAL_TASKS;
}

export function getMockBugs() {
  return INITIAL_BUGS;
}

export function getMockTestCases() {
  return INITIAL_TEST_CASES;
}

export function getMockBlockers() {
  return INITIAL_BLOCKERS;
}
