import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Custom cookie parse
export function parse(str) {
  if (!str) return {};
  return str.split(';').reduce((res, c) => {
    const parts = c.trim().split('=');
    if (parts.length >= 2) {
      res[parts[0]] = parts.slice(1).join('=');
    }
    return res;
  }, {});
}

// Custom cookie serialize
export function serialize(name, val, options = {}) {
  let str = `${name}=${encodeURIComponent(val)}`;
  if (options.maxAge) str += `; Max-Age=${options.maxAge}`;
  if (options.path) str += `; Path=${options.path}`;
  if (options.httpOnly) str += `; HttpOnly`;
  if (options.secure) str += `; Secure`;
  if (options.sameSite) str += `; SameSite=${options.sameSite}`;
  return str;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-aegisqa-1234';

const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://drnlgmhkzbyrwatuuesh.supabase.co';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybmxnbWhremJ5cndhdHV1ZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTQxMDksImV4cCI6MjEwNDE3MDEwOX0.xieZP_ftgnk-V5YqotxCGzdZD6BxqnkvI1MfpLxj-Zw';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.must_change_password
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export async function requireAuth(req, res, handler) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  let token = cookies.auth_token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  // Determine user, user_id, role, etc.
  req.user = payload;
  
  // Enforce temporary password lockout on normal endpoints
  // Note: Only the change-password and logout endpoints should bypass this check
  const isAuthRoute = req.url?.includes('/api/auth/change-password') || req.url?.includes('/api/auth/logout') || req.url?.includes('/api/auth/me');
  if (payload.mustChangePassword && !isAuthRoute) {
    return res.status(403).json({ error: 'Forbidden: Must change password' });
  }

  return handler(req, res);
}
