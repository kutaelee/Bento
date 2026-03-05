import type { TreeNode } from "@nimbus/ui-kit";
import { t } from "../i18n/t";

export type FolderTreeEntry = {
  id: string;
  label: string;
  isExpanded: boolean;
  isLoading: boolean;
  childrenIds: string[] | null;
  hasChildren: boolean;
  nextCursor: string | null;
};

export type FolderTreeState = {
  rootId: string;
  nodes: Record<string, FolderTreeEntry>;
};

export type FolderTreeChild = {
  id: string;
  label: string;
  hasChildren: boolean;
};

export const createFolderTreeState = ({
  rootId,
  rootLabel,
  expanded = true,
}: {
  rootId: string;
  rootLabel: string;
  expanded?: boolean;
}): FolderTreeState => ({
  rootId,
  nodes: {
    [rootId]: {
      id: rootId,
      label: rootLabel,
      isExpanded: expanded,
      isLoading: false,
      childrenIds: null,
      hasChildren: true,
      nextCursor: null,
    },
  },
});

export const beginFolderNodeLoading = (
  state: FolderTreeState,
  nodeId: string,
): FolderTreeState => {
  const node = state.nodes[nodeId];
  if (!node || node.childrenIds !== null || node.isLoading) return state;
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...node,
        isLoading: true,
      },
    },
  };
};

export const markFolderNodeLoadFailed = (
  state: FolderTreeState,
  nodeId: string,
): FolderTreeState => {
  const node = state.nodes[nodeId];
  if (!node || !node.isLoading) return state;
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...node,
        isLoading: false,
      },
    },
  };
};

export const toggleFolderNode = (
  state: FolderTreeState,
  nodeId: string,
): { nextState: FolderTreeState; shouldLoad: boolean } => {
  const node = state.nodes[nodeId];
  if (!node) return { nextState: state, shouldLoad: false };

  if (node.isExpanded) {
    return {
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            isExpanded: false,
          },
        },
      },
      shouldLoad: false,
    };
  }

  const shouldLoad = node.childrenIds === null && !node.isLoading;
  return {
    nextState: {
      ...state,
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...node,
          isExpanded: true,
          isLoading: shouldLoad ? true : node.isLoading,
        },
      },
    },
    shouldLoad,
  };
};

export const makeLoadMoreNodeId = (parentId: string) => `__load_more__:${parentId}`;

export const isLoadMoreNodeId = (nodeId: string) => nodeId.startsWith("__load_more__:");

export const loadMoreParentId = (nodeId: string) => nodeId.replace("__load_more__:", "");

export const applyFolderNodeChildrenPage = (
  state: FolderTreeState,
  nodeId: string,
  children: FolderTreeChild[],
  nextCursor: string | null,
  append: boolean,
): FolderTreeState => {
  const node = state.nodes[nodeId];
  if (!node) return state;

  const incomingChildrenIds = children.map((child) => child.id);
  const childrenIds = append && node.childrenIds
    ? [...node.childrenIds, ...incomingChildrenIds]
    : incomingChildrenIds;

  const nextNodes: Record<string, FolderTreeEntry> = {
    ...state.nodes,
    [nodeId]: {
      ...node,
      isLoading: false,
      childrenIds,
      nextCursor,
      hasChildren: childrenIds.length > 0 || Boolean(nextCursor),
    },
  };

  children.forEach((child) => {
    const existing = nextNodes[child.id];
    nextNodes[child.id] = {
      id: child.id,
      label: child.label,
      isExpanded: existing?.isExpanded ?? false,
      isLoading: existing?.isLoading ?? false,
      childrenIds: existing?.childrenIds ?? null,
      hasChildren: child.hasChildren,
      nextCursor: existing?.nextCursor ?? null,
    };
  });

  return {
    ...state,
    nodes: nextNodes,
  };
};

// Backward-compatible alias (used by existing specs)
export const applyFolderNodeChildren = (
  state: FolderTreeState,
  nodeId: string,
  children: FolderTreeChild[],
): FolderTreeState => applyFolderNodeChildrenPage(state, nodeId, children, null, false);

export const buildTreeNodes = (
  state: FolderTreeState,
  selectedId: string,
): TreeNode[] => {
  const walk = (nodeId: string): TreeNode | null => {
    const node = state.nodes[nodeId];
    if (!node) return null;
    const children = node.childrenIds
      ? node.childrenIds
          .map((childId) => walk(childId))
          .filter((child): child is TreeNode => Boolean(child))
      : undefined;

    const loadMore = node.nextCursor
      ? ({
          id: makeLoadMoreNodeId(node.id),
          label: t("action.loadMore"),
          isExpanded: false,
          isLoading: false,
          isSelected: false,
          hasChildren: false,
        } as TreeNode)
      : null;

    const nextChildren = children
      ? loadMore
        ? [...children, loadMore]
        : children
      : loadMore
        ? [loadMore]
        : undefined;

    return {
      id: node.id,
      label: node.label,
      isExpanded: node.isExpanded,
      isLoading: node.isLoading,
      isSelected: node.id === selectedId,
      hasChildren: node.hasChildren,
      children: nextChildren,
    };
  };

  const rootNode = walk(state.rootId);
  return rootNode ? [rootNode] : [];
};
