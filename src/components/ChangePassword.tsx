import React, { useState } from 'react';
import { ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { AuthService } from '../services/authService';

interface ChangePasswordProps {
  user: User;
  onPasswordChanged: () => void;
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({ user, onPasswordChanged }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    await AuthService.logout();
    window.location.reload();
  };

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password must contain at least one special character.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match.');
      }

      const validationError = validatePassword(newPassword);
      if (validationError) {
        throw new Error(validationError);
      }

      await AuthService.changePassword(currentPassword, newPassword);
      onPasswordChanged();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '40px', background: 'var(--bg-panel)', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <ShieldAlert size={24} />
          </div>
        </div>
        
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0' }}>
          Change Your Password
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 32px 0' }}>
          For security, you must change your temporary password before continuing to the Dashboard.
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '24px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Current Password */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 16px', paddingRight: '48px', background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)',
                  fontSize: '0.95rem', outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 16px', paddingRight: '48px', background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)',
                  fontSize: '0.95rem', outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)',
                fontSize: '0.95rem', outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem',
              fontWeight: 600, cursor: (isLoading || !currentPassword || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !currentPassword || !newPassword || !confirmPassword) ? 0.7 : 1, transition: 'all 0.2s',
              marginBottom: '16px'
            }}
          >
            {isLoading ? 'Updating...' : 'Change Password & Login'}
          </button>
          
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: '100%', padding: '14px', background: 'transparent',
              color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Switch Account / Logout
          </button>
        </form>
      </div>
    </div>
  );
};
