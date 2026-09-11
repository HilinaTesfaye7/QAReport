import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { Shield, Eye, EyeOff, KeyRound } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await AuthService.login(username, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('Please enter your username first.');
      return;
    }
    // Simulate secure forgot password without leaking info
    setForgotMsg('If the account exists, password reset instructions have been sent.');
    setTimeout(() => {
      setIsForgotMode(false);
      setForgotMsg(null);
    }, 4000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '40px', background: 'var(--bg-panel)', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Shield size={24} />
          </div>
        </div>
        
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0' }}>
          {isForgotMode ? 'Forgot Password' : 'Welcome Back'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 32px 0' }}>
          {isForgotMode ? 'Enter your username to reset' : 'AegisQA Management Portal'}
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '24px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {forgotMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '24px', textAlign: 'center' }}>
            {forgotMsg}
          </div>
        )}

        <form onSubmit={isForgotMode ? handleForgot : handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)',
                fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s'
              }}
              placeholder="e.g. sarah.qa"
            />
          </div>

          {!isForgotMode && (
            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 16px', paddingRight: '48px', background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)',
                    fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s'
                  }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {isForgotMode ? <KeyRound size={18} /> : null}
            {isLoading ? 'Authenticating...' : isForgotMode ? 'Send Reset Instructions' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => { setIsForgotMode(!isForgotMode); setError(null); }}
            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}
          >
            {isForgotMode ? 'Back to Login' : 'Forgot Password?'}
          </button>
        </div>
      </div>
    </div>
  );
};
