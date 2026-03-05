import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TreeView, type TreeNode } from "@nimbus/ui-kit";
import { createNodesApi } from "../api/nodes";
import { t } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { ROOT_NODE_ID } from "./nodes";
import {
  applyFolderNodeChildrenPage,
  isLoadMoreNodeId,
  loadMoreParentId,
  beginFolderNodeLoading,
  buildTreeNodes,
  createFolderTreeState,
  markFolderNodeLoadFailed,
  toggleFolderNode,
} from "./folderTreeState";

type FolderTreeProps = {
  nodesApi?: ReturnType<typeof createNodesApi>;
};

export function FolderTree({ nodesApi: nodesApiOverride }: FolderTreeProps) {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const selectedId = nodeId ?? ROOT_NODE_ID;
  const { refreshToken } = useFolderRefresh();

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(
    () => nodesApiOverride ?? createNodesApi(apiClient),
    [apiClient, nodesApiOverride],
  );

  const createInitialTreeState = useCallback(
    () =>
      createFolderTreeState({
        rootId: ROOT_NODE_ID,
        rootLabel: t("nav.files"),
        expanded: true,
      }),
    [],
  );

  const [treeState, setTreeState] = useState(() => createInitialTreeState());

  const loadChildren = useCallback(
    async (targetId: string, cursor: string | null = null) => {
      try {
        const response = await nodesApi.listChildren({
          nodeId: targetId,
          cursor,
          limit: 200,
          sort: "name",
          order: "asc",
        });

        const folders = (response.items ?? [])
          .filter((item) => item.type === "FOLDER")
          .map((item) => ({ id: item.id, name: item.name }));

        const nextCursor = response.next_cursor ?? null;

        setTreeState((prev) =>
          applyFolderNodeChildrenPage(
            prev,
            targetId,
            folders.map((item) => ({
              id: item.id,
              label: item.name,
              hasChildren: true,
            })),
            nextCursor,
            Boolean(cursor),
          ),
        );
      } catch (error) {
        setTreeState((prev) => markFolderNodeLoadFailed(prev, targetId));
      }
    },
    [nodesApi],
  );

  useEffect(() => {
    let shouldLoad = false;
    setTreeState(() => {
      const baseState = createInitialTreeState();
      const next = beginFolderNodeLoading(baseState, ROOT_NODE_ID);
      shouldLoad = next.nodes[ROOT_NODE_ID].isLoading;
      return next;
    });
    if (shouldLoad) {
      void loadChildren(ROOT_NODE_ID);
    }
  }, [createInitialTreeState, loadChildren, refreshToken]);

  const handleToggle = useCallback(
    (node: TreeNode) => {
      let shouldLoad = false;
      setTreeState((prev) => {
        const result = toggleFolderNode(prev, node.id);
        shouldLoad = result.shouldLoad;
        return result.nextState;
      });
      if (shouldLoad) {
        void loadChildren(node.id);
      }
    },
    [loadChildren],
  );

  const handleSelect = useCallback(
    (node: TreeNode) => {
      if (isLoadMoreNodeId(node.id)) {
        const parentId = loadMoreParentId(node.id);
        let cursor: string | null = null;
        let shouldLoad = false;
        setTreeState((prev) => {
          const parent = prev.nodes[parentId];
          if (!parent || parent.isLoading || !parent.nextCursor) return prev;
          cursor = parent.nextCursor;
          shouldLoad = true;
          return {
            ...prev,
            nodes: {
              ...prev.nodes,
              [parentId]: {
                ...parent,
                isLoading: true,
              },
            },
          };
        });
        if (shouldLoad) {
          void loadChildren(parentId, cursor);
        }
        return;
      }
      if (node.id === ROOT_NODE_ID) {
        navigate("/files");
      } else {
        navigate(`/files/${node.id}`);
      }
    },
    [loadChildren, navigate, treeState.nodes],
  );

  const nodes = useMemo(
    () => buildTreeNodes(treeState, selectedId),
    [selectedId, treeState],
  );

  return <TreeView nodes={nodes} onToggle={handleToggle} onSelect={handleSelect} />;
}
