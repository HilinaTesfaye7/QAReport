/**
 * Alert Service
 * Detects workload imbalances, overloads, and generates warnings.
 */
import { getTeamCapacity } from './capacityService.js';
import { getTesterTrend } from './historyService.js';

/**
 * Generates an assignment warning if a new allocation pushes a tester over 100%.
 */
function getAssignmentWarning(testerId, testerName, currentWorkload, newAllocation) {
  const newWorkload = currentWorkload + newAllocation;
  if (newWorkload > 100) {
    const excess = newWorkload - 100;
    return `⚠️ <b>Assignment Warning</b>\n\n` +
           `This assignment will increase workload for ${testerName}:\n` +
           `<b>${currentWorkload}% ➡️ ${newWorkload}%</b>\n\n` +
           `The tester will exceed capacity by <b>${excess}%</b>.\n\n` +
           `<i>[Assign Anyway] or [Choose Another Tester]</i>`;
  }
  return null;
}

/**
 * Recommends the best testers for a new project based on available capacity.
 */
function getBestTesterRecommendations(requiredAllocation) {
  const team = getTeamCapacity();
  const candidates = [...team.breakdown];
  
  // Sort by available capacity (descending)
  candidates.sort((a, b) => b.available - a.available);
  
  let msg = `<b>Recommended Testers</b>\n\n`;
  const medals = ['🥇', '🥈', '🥉'];
  
  let hasValidCandidate = false;
  
  candidates.forEach((c, index) => {
    let icon = c.workload > 100 ? '🔴' : (index < 3 ? medals[index] : '•');
    let availStr = c.available >= requiredAllocation 
      ? `<b>${c.available}% available</b>` 
      : (c.workload > 100 ? `<b>Overloaded</b>` : `Only ${c.available}% available`);
      
    if (c.available >= requiredAllocation) hasValidCandidate = true;
      
    msg += `${icon} <b>${c.name}</b>\n`;
    msg += `Current: ${c.workload}%\n`;
    msg += `${availStr}\n\n`;
  });
  
  if (!hasValidCandidate) {
    msg = `⚠️ <b>No tester currently has enough available capacity (${requiredAllocation}%).</b>\n\n` + msg;
  }
  
  return msg;
}

/**
 * Analyzes the team and detects imbalances.
 */
function getImbalanceAlerts() {
  const team = getTeamCapacity();
  const overloaded = team.breakdown.filter(t => t.workload > 100);
  const underutilized = team.breakdown.filter(t => t.workload <= 70);
  
  if (overloaded.length > 0 && underutilized.length > 0) {
    // Just find the most overloaded and most underutilized
    const maxOver = overloaded.reduce((prev, current) => (prev.workload > current.workload) ? prev : current);
    const maxUnder = underutilized.reduce((prev, current) => (prev.available > current.available) ? prev : current);
    
    return `💡 <b>Workload imbalance detected.</b>\n\n` +
           `${maxOver.name} is overloaded (${maxOver.workload}%) while ${maxUnder.name} has ${maxUnder.available}% available capacity.`;
  }
  
  return null;
}

export {
  getAssignmentWarning,
  getBestTesterRecommendations,
  getImbalanceAlerts
};
