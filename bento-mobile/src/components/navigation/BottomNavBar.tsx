import React from 'react';
import { NavLink } from 'react-router-dom';
import './BottomNavBar.css';

const BottomNavBar: React.FC = () => {
  return (
    <nav className="bottom-nav-bar">
      <NavLink to="/recents" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="icon">🏠</span>
        <span className="text">Recents</span>
      </NavLink>
      <NavLink to="/files" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="icon">📁</span>
        <span className="text">Files</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="icon">🔍</span>
        <span className="text">Search</span>
      </NavLink>
      <NavLink to="/media" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="icon">🖼️</span>
        <span className="text">Media</span>
      </NavLink>
    </nav>
  );
};

export default BottomNavBar;
