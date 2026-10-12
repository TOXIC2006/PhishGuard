import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: (token: string) => void;
  apiUrl: string;
  onCancel?: () => void;
}

export default function LoginForm({ onLogin, apiUrl, onCancel }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        onLogin(data.access_token);
      } else {
        setError('Invalid admin credentials.');
      }
    } catch {
      setError('Cannot reach PhishGuard backend service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <img src="/logo.png" alt="PhishGuard Shield" className="brand-logo" style={{ width: 34, height: 34 }} />
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>PhishGuard Admin Portal</h2>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Security Operations &amp; Model Lab</div>
          </div>
        </div>

        <p>Authenticate with administrative credentials to access live scan telemetry and run custom model retraining jobs.</p>

        {error && (
          <div style={{ padding: '8px 12px', background: '#FDF1F2', border: '1px solid #F8B4B9', borderRadius: 6, color: 'var(--color-danger)', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Admin Email Address
          </label>
          <input
            className="input-field"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Password
          </label>
          <input
            className="input-field"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-lime"
              style={{ flex: 1, padding: 12 }}
            >
              {loading ? 'Authenticating…' : 'Sign In'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                style={{ padding: 12 }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
