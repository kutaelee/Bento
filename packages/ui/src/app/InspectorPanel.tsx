import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, TextField } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import type { NodeItem } from "../api/nodes";
import { createNodesApi } from "../api/nodes";
import { createMePreferencesApi } from "../api/mePreferences";
import { createVolumesApi } from "../api/volumes";
import { ApiError } from "../api/errors";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { downloadBlob, formatDate } from "./format";
import { useFolderRefresh } from "./folderRefresh";
import { useInspectorState } from "./inspectorState";
import { useNodeFavorites } from "./useNodeFavorites";
import { buildDisplayPath, formatOwnerLabel, type UserIdentity } from "./nodePresentation";
import "./InspectorPanel.css";

const formatSize = (size?: number) => {
  if (size === undefined || size === null) return "-";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const InspectorDetails = ({ node, ownerValue, pathValue }: { node: NodeItem; ownerValue: string; pathValue: string }) => {
  const rows: Array<{ label: string; value: string }> = [
    { label: t("field.name"), value: node.name },
    { label: t("field.modifiedAt"), value: formatDate(node.updated_at) },
    { label: t("field.size"), value: formatSize(node.size_bytes) },
    { label: t("field.owner"), value: ownerValue },
    { label: t("field.path"), value: pathValue },
  ];

  return (
    <div className="inspector-panel__list">
      {rows.map((row) => (
        <div key={row.label} className="inspector-panel__row">
          <span className="inspector-panel__label">{row.label}</span>
          <span className="inspector-panel__value">{row.value}</span>
        </div>
      ))}
    </div>
  );
};

export function InspectorPanel() {
  const { selectedNode, setSelectedNode } = useInspectorState();
  const { triggerRefresh } = useFolderRefresh();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useNodeFavorites();

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);
  const meApi = useMemo(() => createMePreferencesApi(apiClient), [apiClient]);
  const volumesApi = useMemo(() => createVolumesApi(apiClient), [apiClient]);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveParentId, setMoveParentId] = useState("");
  const [moveErrorKey, setMoveErrorKey] = useState<I18nKey | null>(null);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [copyParentId, setCopyParentId] = useState("");
  const [copyErrorKey, setCopyErrorKey] = useState<I18nKey | null>(null);
  const [copyNoticeKey, setCopyNoticeKey] = useState<I18nKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionNoticeKey, setActionNoticeKey] = useState<I18nKey | null>(null);
  const [currentUser, setCurrentUser] = useState<UserIdentity | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string>("-");

  useEffect(() => {
    setIsRenameOpen(false);
    setRenameValue(selectedNode?.name ?? "");
    setErrorKey(null);
    setIsMoveOpen(false);
    setMoveParentId(selectedNode?.parent_id ?? "");
    setMoveErrorKey(null);
    setIsCopyOpen(false);
    setCopyParentId(selectedNode?.parent_id ?? "");
    setCopyErrorKey(null);
    setCopyNoticeKey(null);
    setIsSubmitting(false);
    setActionNoticeKey(null);
  }, [selectedNode?.id]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const me = await meApi.getPreferences();
        if (!active) return;
        setCurrentUser({
          id: String(me.id),
          username: me.username,
          display_name: me.display_name,
        });
      } catch {
        if (!active) return;
        setCurrentUser(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [meApi]);

  useEffect(() => {
    let active = true;

    if (!selectedNode) {
      setResolvedPath("-");
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const [breadcrumbResponse, volumesResponse] = await Promise.all([
          nodesApi.getBreadcrumb(selectedNode.id),
          volumesApi.listVolumes(),
        ]);
        if (!active) return;
        const activeVolume = volumesResponse.items.find((item) => item.is_active);
        setResolvedPath(buildDisplayPath(activeVolume?.base_path ?? "/", breadcrumbResponse.items ?? []));
      } catch {
        if (!active) return;
        setResolvedPath(selectedNode.path);
      }
    })();

    return () => {
      active = false;
    };
  }, [nodesApi, selectedNode, volumesApi]);

  const handleOpenSelected = () => {
    if (!selectedNode) return;
    if (selectedNode.type === "FOLDER") {
      navigate(`/files/${selectedNode.id}`);
      return;
    }
    void handleDownloadSelected();
  };

  const handleDownloadSelected = async () => {
    if (!selectedNode || selectedNode.type === "FOLDER") return;
    setActionNoticeKey(null);
    try {
      const blob = await nodesApi.downloadNode({ nodeId: selectedNode.id });
      await downloadBlob(blob, selectedNode.name);
    } catch (error) {
      if (error instanceof ApiError) {
        setActionNoticeKey(error.key);
      } else {
        setActionNoticeKey("err.network");
      }
    }
  };

  const handleShareSelected = () => {
    if (!selectedNode) return;
    window.dispatchEvent(new CustomEvent("bento:share-selected"));
  };

  const handleToggleFavorite = () => {
    if (!selectedNode) return;
    toggleFavorite(selectedNode);
    setActionNoticeKey(isFavorite(selectedNode.id) ? "msg.favoriteRemoved" : "msg.favoriteAdded");
  };

  const handleOpenRename = () => {
    if (!selectedNode) return;
    setIsMoveOpen(false);
    setMoveErrorKey(null);
    setIsCopyOpen(false);
    setCopyErrorKey(null);
    setRenameValue(selectedNode.name);
    setErrorKey(null);
    setIsRenameOpen(true);
  };

  const handleCloseRename = () => {
    if (isSubmitting) return;
    setIsRenameOpen(false);
    setErrorKey(null);
  };

  const handleOpenMove = () => {
    if (!selectedNode) return;
    setIsRenameOpen(false);
    setErrorKey(null);
    setIsCopyOpen(false);
    setCopyErrorKey(null);
    setMoveParentId(selectedNode.parent_id ?? "");
    setMoveErrorKey(null);
    setIsMoveOpen(true);
  };

  const handleCloseMove = () => {
    if (isSubmitting) return;
    setIsMoveOpen(false);
    setMoveErrorKey(null);
  };

  const handleOpenCopy = () => {
    if (!selectedNode) return;
    setIsRenameOpen(false);
    setErrorKey(null);
    setIsMoveOpen(false);
    setMoveErrorKey(null);
    setCopyParentId(selectedNode.parent_id ?? "");
    setCopyErrorKey(null);
    setCopyNoticeKey(null);
    setIsCopyOpen(true);
  };

  const handleCloseCopy = () => {
    if (isSubmitting) return;
    setIsCopyOpen(false);
    setCopyErrorKey(null);
    setCopyNoticeKey(null);
  };

  const handleSubmitCopy = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedNode) return;
    const trimmed = copyParentId.trim();
    if (!trimmed) {
      setCopyErrorKey("err.validation");
      return;
    }
    setIsSubmitting(true);
    setCopyErrorKey(null);
    setCopyNoticeKey(null);
    try {
      const result = await nodesApi.copyNode({
        nodeId: selectedNode.id,
        destinationParentId: trimmed,
      });
      if (result && typeof result === "object" && "parent_id" in result) {
        setSelectedNode(result as NodeItem);
        setIsCopyOpen(false);
        triggerRefresh();
      } else {
        setCopyNoticeKey("msg.copyQueued");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setCopyErrorKey(error.key);
      } else {
        setCopyErrorKey("err.network");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitMove = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedNode) return;
    const trimmed = moveParentId.trim();
    if (!trimmed) {
      setMoveErrorKey("err.validation");
      return;
    }
    setIsSubmitting(true);
    setMoveErrorKey(null);
    try {
      const result = await nodesApi.moveNode({
        nodeId: selectedNode.id,
        destinationParentId: trimmed,
      });
      if (result && typeof result === "object" && "parent_id" in result) {
        setSelectedNode(result as NodeItem);
      }
      setIsMoveOpen(false);
      triggerRefresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setMoveErrorKey(error.key);
      } else {
        setMoveErrorKey("err.network");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRename = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedNode) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setErrorKey("err.validation");
      return;
    }
    setIsSubmitting(true);
    setErrorKey(null);
    try {
      const updated = await nodesApi.renameNode({
        nodeId: selectedNode.id,
        newName: trimmed,
      });
      setSelectedNode(updated);
      setIsRenameOpen(false);
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

  const ownerValue = selectedNode
    ? formatOwnerLabel(selectedNode.owner_user_id, currentUser, new Map())
    : "-";

  return (
    <section className="inspector-panel">
      <div className="inspector-panel__title">{t("msg.detailsTitle")}</div>
      {selectedNode ? (
        <>
          <div className="inspector-panel__hero">
            <div className="inspector-panel__hero-copy">
              <p className="inspector-panel__title">{t("msg.detailsTitle")}</p>
              <strong className="inspector-panel__headline">{selectedNode.name}</strong>
              <span className="inspector-panel__pill">
                {isFavorite(selectedNode.id) ? t("action.removeFavorite") : t("action.favorite")}
              </span>
            </div>
            <div className="inspector-panel__quick-actions">
              <Button type="button" variant="secondary" onClick={handleOpenSelected}>
                {selectedNode.type === "FOLDER" ? t("action.open") : t("action.download")}
              </Button>
              <Button type="button" variant="secondary" onClick={handleShareSelected}>
                {t("action.share")}
              </Button>
              <Button type="button" variant="secondary" onClick={handleToggleFavorite}>
                {isFavorite(selectedNode.id) ? t("action.removeFavorite") : t("action.favorite")}
              </Button>
            </div>
          </div>
          <InspectorDetails node={selectedNode} ownerValue={ownerValue} pathValue={resolvedPath} />
          {actionNoticeKey ? <div className="inspector-panel__notice">{t(actionNoticeKey)}</div> : null}
          <div className="inspector-panel__actions">
            <Button type="button" variant="secondary" onClick={handleOpenRename}>
              {t("action.rename")}
            </Button>
            <Button type="button" variant="secondary" onClick={handleOpenMove}>
              {t("action.move")}
            </Button>
            <Button type="button" variant="secondary" onClick={handleOpenCopy}>
              {t("action.copy")}
            </Button>
          </div>
        </>
      ) : (
        <div className="inspector-panel__empty">{t("msg.selectItem")}</div>
      )}
      {isRenameOpen ? (
        <div role="dialog" aria-label={t("modal.rename.title")} className="inspector-panel__dialog">
          <div className="inspector-panel__dialog-title">{t("modal.rename.title")}</div>
          <form id="rename-node-form" onSubmit={handleSubmitRename} className="inspector-panel__dialog-body">
            <TextField
              id="inspector-rename-name"
              name="renameName"
              label={t("field.name")}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
            />
            {errorKey ? <div className="inspector-panel__error">{t(errorKey)}</div> : null}
          </form>
          <div className="inspector-panel__dialog-footer">
            <Button type="button" variant="secondary" onClick={handleCloseRename} disabled={isSubmitting}>
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              form="rename-node-form"
              variant="secondary"
              disabled={isSubmitting || !renameValue.trim()}
            >
              {t("action.save")}
            </Button>
          </div>
        </div>
      ) : null}
      {isMoveOpen ? (
        <div role="dialog" aria-label={t("modal.move.title")} className="inspector-panel__dialog">
          <div className="inspector-panel__dialog-title">{t("modal.move.title")}</div>
          <form id="move-node-form" onSubmit={handleSubmitMove} className="inspector-panel__dialog-body">
            <TextField
              id="inspector-move-destination"
              name="moveDestination"
              label={t("field.destination")}
              value={moveParentId}
              onChange={(event) => setMoveParentId(event.target.value)}
              autoFocus
            />
            {moveErrorKey ? <div className="inspector-panel__error">{t(moveErrorKey)}</div> : null}
          </form>
          <div className="inspector-panel__dialog-footer">
            <Button type="button" variant="secondary" onClick={handleCloseMove} disabled={isSubmitting}>
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              form="move-node-form"
              variant="secondary"
              disabled={isSubmitting || !moveParentId.trim()}
            >
              {t("action.apply")}
            </Button>
          </div>
        </div>
      ) : null}
      {isCopyOpen ? (
        <div role="dialog" aria-label={t("modal.copy.title")} className="inspector-panel__dialog">
          <div className="inspector-panel__dialog-title">{t("modal.copy.title")}</div>
          <form id="copy-node-form" onSubmit={handleSubmitCopy} className="inspector-panel__dialog-body">
            <TextField
              id="inspector-copy-destination"
              name="copyDestination"
              label={t("field.destination")}
              value={copyParentId}
              onChange={(event) => setCopyParentId(event.target.value)}
            />
            {copyErrorKey ? <div className="inspector-panel__error">{t(copyErrorKey)}</div> : null}
            {copyNoticeKey ? <div className="inspector-panel__notice">{t(copyNoticeKey)}</div> : null}
          </form>
          <div className="inspector-panel__dialog-footer">
            <Button type="button" variant="secondary" onClick={handleCloseCopy} disabled={isSubmitting}>
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              form="copy-node-form"
              variant="secondary"
              disabled={isSubmitting || !copyParentId.trim()}
            >
              {t("action.apply")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
