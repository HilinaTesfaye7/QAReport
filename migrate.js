// Backfill existing assignments from profiles to assignments.json
import fs from 'fs';
import path from 'path';
import { assignTesterToProject } from './scripts/workload/assignmentService.js';

const PROFILES_FILE = path.resolve(process.cwd(), 'telegram_profiles.json');

try {
  const profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
  for (const chatId in profiles) {
    const profile = profiles[chatId];
    if (profile.assignedProjectIds && profile.assignedProjectIds.length > 0) {
      for (const projectId of profile.assignedProjectIds) {
        // Default allocation 20% for backfilled projects
        assignTesterToProject(`usr-${chatId}`, projectId, 20);
      }
    } else if (profile.projectId) {
        assignTesterToProject(`usr-${chatId}`, profile.projectId, 20);
    }
  }
  console.log('Backfill complete.');
} catch (e) {
  console.error('Error backfilling', e);
}
