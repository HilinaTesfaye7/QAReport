/**
 * QA Workload Calculator Module
 * Calculates the recommended QA Workload percentage for a project based on its properties.
 */

const WEIGHTS = {
  complexity: {
    Low: 2,
    Medium: 5,
    High: 8,
    Critical: 12,
  },
  testingScope: {
    Web: 3,
    Mobile: 4,
    'TV/Desktop': 5,
    API: 3,
    'Web + Mobile': 7,
    'Web + API': 6,
    'Mobile + API': 7,
    'Full stack': 10,
  },
  featureCount: {
    '1-5': 2,
    '6-15': 5,
    '16-30': 7,
    '30+': 10,
  },
  regressionSize: {
    Small: 2,
    Medium: 4,
    Large: 6,
    'Very Large': 8,
  },
  releaseFrequency: {
    Monthly: 2,
    'Bi-weekly': 3,
    Weekly: 5,
    'Multiple times per week': 7,
  },
};

/**
 * Calculates the recommended QA Workload percentage for a project.
 * @param {Object} projectData
 * @returns {Object} { total: number, breakdown: Array<{factor: string, value: string, impact: number}> }
 */
function calculateProjectWorkload(projectData) {
  let total = 0;
  const breakdown = [];

  const addFactor = (name, value, weightMap) => {
    if (!value) return;
    const impact = weightMap[value] || 0;
    if (impact > 0) {
      total += impact;
      breakdown.push({ factor: name, value, impact });
    }
  };

  addFactor('Complexity', projectData.complexity, WEIGHTS.complexity);
  addFactor('Testing Scope', projectData.testingScope, WEIGHTS.testingScope);
  addFactor('Features', projectData.featureCount, WEIGHTS.featureCount);
  addFactor('Regression', projectData.regressionSize, WEIGHTS.regressionSize);
  addFactor('Release', projectData.releaseFrequency, WEIGHTS.releaseFrequency);

  // Base minimum project weight
  if (total < 5) total = 5;

  return { total, breakdown };
}

/**
 * Formats the breakdown explanation for Telegram messages.
 * @param {Object} calculationResult
 * @returns {string}
 */
function formatCalculationExplanation(calculationResult) {
  let msg = `<b>Suggested workload: ${calculationResult.total}%</b>\n\n`;
  msg += `<i>Calculation:</i>\n`;
  
  for (const item of calculationResult.breakdown) {
    // Pad factor name to align
    const paddedFactor = item.factor.padEnd(16, ' ');
    const paddedValue = String(item.value).padEnd(12, ' ');
    msg += `<code>${paddedFactor} ${paddedValue} +${item.impact}%</code>\n`;
  }
  
  msg += `\n<b>Suggested Total: ${calculationResult.total}%</b>`;
  return msg;
}

export {
  calculateProjectWorkload,
  formatCalculationExplanation,
  WEIGHTS
};
