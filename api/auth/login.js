import bcrypt from 'bcryptjs';
import { supabase, generateToken, serialize } from '../_utils/auth.js';
import { mockUsers } from '../_utils/mockUsers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .limit(1);

    if (error) {
      console.warn('Supabase DB error, falling back to mock users:', error);
      users = mockUsers.filter(u => u.username === username);
    }

    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login (ignore errors if using mock DB)
    const { error: updateError } = await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

    const token = generateToken(user);
    const cookie = serialize('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60,
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
      id: user.id,
      name: user.full_name,
      username: user.username,
      role: user.role,
      mustChangePassword: user.must_change_password
    });
  } catch (err) {
    console.error('Unhandled error in login:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
