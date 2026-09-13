import { requireAuth, supabase } from './_utils/auth.js';
import { getMockProjects } from './_utils/db.js';

// Minimal mock for daily reports if needed
const INITIAL_DAILY_REPORTS = [];

async function dailyReportsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      let data = [];
      const { data: supabaseData, error } = await supabase.from('daily_reports').select('*');

      if (!error && supabaseData && supabaseData.length > 0) {
        data = supabaseData;
      } else {
        data = INITIAL_DAILY_REPORTS;
      }

      const projects = getMockProjects();
      const projectMap = {};
      projects.forEach(p => { projectMap[p.id] = p.qaLeadId || p.qa_lead_id; });

      if (req.user.role === 'QA Lead') {
        data = data.filter(t => projectMap[t.projectId || t.project_id] === req.user.id);
      } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
        data = data.filter(t => (t.memberId || t.member_id) === req.user.id);
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const list = Array.isArray(body) ? body : [body];

      // Enforce strict project ownership
      const { data: projectsData, error: projError } = await supabase.from('projects').select('id, qa_lead_id, member_ids');
      if (projError) {
        return res.status(500).json({ error: 'Failed to validate project ownership.' });
      }

      for (const item of list) {
        const projectId = item.projectId || item.project_id;
        const project = projectsData.find(p => p.id === projectId);
        
        if (!project) {
          return res.status(404).json({ error: `Project not found: ${projectId}` });
        }

        if (req.user.role === 'QA Lead') {
          if (project.qa_lead_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden: You cannot modify daily reports for a project you do not own.' });
          }
        } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
          const members = project.member_ids || [];
          if (!members.includes(req.user.id)) {
            return res.status(403).json({ error: 'Forbidden: You are not assigned to this project.' });
          }
          // Force member_id to be the tester
          item.memberId = req.user.id;
          item.member_id = req.user.id;
        }
      }

      const rows = list.map((r) => ({
        id: r.id,
        date: r.date,
        chat_id: r.chatId || r.chat_id || null,
        member_id: r.memberId || r.member_id || req.user.id,
        member_name: r.memberName || r.member_name || req.user.full_name || 'QA Member',
        role: r.role || 'tester',
        project_id: r.projectId || r.project_id,
        project_name: r.projectName || r.project_name || '',
        yesterday_completed: r.yesterdayCompleted || r.yesterday_completed,
        today_working_on: r.todayWorkingOn || r.today_working_on,
        blockers: r.blockers,
        is_blocked: r.isBlocked ?? r.is_blocked ?? false,
        expected_completion: r.expectedCompletion || r.expected_completion,
        notes: r.notes,
        submitted_at: r.submittedAt || r.submitted_at || new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('daily_reports').upsert(rows);
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, count: rows.length });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default (req, res) => requireAuth(req, res, dailyReportsHandler);
