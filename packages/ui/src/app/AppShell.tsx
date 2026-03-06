import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";
import { FolderTree } from "./FolderTree";
import { ROOT_NODE_ID } from "./nodes";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { UploadQueuePanel, useUploadQueue } from "./uploadQueue";
import { ApiError } from "../api/errors";
import { createNodesApi } from "../api/nodes";
import { InspectorPanel } from "./InspectorPanel";
import { useInspectorState } from "./inspectorState";
import { ShareDialog } from "./ShareDialog";
import { adminSettingsLink, quickLinks } from "../nav";
import { Button, Dialog, DetailInspector, TextField } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import "./AppShell.css";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerRefresh } = useFolderRefresh();
  const { enqueueFiles, items: uploadItems } = useUploadQueue();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const filesMatch = useMatch("/files/:nodeId");
  const rootMatch = useMatch("/files");
  const activeFolderId = filesMatch?.params.nodeId ?? (rootMatch ? ROOT_NODE_ID : null);
  const canCreateFolder = Boolean(activeFolderId);
  const { selectedNode } = useInspectorState();
  const [searchValue, setSearchValue] = useState("");

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchValue(params.get("q") ?? "");
  }, [location.search]);

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
    if (!nextQuery) {
      navigate("/search", { replace: false });
      return;
    }
    navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
  };

  const pendingUploads = uploadItems.filter((item) => item.status !== "COMPLETED").length;

  return (
    <div className="app-shell">
      <div className="app-shell__main">
        <aside className="app-shell__sidebar">
          <div className="app-shell__sidebar-header">
            <div className="app-shell__sidebar-brand">{t("app.brand")}</div>
            <div className="app-shell__sidebar-meta">{t("msg.shellSidebarBody")}</div>
          </div>
          <FolderTree nodesApi={nodesApi} />
        </aside>
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <NavLink to="/files" className="app-shell__brand" aria-label={t("nav.files")}>
              {t("app.brand")}
            </NavLink>
            <form className="app-shell__search-form" onSubmit={handleSearchSubmit}>
              <TextField
                aria-label={t("field.search")}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t("msg.searchPlaceholder")}
              />
            </form>
            <nav className="app-shell__topbar-tabs">
              {quickLinks.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }: { isActive: boolean }) =>
                    isActive ? "app-shell__topbar-tab app-shell__topbar-tab--active" : "app-shell__topbar-tab"
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="app-shell__topbar-right">
            <div className="app-shell__status-chip">
              <span>{t("action.upload")}</span>
              <strong>{pendingUploads}</strong>
            </div>
            <div className="app-shell__action-row">
              <Button variant="ghost" onClick={handleOpenCreate} disabled={!canCreateFolder}>{t("action.newFolder")}</Button>
              <Button variant="primary" onClick={handleTriggerUpload} disabled={!canCreateFolder}>{t("action.upload")}</Button>
              <Button variant="ghost" onClick={handleOpenShare} disabled={!selectedNode}>{t("action.share")}</Button>
            </div>
            <NavLink
              to={adminSettingsLink.path}
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
              label={t("field.name")}
              value={folderName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFolderName(event.target.value)}
              error={errorKey ? t(errorKey) : undefined}
              autoFocus
            />
          </form>
        </Dialog>
        <ShareDialog open={isShareOpen} node={selectedNode} onClose={() => setIsShareOpen(false)} />
        <div className="app-shell__content">
          <main className="app-shell__canvas">
            <UploadQueuePanel />
            <Breadcrumbs />
            <Outlet />
          </main>
          <DetailInspector className="app-shell__inspector">
            <InspectorPanel />
          </DetailInspector>
        </div>
      </div>
    </div>
  );
}
