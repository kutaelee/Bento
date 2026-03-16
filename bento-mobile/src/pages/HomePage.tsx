import React from 'react';
import { useAuth } from '../AuthContext';

const HomePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="container" style={{textAlign: 'center'}}>
      <h2>Welcome, {user?.name || 'Guest'}!</h2>
      <p>This is your Bento Mobile home screen.</p>
      <p>Use the navigation below to explore your files, recents, and profile.</p>
    </div>
  );
};

export default HomePage;
