import crypto from 'crypto';
import { supabase } from '../_utils/auth.js';
import { getMockUsers } from '../_utils/db.js';

// In-memory token store for mock environment (would be in DB for production)
// Structure: { [username]: { tokenHash, expiresAt } }
export const resetTokens = {};

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
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    let userFound = null;

    // Try Supabase first
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .limit(1);

    if (users && users.length > 0) {
      userFound = users[0];
    } else {
      // Fallback to mock users
      const mockUsers = getMockUsers();
      const mockUser = mockUsers.find(u => u.username === username);
      if (mockUser) {
        userFound = mockUser;
      }
    }

    if (userFound) {
      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Store token hash with 30-minute expiration
      resetTokens[userFound.username] = {
        tokenHash,
        expiresAt: Date.now() + 30 * 60 * 1000 // 30 mins
      };

      // In a real application, send the plain `resetToken` via email here
      // For testing, we log it to stdout
      console.log(`[SECURE MOCK EMAIL] Password reset token for ${userFound.username}: ${resetToken}`);
    }

    // Always return generic response to prevent username enumeration
    return res.status(200).json({ 
      success: true, 
      message: 'If the account exists, password reset instructions have been sent.' 
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(200).json({ 
      success: true, 
      message: 'If the account exists, password reset instructions have been sent.' 
    });
  }
}

