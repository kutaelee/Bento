import React from "react";

export type TreeNode = {
  id: string;
  label: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  isSelected?: boolean;
  isLoading?: boolean;
  children?: TreeNode[];
};

export type TreeViewProps = {
  nodes: readonly TreeNode[];
  onToggle?: (node: TreeNode) => void;
  onSelect?: (node: TreeNode) => void;
  className?: string;
};

export function TreeView({ nodes, onToggle, onSelect, className }: TreeViewProps) {
  const rows: React.ReactNode[] = [];

  const walk = (node: TreeNode, depth: number) => {
    const isExpandable = Boolean(node.hasChildren || node.children?.length);
    const icon = !isExpandable ? "•" : node.isExpanded ? "▾" : "▸";

    rows.push(
      <div
        key={node.id}
        data-testid={`tree-node-${node.id}`}
        className={`nd-treeview__row${node.isSelected ? " nd-treeview__row--selected" : ""}`}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => onSelect?.(node)}
      >
        <button
          type="button"
          className="nd-treeview__toggle"
          aria-label={isExpandable ? `toggle-${node.id}` : `node-${node.id}`}
          onClick={(event) => {
            event.stopPropagation();
            if (isExpandable) {
              onToggle?.(node);
            }
          }}
        >
          {node.isLoading ? "…" : icon}
        </button>
        <span className="nd-treeview__label">{node.label}</span>
      </div>,
    );

    if (node.isExpanded && node.children) {
      node.children.forEach((child) => walk(child, depth + 1));
    }
  };

  nodes.forEach((node) => walk(node, 0));

  return (
    <div className={`nd-treeview ${className ?? ""}`.trim()} role="tree">
      {rows}
    </div>
  );
}
