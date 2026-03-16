import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';

const HomePage = () => <div><h1>Home</h1><p>Welcome to Bento Mobile!</p></div>;
const RecentsPage = () => <div><h1>Recents</h1><p>Your recently accessed items.</p></div>;
const LibraryPage = () => <div><h1>Library</h1><p>Browse your files.</p></div>;
const MediaPage = () => <div><h1>Media</h1><p>Your photos and videos.</p></div>;
const ProfilePage = () => <div><h1>Profile</h1><p>User settings and information.</p></div>;

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h2 className="app-title">Bento Mobile</h2>
        </header>

        <main className="app-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/recents" element={<RecentsPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* Fallback for unknown routes */}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>Home</NavLink>
          <NavLink to="/recents" className={({ isActive }) => isActive ? "active" : ""}>Recents</NavLink>
          <NavLink to="/library" className={({ isActive }) => isActive ? "active" : ""}>Library</NavLink>
          <NavLink to="/media" className={({ isActive }) => isActive ? "active" : ""}>Media</NavLink>
          <NavLink to="/profile" className={({ isActive }) => isActive ? "active" : ""}>Profile</NavLink>
        </nav>
      </div>
    </Router>
  );
}

export default App;
