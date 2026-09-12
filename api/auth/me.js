import { requireAuth, supabase } from '../_utils/auth.js';
import { mockUsers } from '../_utils/mockUsers.js';

async function meHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, username, role, is_active, must_change_password, last_login_at')
      .eq('id', req.user.id)
      .limit(1);

    if (error || !users || users.length === 0) {
      // Fallback to mock DB
      users = mockUsers.filter(u => u.id === req.user.id);
      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const user = users[0];
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    return res.status(200).json({
      id: user.id,
      name: user.full_name,
      username: user.username,
      role: user.role,
      mustChangePassword: user.must_change_password,
      lastLoginAt: user.last_login_at
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default (req, res) => requireAuth(req, res, meHandler);
