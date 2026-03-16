import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const SetupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { setupUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await setupUser(name);
    if (success) {
      navigate('/'); // Navigate to home after setup
    } else {
      setError('Failed to set up account. Please try again.');
    }
  };

  return (
    <div className="container">
      <h2>Set up your Bento Mobile account</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="name">Your Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="button">Complete Setup</button>
        <p style={{ textAlign: 'center', marginTop: '15px' }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default SetupPage;
