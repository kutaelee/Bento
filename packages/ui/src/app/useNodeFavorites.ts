import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeItem } from "../api/nodes";

const FAVORITES_STORAGE_KEY = "ui.nodes.favorites";
const FAVORITES_CHANGE_EVENT = "bento:favorites-change";

type FavoritesMap = Record<string, NodeItem>;

const loadFavorites = (): FavoritesMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FavoritesMap;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, NodeItem] => {
        const [key, value] = entry;
        return Boolean(key) && Boolean(value && typeof value === "object" && "id" in value);
      }),
    );
  } catch {
    return {};
  }
};

const saveFavorites = (favorites: FavoritesMap) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT));
};

const byUpdatedDesc = (left: NodeItem, right: NodeItem) =>
  left.updated_at > right.updated_at ? -1 : left.updated_at < right.updated_at ? 1 : left.name.localeCompare(right.name);

export function useNodeFavorites() {
  const [favoritesMap, setFavoritesMap] = useState<FavoritesMap>(() => loadFavorites());

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const refresh = () => setFavoritesMap(loadFavorites());
    window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const commit = useCallback((updater: (previous: FavoritesMap) => FavoritesMap) => {
    setFavoritesMap((previous) => {
      const next = updater(previous);
      if (next === previous) return previous;
      queueMicrotask(() => saveFavorites(next));
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((node: NodeItem) => {
    commit((previous) => {
      if (previous[node.id]) {
        const next = { ...previous };
        delete next[node.id];
        return next;
      }

      return {
        ...previous,
        [node.id]: node,
      };
    });
  }, [commit]);

  const syncFavorites = useCallback((nodes: NodeItem[]) => {
    if (!nodes.length) return;

    commit((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const node of nodes) {
        if (!next[node.id]) continue;
        const current = next[node.id];
        if (JSON.stringify(current) === JSON.stringify(node)) continue;
        next[node.id] = { ...current, ...node };
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [commit]);

  const favoriteIds = useMemo(() => new Set(Object.keys(favoritesMap)), [favoritesMap]);
  const favorites = useMemo(() => Object.values(favoritesMap).sort(byUpdatedDesc), [favoritesMap]);
  const isFavorite = useCallback((nodeId: string) => favoriteIds.has(nodeId), [favoriteIds]);

  return {
    favorites,
    favoriteIds,
    isFavorite,
    toggleFavorite,
    syncFavorites,
  };
}
