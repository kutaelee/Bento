import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";
import { ROOT_NODE_ID } from "./nodes";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { UploadQueuePanel, useUploadQueue } from "./uploadQueue";
import { ApiError } from "../api/errors";
import { createAuthApi } from "../api/auth";
import { createNodesApi } from "../api/nodes";
import { InspectorPanel } from "./InspectorPanel";
import { useInspectorState } from "./inspectorState";
import { ShareDialog } from "./ShareDialog";
import { adminSettingsLink, quickLinks } from "../nav";
import { Button, Dialog, DetailInspector, TextField } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { clearAuthTokens } from "./authTokens";
import { getVisualFixtureSearch } from "./visualFixtures";
import "./AppShell.css";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerRefresh } = useFolderRefresh();
  const { enqueueFiles, items: uploadItems } = useUploadQueue();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const filesMatch = useMatch("/files/:nodeId");
  const filesRootMatch = useMatch("/files");
  const mediaMatch = useMatch("/media/:nodeId");
  const mediaRootMatch = useMatch("/media");
  const activeFolderId =
    filesMatch?.params.nodeId ??
    mediaMatch?.params.nodeId ??
    (filesRootMatch || mediaRootMatch ? ROOT_NODE_ID : null);
  const canCreateFolder = Boolean(activeFolderId);
  const { selectedNode } = useInspectorState();
  const showInspector = Boolean(selectedNode);
  const [searchValue, setSearchValue] = useState("");
  const preservedSearch = useMemo(() => getVisualFixtureSearch(location.search), [location.search]);

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);
  const authApi = useMemo(() => createAuthApi(apiClient), [apiClient]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchValue(params.get("q") ?? "");
  }, [location.search]);

  useEffect(() => {
    const handleCreateFolder = () => {
      if (!activeFolderId) return;
      setIsCreateOpen(true);
      setFolderName("");
      setErrorKey(null);
    };
    const handleUploadFiles = () => {
      if (!activeFolderId) return;
      uploadInputRef.current?.click();
    };
    const handleShareSelected = () => {
      if (!selectedNode) return;
      setIsShareOpen(true);
    };

    window.addEventListener("bento:create-folder", handleCreateFolder as EventListener);
    window.addEventListener("bento:upload-files", handleUploadFiles as EventListener);
    window.addEventListener("bento:share-selected", handleShareSelected as EventListener);
    return () => {
      window.removeEventListener("bento:create-folder", handleCreateFolder as EventListener);
      window.removeEventListener("bento:upload-files", handleUploadFiles as EventListener);
      window.removeEventListener("bento:share-selected", handleShareSelected as EventListener);
    };
  }, [activeFolderId, selectedNode]);

  const handleOpenCreate = () => {
    if (!activeFolderId) return;
    setIsCreateOpen(true);
    setFolderName("");
    setErrorKey(null);
  };

  const handleCloseCreate = () => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setErrorKey(null);
  };

  const handleOpenShare = () => {
    if (!selectedNode) return;
    setIsShareOpen(true);
  };

  const handleTriggerUpload = () => {
    if (!activeFolderId) return;
    uploadInputRef.current?.click();
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local tokens even if the current session is already invalid.
    } finally {
      clearAuthTokens();
      navigate("/login", { replace: true });
    }
  };

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFolderId) return;
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    enqueueFiles(files, activeFolderId);
    event.target.value = "";
  };

  const handleSubmitCreate = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!activeFolderId) return;
    const trimmed = folderName.trim();
    if (!trimmed) {
      setErrorKey("err.validation");
      return;
    }
    setIsSubmitting(true);
    setErrorKey(null);
    try {
      await nodesApi.createFolder({ parentId: activeFolderId, name: trimmed });
      setIsCreateOpen(false);
      setFolderName("");
      triggerRefresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextQuery = searchValue.trim();
    const params = new URLSearchParams(preservedSearch);
    if (!nextQuery) {
      navigate({ pathname: "/search", search: params.toString() ? `?${params.toString()}` : "" }, { replace: false });
      return;
    }
    params.set("q", nextQuery);
    navigate({ pathname: "/search", search: `?${params.toString()}` });
  };

  const pendingUploads = uploadItems.filter((item) => item.status !== "COMPLETED").length;
  const activeQuickLink = quickLinks.find((item) => location.pathname.startsWith(item.path)) ?? quickLinks[0];

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <div className="app-shell__topbar-left">
          <NavLink to={{ pathname: "/files", search: preservedSearch }} className="app-shell__brand-lockup" aria-label={t("nav.files")}>
            <div className="app-shell__brand-mark">BN</div>
            <div className="app-shell__brand-copy">
              <span className="app-shell__eyebrow">{t("app.brand")}</span>
              <strong>{t(activeQuickLink.labelKey)}</strong>
            </div>
          </NavLink>
          <form className="app-shell__search-form" onSubmit={handleSearchSubmit}>
            <TextField
              id="app-shell-search"
              name="search"
              aria-label={t("field.search")}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t("msg.searchPlaceholder")}
            />
          </form>
        </div>
        <div className="app-shell__topbar-right">
          <nav className="app-shell__topbar-tabs no-scrollbar">
            {quickLinks.map((item) => (
              <NavLink
                key={item.id}
                to={{ pathname: item.path, search: preservedSearch }}
                className={({ isActive }: { isActive: boolean }) =>
                  isActive ? "app-shell__topbar-tab app-shell__topbar-tab--active" : "app-shell__topbar-tab"
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="app-shell__status-chip">
            <span>{t("msg.filesSummaryUploads")}</span>
            <strong>{pendingUploads}</strong>
          </div>
          <div className="app-shell__action-row">
            <Button variant="ghost" onClick={handleOpenCreate} disabled={!canCreateFolder}>{t("action.newFolder")}</Button>
            <Button variant="primary" onClick={handleTriggerUpload} disabled={!canCreateFolder}>{t("action.upload")}</Button>
            <Button variant="ghost" onClick={handleOpenShare} disabled={!selectedNode}>{t("action.share")}</Button>
            <Button variant="secondary" onClick={() => void handleLogout()}>{t("action.signOut")}</Button>
          </div>
          <NavLink
            to={{ pathname: adminSettingsLink.path, search: preservedSearch }}
            aria-label={t(adminSettingsLink.labelKey)}
            title={t(adminSettingsLink.labelKey)}
            className={({ isActive }: { isActive: boolean }) =>
              isActive ? "app-shell__icon-button app-shell__icon-button--active" : "app-shell__icon-button"
            }
          >
            {t("nav.settings")}
          </NavLink>
        </div>
        <input ref={uploadInputRef} type="file" multiple className="app-shell__hidden-input" onChange={handleUploadChange} />
      </header>

      <div className="app-shell__body">
        <Dialog
          open={isCreateOpen}
          title={t("action.newFolder")}
          onClose={handleCloseCreate}
          closeLabel={t("action.close")}
          footer={
            <div className="nd-dialog__actions">
              <Button variant="ghost" onClick={handleCloseCreate} disabled={isSubmitting}>{t("action.cancel")}</Button>
              <Button type="submit" form="create-folder-form" loading={isSubmitting} disabled={!folderName.trim()}>{t("action.newFolder")}</Button>
            </div>
          }
        >
          <form id="create-folder-form" onSubmit={handleSubmitCreate}>
            <TextField
              id="create-folder-name"
              name="folderName"
              label={t("field.name")}
              value={folderName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFolderName(event.target.value)}
              error={errorKey ? t(errorKey) : undefined}
              autoFocus
            />
          </form>
        </Dialog>
        <ShareDialog open={isShareOpen} node={selectedNode} onClose={() => setIsShareOpen(false)} />
        <div className={showInspector ? "app-shell__content app-shell__content--with-inspector" : "app-shell__content"}>
          <main className="app-shell__canvas">
            <div className="app-shell__canvas-header">
              <div className="app-shell__breadcrumbs">
                <Breadcrumbs />
              </div>
              <div className="app-shell__canvas-actions">
                <Button variant="ghost" onClick={handleTriggerUpload} disabled={!canCreateFolder}>{t("action.upload")}</Button>
                <Button variant="ghost" onClick={handleOpenShare} disabled={!selectedNode}>{t("action.share")}</Button>
              </div>
            </div>
            <div className="app-shell__queue">
              <UploadQueuePanel />
            </div>
            <Outlet />
          </main>
          {showInspector ? (
            <DetailInspector className="app-shell__inspector">
              <InspectorPanel />
            </DetailInspector>
          ) : null}
        </div>
      </div>
    </div>
  );
}
