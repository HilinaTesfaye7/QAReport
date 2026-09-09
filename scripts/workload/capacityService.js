/**
 * Capacity Service
 * Computes individual and team capacities.
 */
import { getTesterAssignments } from './assignmentService.js';
import fs from 'fs';
import path from 'path';

const PROFILES_FILE = path.resolve(process.cwd(), 'telegram_profiles.json');
const PROJECTS_FILE = path.resolve(process.cwd(), 'projects.json');

function loadProfiles() {
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function loadProjects() {
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Gets a specific project's effective workload (base + release adjustment).
 */
function getEffectiveProjectWorkload(projectId) {
  const projects = loadProjects();
  const proj = projects.find(p => p.id === projectId);
  if (!proj) return 0;
  
  // Base workload
  const baseWorkload = proj.workload?.approvedPercentage || proj.workload?.calculatedPercentage || 20;
  // Release adjustment
  const releaseAdjustment = proj.workload?.releaseAdjustment || 0;
  
  return baseWorkload + releaseAdjustment;
}

/**
 * Computes the total workload for a specific tester.
 */
function getTesterCapacity(testerId) {
  const assignments = getTesterAssignments(testerId);
  let totalWorkload = 0;
  
  const projects = loadProjects();
  
  for (const asg of assignments) {
    const proj = projects.find(p => p.id === asg.projectId);
    if (!proj) continue;
    
    // Check if there is an active release adjustment on the project itself
    const releaseAdj = proj.workload?.releaseAdjustment || 0;
    
    // We apply the allocation percentage directly + any raw release adjustment
    // (Alternatively, the release adjustment could be proportional to the allocation)
    // For simplicity, we apply proportional release adjustment:
    const baseWeight = proj.workload?.approvedPercentage || proj.workload?.calculatedPercentage || 20;
    const proportion = baseWeight > 0 ? (asg.allocationPercentage / baseWeight) : 1;
    
    totalWorkload += asg.allocationPercentage + Math.round(releaseAdj * proportion);
  }
  
  return {
    totalWorkload,
    availableCapacity: Math.max(0, 100 - totalWorkload),
    isOverloaded: totalWorkload > 100,
    statusEmoji: totalWorkload <= 70 ? '🟢' : (totalWorkload <= 90 ? '🟢' : (totalWorkload <= 100 ? '🟡' : (totalWorkload <= 115 ? '🟠' : '🔴')))
  };
}

/**
 * Computes aggregate team capacity metrics.
 */
function getTeamCapacity() {
  const profiles = loadProfiles();
  const activeTesters = Object.keys(profiles).map(k => ({ id: `usr-${k}`, ...profiles[k] }));
  
  let totalTeamCapacity = activeTesters.length * 100;
  let totalAllocated = 0;
  
  const breakdown = [];

  for (const tester of activeTesters) {
    const cap = getTesterCapacity(tester.id);
    totalAllocated += cap.totalWorkload;
    breakdown.push({
      testerId: tester.id,
      name: tester.fullName,
      role: tester.role,
      workload: cap.totalWorkload,
      available: cap.availableCapacity,
      emoji: cap.statusEmoji
    });
  }
  
  const utilization = totalTeamCapacity > 0 ? Math.round((totalAllocated / totalTeamCapacity) * 100) : 0;
  
  return {
    totalTeamCapacity,
    totalAllocated,
    availableCapacity: Math.max(0, totalTeamCapacity - totalAllocated),
    utilization,
    breakdown
  };
}

/**
 * Generates visual ASCII progress bar.
 */
function generateCapacityBar(percentage) {
  const totalBlocks = 20;
  // Cap at 20 blocks for rendering
  const filledBlocks = Math.min(totalBlocks, Math.round((percentage / 100) * totalBlocks));
  const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);
  
  return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks) + ` ${percentage}%`;
}

export {
  getEffectiveProjectWorkload,
  getTesterCapacity,
  getTeamCapacity,
  generateCapacityBar
};
