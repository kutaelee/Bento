import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RecentsPage from '../pages/RecentsPage';
import FilesPage from '../pages/FilesPage';
import SearchPage from '../pages/SearchPage';
import MediaPage from '../pages/MediaPage';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recents" replace />} />
      <Route path="/recents" element={<RecentsPage />} />
      <Route path="/files" element={<FilesPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/media" element={<MediaPage />} />
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
};

export default AppRoutes;
