import fs from 'fs';
import path from 'path';

export function loadReadinessConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'readiness_config.json'), 'utf-8'));
  } catch {
    return {
      weights: { testExecution: 25, passRate: 25, defectHealth: 20, blockers: 15, qaReporting: 15 },
      thresholds: { ready: 90, conditional: 75, highRisk: 60 },
      gates: { criticalDefectBlocksRelease: true, criticalBlockerBlocksRelease: true, mandatoryRegressionRequired: true }
    };
  }
}

/**
 * Calculates Readiness Score for a project.
 * Uses daily checkin aggregate or actual test case integration if provided.
 */
export function calculateReadinessScore(projectId, testData, defectData, reportingData) {
  const config = loadReadinessConfig();
  const weights = config.weights;
  
  // 1. Execution Score (Cap at 100%)
  const executionPct = Math.min(100, (testData.executed / Math.max(1, testData.planned)) * 100);
  const executionPoints = (executionPct / 100) * weights.testExecution;

  // 2. Pass Rate Score
  const passPct = testData.executed > 0 ? (testData.passed / testData.executed) * 100 : 0;
  const passPoints = (passPct / 100) * weights.passRate;

  // 3. Defect Health (Subtract points for open defects)
  // Max score is 100%, subtract 20% for Critical, 10% for High, 5% for Medium
  let defectPct = 100;
  defectPct -= (defectData.critical * 40);
  defectPct -= (defectData.high * 15);
  defectPct -= (defectData.medium * 5);
  defectPct -= (defectData.low * 1);
  defectPct = Math.max(0, defectPct);
  const defectPoints = (defectPct / 100) * weights.defectHealth;

  // 4. Blocker Score
  let blockerPct = 100 - (defectData.activeBlockers * 25);
  blockerPct = Math.max(0, blockerPct);
  const blockerPoints = (blockerPct / 100) * weights.blockers;

  // 5. QA Reporting
  const reportingPct = Math.min(100, (reportingData.submitted / Math.max(1, reportingData.expected)) * 100);
  const reportingPoints = (reportingPct / 100) * weights.qaReporting;

  const totalScore = executionPoints + passPoints + defectPoints + blockerPoints + reportingPoints;
  
  let status = 'NOT READY';
  let emoji = '🔴';
  if (totalScore >= config.thresholds.ready) { status = 'READY FOR RELEASE'; emoji = '🟢'; }
  else if (totalScore >= config.thresholds.conditional) { status = 'CONDITIONAL RELEASE'; emoji = '🟡'; }
  else if (totalScore >= config.thresholds.highRisk) { status = 'HIGH RISK'; emoji = '🟠'; }

  // Check Gates
  let gateBlocked = false;
  let gateReason = [];
  if (config.gates.criticalDefectBlocksRelease && defectData.critical > 0) {
    gateBlocked = true;
    gateReason.push('Critical defect is still open.');
  }
  if (config.gates.criticalBlockerBlocksRelease && defectData.activeBlockers > 0) {
    gateBlocked = true;
    gateReason.push('Critical QA blocker is still active.');
  }

  return {
    score: Number(totalScore.toFixed(1)),
    status: gateBlocked ? 'BLOCKED' : status,
    emoji: gateBlocked ? '🚨' : emoji,
    gateBlocked,
    gateReason,
    components: {
      execution: { pct: executionPct, pts: executionPoints, max: weights.testExecution },
      passRate: { pct: passPct, pts: passPoints, max: weights.passRate },
      defectHealth: { pct: defectPct, pts: defectPoints, max: weights.defectHealth },
      blockers: { pct: blockerPct, pts: blockerPoints, max: weights.blockers },
      qaReporting: { pct: reportingPct, pts: reportingPoints, max: weights.qaReporting }
    }
  };
}
