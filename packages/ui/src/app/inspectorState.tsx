import React, { createContext, useContext, useMemo, useState } from "react";
import type { NodeItem } from "../api/nodes";

type InspectorContextValue = {
  selectedNode: NodeItem | null;
  setSelectedNode: (node: NodeItem | null) => void;
};

type InspectorProviderProps = {
  children: React.ReactNode;
  initialSelectedNode?: NodeItem | null;
};

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function InspectorProvider({ children, initialSelectedNode = null }: InspectorProviderProps) {
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(initialSelectedNode);

  const value = useMemo(
    () => ({
      selectedNode,
      setSelectedNode,
    }),
    [selectedNode],
  );

  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}

export function useInspectorState() {
  const context = useContext(InspectorContext);
  if (!context) {
    throw new Error("useInspectorState must be used within InspectorProvider");
  }
  return context;
}
