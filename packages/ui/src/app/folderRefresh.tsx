import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type FolderRefreshContextValue = {
  refreshToken: number;
  // Back-compat shim
  nonce: number;
  triggerRefresh: () => void;
};

const FolderRefreshContext = createContext<FolderRefreshContextValue | null>(null);

type FolderRefreshProviderProps = {
  children: React.ReactNode;
};

export function FolderRefreshProvider({ children }: FolderRefreshProviderProps) {
  const [refreshToken, setRefreshToken] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  const value = useMemo(
    () => ({
      refreshToken,
      nonce: refreshToken,
      triggerRefresh,
    }),
    [refreshToken, triggerRefresh],
  );

  return <FolderRefreshContext.Provider value={value}>{children}</FolderRefreshContext.Provider>;
}

export function useFolderRefresh() {
  const context = useContext(FolderRefreshContext);
  if (!context) {
    throw new Error("useFolderRefresh must be used within FolderRefreshProvider");
  }
  return context;
}
