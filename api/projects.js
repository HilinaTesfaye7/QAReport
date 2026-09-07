import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function: /api/projects
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://drnlgmhkzbyrwatuuesh.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw';

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const formatted = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        status: p.status,
        startDate: p.start_date || '',
        targetReleaseDate: p.target_release_date || '',
        projectOwner: p.project_owner || '',
        qaLeadId: p.qa_lead_id || 'usr-sarah',
        memberIds: Array.isArray(p.member_ids) ? p.member_ids : [],
        resources: p.resources || {},
        qaProgress: Number(p.qa_progress || 0),
        regressionProgress: Number(p.regression_progress || 0),
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
