import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

interface AppShellProps {
  children: ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ padding: '16px', backgroundColor: '#333', color: 'white', textAlign: 'center', fontSize: '1.2em' }}>
        <div style={{ fontWeight: 700 }}>Bento Mobile</div>
        {!isAuthenticated && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '10px', fontSize: '0.85rem' }}>
            <Link to="/login" style={{ color: '#fff', textDecoration: 'none' }}>Login</Link>
            <Link to="/setup" style={{ color: '#fff', textDecoration: 'none' }}>Setup</Link>
            <Link to="/invite/accept" style={{ color: '#fff', textDecoration: 'none' }}>Invite</Link>
          </div>
        )}
      </header>

      <main style={{ flexGrow: 1, padding: '16px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </main>

      {isAuthenticated && (
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '10px 0',
          backgroundColor: '#f8f8f8',
          borderTop: '1px solid #eee',
          boxShadow: '0 -2px 5px rgba(0,0,0,0.05)',
          position: 'sticky',
          bottom: 0,
          width: '100%'
        }}>
          <Link to="/" style={{ color: '#007bff', textDecoration: 'none', textAlign: 'center', padding: '5px' }}>Home</Link>
          <Link to="/recents" style={{ color: '#007bff', textDecoration: 'none', textAlign: 'center', padding: '5px' }}>Recents</Link>
          <Link to="/files" style={{ color: '#007bff', textDecoration: 'none', textAlign: 'center', padding: '5px' }}>Files</Link>
          <Link to="/profile" style={{ color: '#007bff', textDecoration: 'none', textAlign: 'center', padding: '5px' }}>Profile</Link>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '1em', padding: '5px' }}>Logout</button>
        </nav>
      )}
    </div>
  );
};

export default AppShell;
