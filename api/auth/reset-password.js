import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from '../utils/auth.js';
import { resetTokens } from './forgot-password.js';
import { mockUsers } from '../utils/mockUsers.js';

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
    const { username, token, newPassword } = req.body;
    
    if (!username || !token || !newPassword) {
      return res.status(400).json({ error: 'Username, token, and new password are required' });
    }

    if (newPassword.length < 8 || 
        !/[A-Z]/.test(newPassword) || 
        !/[a-z]/.test(newPassword) || 
        !/[0-9]/.test(newPassword) || 
        !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements' });
    }

    const record = resetTokens[username];
    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    if (Date.now() > record.expiresAt) {
      delete resetTokens[username];
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== record.tokenHash) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Try Supabase update
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        must_change_password: false,
        password_changed_at: new Date().toISOString()
      })
      .eq('username', username);

    // Fallback/sync to mock users
    const mockUser = mockUsers.find(u => u.username === username);
    if (mockUser) {
      mockUser.password_hash = newPasswordHash;
      mockUser.must_change_password = false;
      mockUser.password_changed_at = new Date().toISOString();
    }

    // Invalidate token
    delete resetTokens[username];

    return res.status(200).json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
