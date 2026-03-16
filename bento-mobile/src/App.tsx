import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AppShell from './layouts/AppShell';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import InvitePage from './pages/InvitePage';
import HomePage from './pages/HomePage';

// Placeholder pages for authenticated routes
const RecentsPage = () => <div className="container"><h3>Recents</h3><p>Your recent files will appear here.</p></div>;
const FilesPage = () => <div className="container"><h3>Files</h3><p>Your files will be listed here.</p></div>;
const ProfilePage = () => <div className="container"><h3>Profile</h3><p>Manage your profile settings.</p></div>;

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <AppShell>
        <Routes>
          {/* Public routes for authentication and onboarding */}
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/setup" element={isAuthenticated ? <Navigate to="/" replace /> : <SetupPage />} />
          <Route path="/invite" element={isAuthenticated ? <Navigate to="/" replace /> : <InvitePage />} />

          {/* Protected routes that require authentication */}
          {isAuthenticated ? (
            <>
              <Route path="/" element={<HomePage />} />
              <Route path="/recents" element={<RecentsPage />} />
              <Route path="/files" element={<FilesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              {/* Redirect any unmatched path to home if authenticated */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            // Redirect unauthenticated users to login, except for setup/invite
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </AppShell>
    </Router>
  );
};

export default App;
