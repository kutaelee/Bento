import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (success) {
      navigate('/'); // Navigate to home or dashboard after login
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="container">
      <h2>Login to Bento Mobile</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="button">Login</button>
        <p style={{ textAlign: 'center', marginTop: '15px' }}>
          New user? <Link to="/setup">Set up your account</Link>
        </p>
        <p style={{ textAlign: 'center' }}>
          Received an invite? <Link to="/invite">Accept invite</Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
