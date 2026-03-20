import React from 'react';
import { NavLink } from 'react-router-dom';

const BottomNavBar: React.FC = () => {
  const baseLinkStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
    padding: '8px 0',
    fontSize: '12px',
    color: '#4B5563', // gray-600
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const activeLinkStyle: React.CSSProperties = {
    ...baseLinkStyle,
    color: '#2563EB', // blue-600
    fontWeight: '600',
    borderTop: '2px solid #2563EB', // blue-600
    paddingTop: '6px', // Adjust for border
  };

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderTop: '1px solid #E5E7EB', // gray-200
      boxShadow: '0 -1px 3px rgba(0,0,0,0.1), 0 -1px 2px rgba(0,0,0,0.06)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: '56px', // h-14
      zIndex: 10,
    }}>
      <NavLink
        to="/files"
        style={({ isActive }) => (isActive ? activeLinkStyle : baseLinkStyle)}
      >
        <span>📁</span> Files
      </NavLink>
      <NavLink
        to="/recent"
        style={({ isActive }) => (isActive ? activeLinkStyle : baseLinkStyle)}
      >
        <span>🕒</span> Recent
      </NavLink>
      <NavLink
        to="/favorites"
        style={({ isActive }) => (isActive ? activeLinkStyle : baseLinkStyle)}
      >
        <span>⭐</span> Favs
      </NavLink>
      <NavLink
        to="/trash"
        style={({ isActive }) => (isActive ? activeLinkStyle : baseLinkStyle)}
      >
        <span>🗑️</span> Trash
      </NavLink>
    </nav>
  );
};

export default BottomNavBar;
