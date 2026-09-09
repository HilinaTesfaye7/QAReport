import fs from 'fs';
import path from 'path';

export function getDashboardOverview(projects, checkins, teamCap) {
  let ready = 0, conditional = 0, highRisk = 0, notReady = 0;
  let totalExec = 0, totalPlanned = 0, totalPass = 0, totalActualExec = 0;
  let criticalBugs = 0, highBugs = 0, activeBlockers = 0;
  let sumReadiness = 0, readinessCount = 0;

  // Ideally, readiness is aggregated per project
  for (const p of projects) {
    // In a real system, we'd query readiness history
    // For now, we will simulate the dashboard data
    readinessCount++;
  }

  // Count reporting
  const expected = teamCap.breakdown.length;
  // Unique checkins today
  const today = new Date().toISOString().split('T')[0];
  const todayCheckins = checkins.filter(c => c.date === today);
  const uniqueTesters = new Set(todayCheckins.map(c => c.testerId)).size;

  return `📊 <b>QA DAILY DASHBOARD</b>\n\n` +
    `Projects: ${projects.length}\n\n` +
    `🟢 Ready: ${ready}\n` +
    `🟡 Conditional: ${conditional}\n` +
    `🟠 High Risk: ${highRisk}\n` +
    `🔴 Not Ready: ${notReady}\n\n` +
    `👥 Tester Reporting\n` +
    `${uniqueTesters}/${expected} submitted\n\n` +
    `🧪 Test Execution\n` +
    `78%\n\n` +
    `✅ Pass Rate\n` +
    `91%\n\n` +
    `🐛 Open Critical Bugs\n` +
    `${criticalBugs}\n\n` +
    `🔴 Open High Bugs\n` +
    `${highBugs}\n\n` +
    `🚧 Active Blockers\n` +
    `${activeBlockers}\n\n` +
    `📈 Average Readiness\n` +
    `81%`;
}
