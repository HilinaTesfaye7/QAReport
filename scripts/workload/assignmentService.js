/**
 * Assignment Service
 * Manages tester allocations to projects.
 */
import fs from 'fs';
import path from 'path';

const ASSIGNMENTS_FILE = path.resolve(process.cwd(), 'assignments.json');

// Initialize if it doesn't exist
if (!fs.existsSync(ASSIGNMENTS_FILE)) {
  fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/**
 * Loads all assignments from the JSON file.
 * @returns {Array}
 */
function loadAssignments() {
  try {
    const data = fs.readFileSync(ASSIGNMENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load assignments:', err);
    return [];
  }
}

/**
 * Saves assignments to the JSON file.
 * @param {Array} assignments 
 */
function saveAssignments(assignments) {
  try {
    fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(assignments, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save assignments:', err);
  }
}

/**
 * Gets all active assignments for a specific tester.
 * @param {string} testerId 
 * @returns {Array}
 */
function getTesterAssignments(testerId) {
  const assignments = loadAssignments();
  return assignments.filter(a => a.testerId === testerId && a.status === 'Active');
}

/**
 * Gets all active assignments for a specific project.
 * @param {string} projectId 
 * @returns {Array}
 */
function getProjectAssignments(projectId) {
  const assignments = loadAssignments();
  return assignments.filter(a => a.projectId === projectId && a.status === 'Active');
}

/**
 * Creates or updates a tester's assignment to a project.
 * @param {string} testerId 
 * @param {string} projectId 
 * @param {number} allocationPercentage 
 */
function assignTesterToProject(testerId, projectId, allocationPercentage) {
  const assignments = loadAssignments();
  const existingIndex = assignments.findIndex(a => a.testerId === testerId && a.projectId === projectId && a.status === 'Active');

  if (existingIndex >= 0) {
    assignments[existingIndex].allocationPercentage = allocationPercentage;
  } else {
    assignments.push({
      id: `asg-${Date.now().toString(36)}`,
      testerId,
      projectId,
      allocationPercentage,
      startDate: new Date().toISOString(),
      status: 'Active'
    });
  }

  saveAssignments(assignments);
}

/**
 * Removes a tester from a project.
 * @param {string} testerId 
 * @param {string} projectId 
 */
function removeTesterFromProject(testerId, projectId) {
  const assignments = loadAssignments();
  const existingIndex = assignments.findIndex(a => a.testerId === testerId && a.projectId === projectId && a.status === 'Active');

  if (existingIndex >= 0) {
    assignments[existingIndex].status = 'Removed';
    assignments[existingIndex].endDate = new Date().toISOString();
    saveAssignments(assignments);
  }
}

export {
  loadAssignments,
  getTesterAssignments,
  getProjectAssignments,
  assignTesterToProject,
  removeTesterFromProject
};
