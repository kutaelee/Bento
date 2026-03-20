import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import SystemPage from './pages/SystemPage';
import HomePage from './pages/HomePage'; // A placeholder home page
import './App.css'; // For basic app layout and navigation styling

const App: React.FC = () => {
  const location = useLocation();

  return (
    <div className="app-container">
      <main className="app-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/system" element={<SystemPage />} />
          {/* Add more routes as needed */}
        </Routes>
      </main>
      <nav className="bottom-nav">
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          Home
        </Link>
        <Link to="/admin" className={`nav-item ${location.pathname === '/admin' ? 'active' : ''}`}>
          Admin
        </Link>
        <Link to="/system" className={`nav-item ${location.pathname === '/system' ? 'active' : ''}`}>
          System
        </Link>
      </nav>
    </div>
  );
};

export default App;
