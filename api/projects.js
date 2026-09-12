import { createClient } from '@supabase/supabase-js';
import { requireAuth, supabase } from './_utils/auth.js';

import { getMockProjects } from './_utils/db.js';

// Vercel Serverless Function: /api/projects
async function projectsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      let data = [];
      
      const { data: supabaseData, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && supabaseData && supabaseData.length > 0) {
        data = supabaseData;
      } else {
        // Fallback to mock data
        data = getMockProjects();
        
        // Map mock data to supabase format for consistent filtering
        data = data.map(p => ({
          ...p,
          qa_lead_id: p.qaLeadId,
          member_ids: p.memberIds
        }));
      }

      // Apply strict backend RBAC
      if (req.user.role === 'QA Lead') {
        data = data.filter(p => p.qa_lead_id === req.user.id);
      } else if (req.user.role === 'QA Tester' || req.user.role === 'Automation QA Engineer') {
        data = data.filter(p => p.member_ids && p.member_ids.includes(req.user.id));
      }
      // QA Director sees all, no filter applied

      const formatted = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        status: p.status,
        startDate: p.start_date || p.startDate || '',
        targetReleaseDate: p.target_release_date || p.targetReleaseDate || '',
        projectOwner: p.project_owner || p.projectOwner || '',
        qaLeadId: p.qa_lead_id || p.qaLeadId || 'usr-sarah',
        memberIds: Array.isArray(p.member_ids) ? p.member_ids : (p.memberIds || []),
        resources: p.resources || {},
        qaProgress: Number(p.qa_progress || p.qaProgress || 0),
        regressionProgress: Number(p.regression_progress || p.regressionProgress || 0),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(formatted);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    if (req.user.role !== 'QA Director' && req.user.role !== 'QA Lead') {
      return res.status(403).json({ error: 'Only QA Director or QA Lead can modify projects' });
    }
    
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const list = Array.isArray(body) ? body : [body];

      const rows = list.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        status: p.status || 'Testing',
        start_date: p.startDate || p.start_date,
        target_release_date: p.targetReleaseDate || p.target_release_date,
        project_owner: p.projectOwner || p.project_owner,
        qa_lead_id: p.qaLeadId || p.qa_lead_id || 'usr-sarah',
        member_ids: p.memberIds || p.member_ids || [],
        resources: p.resources || {},
        qa_progress: p.qaProgress ?? p.qa_progress ?? 0,
        regression_progress: p.regressionProgress ?? p.regression_progress ?? 0,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('projects').upsert(rows);
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

export default (req, res) => requireAuth(req, res, projectsHandler);

