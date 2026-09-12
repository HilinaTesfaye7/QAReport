import { requireAuth, supabase } from './_utils/auth.js';
import { getMockBugs, getMockProjects } from './_utils/db.js';

async function bugsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      let data = [];
      const { data: supabaseData, error } = await supabase.from('bugs').select('*');

      if (!error && supabaseData && supabaseData.length > 0) {
        data = supabaseData;
      } else {
        data = getMockBugs();
      }

      const projects = getMockProjects();
      const projectMap = {};
      projects.forEach(p => { projectMap[p.id] = p.qaLeadId || p.qa_lead_id; });

      if (req.user.role === 'QA Lead') {
        data = data.filter(t => projectMap[t.projectId || t.project_id] === req.user.id);
      } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
        data = data.filter(t => (t.assigneeId || t.assignee_id) === req.user.id || (t.reporterId || t.reporter_id) === req.user.id);
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default (req, res) => requireAuth(req, res, bugsHandler);
