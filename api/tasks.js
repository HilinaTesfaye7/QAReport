import { requireAuth, supabase } from './_utils/auth.js';
import { getMockTasks, getMockProjects } from './_utils/db.js';

async function tasksHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      let data = [];
      const { data: supabaseData, error } = await supabase.from('tasks').select('*');

      if (!error && supabaseData && supabaseData.length > 0) {
        data = supabaseData;
      } else {
        data = getMockTasks();
      }

      const projects = getMockProjects();
      const projectMap = {};
      projects.forEach(p => {
        projectMap[p.id] = p.qaLeadId || p.qa_lead_id;
      });

      // Apply RBAC
      if (req.user.role === 'QA Lead') {
        data = data.filter(t => projectMap[t.projectId || t.project_id] === req.user.id);
      } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
        data = data.filter(t => (t.assigneeId || t.assignee_id) === req.user.id);
      }
      // QA Director sees all

      res.setHeader('Content-Type', 'application/json');
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
            return res.status(403).json({ error: 'Forbidden: You cannot modify tasks for a project you do not own.' });
          }
        } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
          const members = project.member_ids || [];
          if (!members.includes(req.user.id)) {
            return res.status(403).json({ error: 'Forbidden: You are not assigned to this project.' });
          }
        }
      }

      const rows = list.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        project_id: t.projectId || t.project_id,
        module: t.module,
        assignee_id: t.assigneeId || t.assignee_id || req.user.id,
        priority: t.priority,
        estimated_effort_hours: t.estimatedEffortHours || t.estimated_effort_hours || 0,
        actual_effort_hours: t.actualEffortHours || t.actual_effort_hours,
        start_date: t.startDate || t.start_date,
        due_date: t.dueDate || t.due_date,
        completion_date: t.completionDate || t.completion_date,
        status: t.status,
        blocker_reason: t.blockerReason || t.blocker_reason,
        related_requirement: t.relatedRequirement || t.related_requirement,
        related_test_case_id: t.relatedTestCaseId || t.related_test_case_id,
        related_bug_id: t.relatedBugId || t.related_bug_id,
        notes: t.notes,
        created_at: t.createdAt || t.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('tasks').upsert(rows);
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

export default (req, res) => requireAuth(req, res, tasksHandler);
