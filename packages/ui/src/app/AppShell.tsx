import React, { useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";
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

const layoutStyles: {
  root: React.CSSProperties;
  sidebar: React.CSSProperties;
  main: React.CSSProperties;
  topbar: React.CSSProperties;
  topbarLeft: React.CSSProperties;
  content: React.CSSProperties;
  canvas: React.CSSProperties;
  inspector: React.CSSProperties;
  sectionTitle: React.CSSProperties;
  navList: React.CSSProperties;
  navLink: React.CSSProperties;
  navLinkActive: React.CSSProperties;
  actionRow: React.CSSProperties;
  actionButton: React.CSSProperties;
} = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "var(--nd-color-surface-secondary)",
    color: "var(--nd-color-text-primary)",
  },
  sidebar: {
    width: "var(--nd-sidebar-width)",
    padding: "var(--nd-space-5) var(--nd-space-4)",
    background: "var(--nd-color-surface-primary)",
    borderRight: "1px solid var(--nd-color-border-default)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--nd-space-4)",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    height: "var(--nd-topbar-height)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 var(--nd-space-6)",
    borderBottom: "1px solid var(--nd-color-border-default)",
    background: "var(--nd-color-surface-primary)",
    gap: "var(--nd-space-4)",
  },
  topbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "var(--nd-space-4)",
    flex: 1,
  },
  content: {
    flex: 1,
    display: "flex",
  },
  canvas: {
    flex: 1,
    background: "var(--nd-color-surface-primary)",
    borderRight: "1px solid var(--nd-color-border-default)",
  },
  inspector: {
    width: "var(--nd-inspector-width)",
    background: "var(--nd-color-surface-tertiary)",
  },
  sectionTitle: {
    fontSize: "var(--nd-font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--nd-color-text-secondary)",
  },
  navList: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--nd-space-2)",
  },
  navLink: {
    color: "var(--nd-color-text-primary)",
    textDecoration: "none",
    padding: "6px var(--nd-space-2)",
    borderRadius: "var(--nd-radius-lg)",
  },
  navLinkActive: {
    background: "color-mix(in srgb, var(--nd-color-accent-default) 10%, transparent)",
    color: "var(--nd-color-accent-default)",
  },
  actionRow: {
    display: "flex",
    gap: "var(--nd-space-2)",
  },
  actionButton: {
    borderRadius: "var(--nd-radius-lg)",
    border: "1px solid var(--nd-color-border-default)",
    background: "var(--nd-color-surface-primary)",
    padding: "6px 10px",
    fontSize: 13,
  },
};

export function AppShell() {
  const { triggerRefresh } = useFolderRefresh();
  const { enqueueFiles } = useUploadQueue();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const filesMatch = useMatch("/files/:nodeId");
  const rootMatch = useMatch("/files");
  const activeFolderId = filesMatch?.params.nodeId ?? (rootMatch ? ROOT_NODE_ID : null);
  const canCreateFolder = Boolean(activeFolderId);
  const { selectedNode } = useInspectorState();

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

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

  const handleCloseShare = () => {
    setIsShareOpen(false);
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

  return (
    <div className="app-shell">
      <div className="app-shell__main">
        <aside className="app-shell__sidebar">
          <FolderTree nodesApi={nodesApi} />
        </aside>
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <Breadcrumbs />
            <nav className="app-shell__topbar-tabs">
              {quickLinks.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }: { isActive: boolean }) =>
                    isActive
                      ? "app-shell__topbar-tab app-shell__topbar-tab--active"
                      : "app-shell__topbar-tab"
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="app-shell__topbar-right">
            <input
              aria-label={t("field.search")}
              placeholder={t("field.search")}
              className="app-shell__search"
            />
            <div className="app-shell__action-row">
              <button type="button" className="app-shell__action-button" onClick={handleOpenCreate} disabled={!canCreateFolder}>
                {t("action.newFolder")}
              </button>
              <button type="button" className="app-shell__action-button" onClick={handleTriggerUpload} disabled={!canCreateFolder}>
                {t("action.upload")}
              </button>
              <button type="button" className="app-shell__action-button" onClick={handleOpenShare} disabled={!selectedNode}>
                {t("action.share")}
              </button>
            </div>
            <NavLink
              to={adminSettingsLink.path}
              aria-label={t(adminSettingsLink.labelKey)}
              title={t(adminSettingsLink.labelKey)}
              className={({ isActive }: { isActive: boolean }) =>
                isActive ? "app-shell__icon-button app-shell__icon-button--active" : "app-shell__icon-button"
              }
            >
              ⚙️
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
        <ShareDialog open={isShareOpen} node={selectedNode} onClose={handleCloseShare} />
        <div className="app-shell__content">
          <main className="app-shell__canvas">
            <UploadQueuePanel />
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
