/**
 * Login form component
 */

import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const result = await onLogin(username, password);
    if (!result.success) {
      setLoginError(result.message || 'Login failed');
    }
  };

  return (
    <div className="App">
      <div className="login-container">
        <div className="login-card">
          <h1>Matsu</h1>
          <p className="login-subtitle">Monitor your Distill data in real-time</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && <div className="login-error">{loginError}</div>}

            <button type="submit" className="login-btn">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
