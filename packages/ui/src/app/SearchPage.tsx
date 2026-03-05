import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../api/errors";
import type { NodeItem } from "../api/nodes";
import { createSearchApi } from "../api/search";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { createDebouncedCallback } from "./debounce";
import { FolderView } from "./FilesPage";
import { useInspectorState } from "./inspectorState";

const SEARCH_DEBOUNCE_MS = 300;

export function SearchPage() {
  const { selectedNode, setSelectedNode } = useInspectorState();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const searchApi = useMemo(() => createSearchApi(apiClient), [apiClient]);

  const [items, setItems] = useState<NodeItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);

  const currentQueryRef = useRef(query);

  const runSearch = useCallback(
    async (activeQuery: string) => {
      try {
        const response = await searchApi.searchNodes({ query: activeQuery });
        if (currentQueryRef.current !== activeQuery) return;
        setItems(response.items ?? []);
        setNextCursor(response.next_cursor ?? null);
      } catch (error) {
        if (currentQueryRef.current !== activeQuery) return;
        if (error instanceof ApiError) {
          setErrorKey(error.key);
        } else {
          setErrorKey("err.network");
        }
        setItems([]);
        setNextCursor(null);
      } finally {
        if (currentQueryRef.current === activeQuery) {
          setLoading(false);
        }
      }
    },
    [searchApi],
  );

  const debouncedSearch = useMemo(
    () => createDebouncedCallback(SEARCH_DEBOUNCE_MS, runSearch),
    [runSearch],
  );

  useEffect(() => {
    currentQueryRef.current = query;
    setSelectedNode(null);

    if (!query) {
      debouncedSearch.cancel();
      setItems([]);
      setNextCursor(null);
      setErrorKey(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setItems([]);
    setNextCursor(null);
    setErrorKey(null);
    setLoadingMore(false);
    setLoading(true);
    debouncedSearch.trigger(query);
  }, [debouncedSearch, query, setSelectedNode]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      setSelectedNode(null);
    };
  }, [debouncedSearch, setSelectedNode]);

  const loadMore = useCallback(async () => {
    if (!query || !nextCursor) return;
    setLoadingMore(true);
    setErrorKey(null);
    try {
      const response = await searchApi.searchNodes({
        query,
        cursor: nextCursor,
      });
      if (currentQueryRef.current !== query) return;
      setItems((prev) => [...prev, ...(response.items ?? [])]);
      setNextCursor(response.next_cursor ?? null);
    } catch (error) {
      if (currentQueryRef.current !== query) return;
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, query, searchApi]);

  return (
    <FolderView
      title={t("field.search")}
      metaLabelKey="field.search"
      metaValue={query || null}
      items={items}
      nextCursor={nextCursor}
      loading={loading}
      loadingMore={loadingMore}
      errorKey={errorKey}
      emptyKey="msg.emptySearch"
      selectedNodeId={selectedNode?.id}
      onSelectItem={setSelectedNode}
      onLoadMore={loadMore}
    />
  );
}
