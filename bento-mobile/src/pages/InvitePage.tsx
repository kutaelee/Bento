import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const InvitePage: React.FC = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await acceptInvite(token);
    if (success) {
      navigate('/'); // Navigate to home after accepting invite
    } else {
      setError('Invalid invitation token. Please check and try again.');
    }
  };

  return (
    <div className="container">
      <h2>Accept Bento Mobile Invitation</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="token">Invitation Token</label>
          <input
            type="text"
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            autoComplete="off"
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="button">Accept Invite</button>
        <p style={{ textAlign: 'center', marginTop: '15px' }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default InvitePage;
