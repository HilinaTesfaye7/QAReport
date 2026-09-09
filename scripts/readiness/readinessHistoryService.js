import fs from 'fs';
import path from 'path';

const READINESS_HISTORY_FILE = path.resolve(process.cwd(), 'readiness_history.json');

if (!fs.existsSync(READINESS_HISTORY_FILE)) {
  fs.writeFileSync(READINESS_HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
}

export function loadReadinessHistory() {
  try {
    return JSON.parse(fs.readFileSync(READINESS_HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveReadinessSnapshot(snapshot) {
  const history = loadReadinessHistory();
  const dateStr = new Date().toISOString().split('T')[0];
  
  // Replace if exists for today
  const filtered = history.filter(h => !(h.projectId === snapshot.projectId && h.date === dateStr));
  
  snapshot.date = dateStr;
  filtered.push(snapshot);
  
  fs.writeFileSync(READINESS_HISTORY_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
}

export function getProjectReadinessTrend(projectId) {
  const history = loadReadinessHistory().filter(h => h.projectId === projectId).sort((a,b) => new Date(b.date) - new Date(a.date));
  return history.slice(0, 5); // Last 5 days
}
