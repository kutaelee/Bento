import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { InspectorProvider } from "./inspectorState";
import { FolderRefreshProvider } from "./folderRefresh";
import { UploadQueueProvider } from "./uploadQueue";
import { LoginPage } from "./LoginPage";
import { SetupPage } from "./SetupPage";
import { InviteAcceptPage } from "./InviteAcceptPage";
import { SimplePage } from "./SimplePage";
import { adminRoutes } from "./AdminRoutes";
import { FilesPage } from "./FilesPage";
import { SearchPage } from "./SearchPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/invite/accept" element={<InviteAcceptPage />} />
        <Route
          path="/"
          element={(
            <FolderRefreshProvider>
              <UploadQueueProvider>
                <InspectorProvider>
                  <AppShell />
                </InspectorProvider>
              </UploadQueueProvider>
            </FolderRefreshProvider>
          )}
        >
          <Route index element={<Navigate to="/files" replace />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="files/:nodeId" element={<FilesPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="recent" element={<FilesPage routeMode="recent" />} />
          <Route path="favorites" element={<FilesPage routeMode="favorites" />} />
          <Route path="shared" element={<FilesPage routeMode="shared" />} />
          <Route path="media" element={<FilesPage routeMode="media" />} />
          <Route path="trash" element={<FilesPage routeMode="trash" />} />
          {adminRoutes}
        </Route>
        <Route path="*" element={<SimplePage titleKey="err.notFound" />} />
      </Routes>
    </BrowserRouter>
  );
}
