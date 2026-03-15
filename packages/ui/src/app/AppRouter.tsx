import React from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
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
import { MediaPage } from "./MediaPage";
import { SearchPage } from "./SearchPage";
import { getAccessToken } from "./authTokens";
import { getAppBasePath } from "./basePath";
import { isVisualFixtureEnabled } from "./visualFixtures";

function RequireAuth() {
  const location = useLocation();
  const token = getAccessToken();

  if (!token && !isVisualFixtureEnabled()) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}

export function AppRouter() {
  const basename = getAppBasePath() || undefined;
  const future = {
    v7_relativeSplatPath: true,
    v7_startTransition: true,
  } as const;

  return (
    <BrowserRouter basename={basename} future={future}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/invite/accept" element={<InviteAcceptPage />} />
        <Route element={<RequireAuth />}>
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
            <Route path="media" element={<MediaPage />} />
            <Route path="media/:nodeId" element={<MediaPage />} />
            <Route path="trash" element={<FilesPage routeMode="trash" />} />
          </Route>
          {adminRoutes}
        </Route>
        <Route path="*" element={<SimplePage titleKey="err.notFound" />} />
      </Routes>
    </BrowserRouter>
  );
}
