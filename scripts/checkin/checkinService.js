import fs from 'fs';
import path from 'path';

const CHECKINS_FILE = path.resolve(process.cwd(), 'checkins.json');

if (!fs.existsSync(CHECKINS_FILE)) {
  fs.writeFileSync(CHECKINS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

export function loadCheckins() {
  try {
    return JSON.parse(fs.readFileSync(CHECKINS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveCheckin(checkinData) {
  const checkins = loadCheckins();
  checkinData.id = `chk-${Date.now().toString(36)}`;
  checkinData.date = new Date().toISOString().split('T')[0];
  checkins.push(checkinData);
  fs.writeFileSync(CHECKINS_FILE, JSON.stringify(checkins, null, 2), 'utf-8');
  return checkinData;
}

export function getProjectCheckins(projectId) {
  return loadCheckins().filter(c => c.projectId === projectId);
}
