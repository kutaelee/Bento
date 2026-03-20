// bento-mobile/src/components/MobileNavBar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';

const MobileNavBar: React.FC = () => {
  const linkStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
    padding: '12px 0',
    textDecoration: 'none',
    color: '#666',
    fontSize: '0.9em',
    fontWeight: 'bold',
  };

  const activeLinkStyle: React.CSSProperties = {
    color: '#007bff',
    borderTop: '2px solid #007bff',
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-around',
        borderTop: '1px solid #eee',
        zIndex: 1000,
      }}
    >
      <NavLink
        to="/files"
        style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}
      >
        Files
      </NavLink>
      <NavLink
        to="/recent"
        style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}
      >
        Recent
      </NavLink>
      <NavLink
        to="/favorites"
        style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}
      >
        Favorites
      </NavLink>
      <NavLink
        to="/trash"
        style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}
      >
        Trash
      </NavLink>
    </nav>
  );
};

export default MobileNavBar;
