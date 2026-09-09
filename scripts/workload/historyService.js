/**
 * History Service
 * Tracks historical workload data for trend analysis.
 */
import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.resolve(process.cwd(), 'workload_history.json');

// Initialize if it doesn't exist
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
}

function loadHistory() {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save workload history:', err);
  }
}

/**
 * Saves a daily snapshot of a tester's workload.
 */
function recordDailySnapshot(testerId, totalWorkload) {
  const history = loadHistory();
  const dateStr = new Date().toISOString().split('T')[0];

  // Remove existing entry for the same day if it exists
  const filtered = history.filter(h => !(h.testerId === testerId && h.date === dateStr));

  filtered.push({
    testerId,
    date: dateStr,
    workload: totalWorkload,
    availableCapacity: Math.max(0, 100 - totalWorkload),
    isOverloaded: totalWorkload > 100
  });

  saveHistory(filtered);
}

/**
 * Calculates trend metrics for a tester over the last 7 days.
 */
function getTesterTrend(testerId) {
  const history = loadHistory();
  const testerHistory = history.filter(h => h.testerId === testerId)
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // descending

  if (testerHistory.length === 0) return null;

  const last7Days = testerHistory.slice(0, 7);
  const sum = last7Days.reduce((acc, curr) => acc + curr.workload, 0);
  const average7Day = Math.round(sum / last7Days.length);

  // Consecutive overloaded days
  let overloadedDays = 0;
  for (const record of last7Days) {
    if (record.isOverloaded) overloadedDays++;
    else break;
  }

  // Trend analysis (compare current to average)
  const current = last7Days[0].workload;
  let trend = '➡️ Stable';
  if (current > average7Day + 5) trend = '📈 Increasing ↑';
  else if (current < average7Day - 5) trend = '📉 Decreasing ↓';

  return {
    current,
    average7Day,
    overloadedDays,
    trend,
    history: last7Days.map(h => ({ date: h.date, workload: h.workload }))
  };
}

export {
  recordDailySnapshot,
  getTesterTrend
};
