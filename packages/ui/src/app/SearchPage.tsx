import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, TextField } from "@nimbus/ui-kit";
import { ApiError } from "../api/errors";
import type { NodeItem, NodeType } from "../api/nodes";
import { createSearchApi } from "../api/search";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { createDebouncedCallback } from "./debounce";
import { FolderView } from "./FilesPage";
import { useInspectorState } from "./inspectorState";
import "./AuthForm.css";

const SEARCH_DEBOUNCE_MS = 300;
const RECENT_SEARCHES_KEY = "bento.recentSearches";

type SearchRequest = {
  query: string;
  type: NodeType | null;
};

function readRecentSearches() {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(queries: string[]) {
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(queries.slice(0, 6)));
}

export function SearchPage() {
  const navigate = useNavigate();
  const { setSelectedNode } = useInspectorState();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const typeFilter = (searchParams.get("type") as NodeType | null) ?? null;

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const searchApi = useMemo(() => createSearchApi(apiClient), [apiClient]);

  const [draftQuery, setDraftQuery] = useState(query);
  const [items, setItems] = useState<NodeItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const currentQueryRef = useRef(query);

  const commitQuery = useCallback((nextQuery: string, nextType: NodeType | null = typeFilter) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextType) params.set("type", nextType);
    setSearchParams(params, { replace: !nextQuery });
  }, [setSearchParams, typeFilter]);

  const runSearch = useCallback(
    async ({ query: activeQuery, type: activeType }: SearchRequest) => {
      try {
        const response = await searchApi.searchNodes({ query: activeQuery, type: activeType, includeMetadata: true });
        if (currentQueryRef.current !== `${activeQuery}|${activeType ?? ""}`) return;
        setItems(response.items ?? []);
        setNextCursor(response.next_cursor ?? null);
        if (activeQuery) {
          const nextRecent = [activeQuery, ...readRecentSearches().filter((entry) => entry !== activeQuery)];
          writeRecentSearches(nextRecent);
          setRecentSearches(nextRecent.slice(0, 6));
        }
      } catch (error) {
        if (currentQueryRef.current !== `${activeQuery}|${activeType ?? ""}`) return;
        setErrorKey(error instanceof ApiError ? error.key : "err.network");
        setItems([]);
        setNextCursor(null);
      } finally {
        if (currentQueryRef.current === `${activeQuery}|${activeType ?? ""}`) {
          setLoading(false);
        }
      }
    },
    [searchApi],
  );

  const debouncedSearch = useMemo(() => createDebouncedCallback<SearchRequest>(SEARCH_DEBOUNCE_MS, runSearch), [runSearch]);

  useEffect(() => {
    setDraftQuery(query);
    setRecentSearches(readRecentSearches());
    currentQueryRef.current = `${query}|${typeFilter ?? ""}`;
    setSelectedNode(null);
    setSelectedIds(new Set());

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
    debouncedSearch.trigger({ query, type: typeFilter });
  }, [debouncedSearch, query, setSelectedNode, typeFilter]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const loadMore = useCallback(async () => {
    if (!query || !nextCursor) return;
    setLoadingMore(true);
    setErrorKey(null);
    try {
      const response = await searchApi.searchNodes({
        query,
        cursor: nextCursor,
        type: typeFilter,
        includeMetadata: true,
      });
      if (currentQueryRef.current !== `${query}|${typeFilter ?? ""}`) return;
      setItems((prev) => [...prev, ...(response.items ?? [])]);
      setNextCursor(response.next_cursor ?? null);
    } catch (error) {
      if (currentQueryRef.current !== `${query}|${typeFilter ?? ""}`) return;
      setErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, query, searchApi, typeFilter]);

  const openItem = useCallback((item: NodeItem) => {
    if (item.type === "FOLDER") {
      navigate(`/files/${item.id}`);
      return;
    }
    navigate(item.parent_id ? `/files/${item.parent_id}` : "/files");
  }, [navigate]);

  return (
    <section className="files-page">
      <header className="files-page__hero">
        <div className="files-page__hero-copy">
          <p className="files-page__eyebrow">{t("field.search")}</p>
          <h1 className="files-page__title">{t("msg.searchHeroTitle")}</h1>
          <p className="files-page__description">
            {query ? t("msg.searchResultsSummary").replace("{q}", query).replace("{n}", String(items.length)) : t("msg.searchIdleDetail")}
          </p>
        </div>
      </header>

      <section className="files-page__panel">
        <div className="auth-form__split">
          <TextField
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            label={t("field.search")}
            placeholder={t("msg.searchPlaceholder")}
          />
          <div className="files-page__panel-actions">
            <Button variant={typeFilter === null ? "primary" : "ghost"} onClick={() => commitQuery(draftQuery.trim(), null)}>{t("msg.searchFilterAll")}</Button>
            <Button variant={typeFilter === "FILE" ? "primary" : "ghost"} onClick={() => commitQuery(draftQuery.trim(), "FILE")}>{t("msg.searchFilterFiles")}</Button>
            <Button variant={typeFilter === "FOLDER" ? "primary" : "ghost"} onClick={() => commitQuery(draftQuery.trim(), "FOLDER")}>{t("msg.searchFilterFolders")}</Button>
          </div>
        </div>
        {recentSearches.length ? (
          <div className="files-page__panel-actions">
            {recentSearches.map((recent) => (
              <Button key={recent} variant="ghost" onClick={() => commitQuery(recent, typeFilter)}>{recent}</Button>
            ))}
          </div>
        ) : null}
      </section>

      {query ? (
        <FolderView
          title={t("field.search")}
          metaLabelKey="field.search"
          metaValue={query}
          items={items}
          nextCursor={nextCursor}
          loading={loading}
          loadingMore={loadingMore}
          errorKey={errorKey}
          emptyKey="msg.emptySearch"
          routeMode="recent"
          selectedIds={selectedIds}
          onToggleSelect={(item, multi) => {
            setSelectedIds((prev) => {
              const next = new Set(multi ? prev : []);
              if (multi && prev.has(item.id)) {
                next.delete(item.id);
              } else {
                next.add(item.id);
              }
              return next;
            });
            setSelectedNode(multi ? null : item);
          }}
          onOpenItem={openItem}
          onLoadMore={loadMore}
          onRetry={() => commitQuery(query, typeFilter)}
        />
      ) : (
        <section className="files-page__panel">
          <h2 className="files-page__panel-title">{t("msg.searchIdleTitle")}</h2>
          <p className="files-page__panel-copy">{t("msg.searchIdleDetail")}</p>
        </section>
      )}
    </section>
  );
}
