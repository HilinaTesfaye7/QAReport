import { requireAuth, supabase } from './_utils/auth.js';
import { getMockBlockers, getMockProjects } from './_utils/db.js';

async function blockersHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      let data = [];
      const { data: supabaseData, error } = await supabase.from('blockers').select('*');

      if (!error && supabaseData && supabaseData.length > 0) {
        data = supabaseData;
      } else {
        data = getMockBlockers();
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
            return res.status(403).json({ error: 'Forbidden: You cannot modify blockers for a project you do not own.' });
          }
        } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
          const members = project.member_ids || [];
          if (!members.includes(req.user.id)) {
            return res.status(403).json({ error: 'Forbidden: You are not assigned to this project.' });
          }
          // Force reported_by to be the tester
          item.memberId = req.user.id;
          item.member_id = req.user.id;
        }
      }

      const rows = list.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        project_id: b.projectId || b.project_id,
        project_name: b.projectName || b.project_name || '',
        severity: b.severity,
        status: b.status,
        reported_by: b.reportedBy || b.reported_by || 'QA Engineer',
        member_id: b.memberId || b.member_id || req.user.id,
        created_at: b.createdAt || b.created_at || new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('blockers').upsert(rows);
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

export default (req, res) => requireAuth(req, res, blockersHandler);
