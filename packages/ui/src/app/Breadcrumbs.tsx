import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ApiError } from "../api/errors";
import { createNodesApi, type BreadcrumbItem } from "../api/nodes";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { ROOT_NODE_ID } from "./nodes";

const breadcrumbStyles: {
  list: React.CSSProperties;
  separator: React.CSSProperties;
  link: React.CSSProperties;
  current: React.CSSProperties;
  ellipsis: React.CSSProperties;
  dropdown: React.CSSProperties;
  dropdownLink: React.CSSProperties;
  error: React.CSSProperties;
} = {
  list: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#111827",
  },
  separator: {
    color: "#9ca3af",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
  },
  current: {
    color: "#111827",
    fontWeight: 600,
  },
  ellipsis: {
    cursor: "pointer",
    padding: "0 4px",
    position: "relative",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    display: "flex",
    flexDirection: "column",
    padding: 8,
    zIndex: 50,
  },
  dropdownLink: {
    color: "#374151",
    textDecoration: "none",
    padding: "6px 12px",
    whiteSpace: "nowrap",
    borderRadius: 6,
  },
  error: {
    color: "#b91c1c",
    fontSize: 12,
  },
};

type BreadcrumbTrailProps = {
  items: BreadcrumbItem[];
  rootId?: string;
};

export function BreadcrumbTrail({ items, rootId = ROOT_NODE_ID }: BreadcrumbTrailProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!items.length) return null;

  let renderedItems = items;
  let collapsedItems: BreadcrumbItem[] = [];

  if (items.length > 4) {
    renderedItems = [items[0], { id: "ellipsis", name: "..." }, items[items.length - 2], items[items.length - 1]];
    collapsedItems = items.slice(1, items.length - 2);
  }

  return (
    <nav aria-label="breadcrumb" style={breadcrumbStyles.list}>
      {renderedItems.map((item, index) => {
        const isLast = index === renderedItems.length - 1;
        const path = item.id === rootId ? "/files" : `/files/${item.id}`;

        if (item.id === "ellipsis") {
          return (
            <React.Fragment key="ellipsis">
              <span
                style={breadcrumbStyles.ellipsis}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                tabIndex={0}
              >
                {item.name}
                {isDropdownOpen && (
                  <div style={breadcrumbStyles.dropdown}>
                    {collapsedItems.map((cItem) => (
                      <Link
                        key={cItem.id}
                        to={cItem.id === rootId ? "/files" : `/files/${cItem.id}`}
                        style={breadcrumbStyles.dropdownLink}
                      >
                        {cItem.name}
                      </Link>
                    ))}
                  </div>
                )}
              </span>
              <span style={breadcrumbStyles.separator}>/</span>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={item.id}>
            {isLast ? (
              <span aria-current="page" className="breadcrumbs__current">
                {item.name}
              </span>
            ) : (
              <Link to={path} className="breadcrumbs__link">
                {item.name}
              </Link>
            )}
            {isLast ? null : <span className="breadcrumbs__separator">/</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function Breadcrumbs() {
  const location = useLocation();
  const { nodeId } = useParams();
  const isFilesRoute = location.pathname.startsWith("/files");

  const [items, setItems] = useState<BreadcrumbItem[]>([]);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);

  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

  useEffect(() => {
    if (!isFilesRoute) return;

    if (!nodeId) {
      setItems([{ id: ROOT_NODE_ID, name: t("nav.files") }]);
      setErrorKey(null);
      return;
    }

    let active = true;
    const load = async () => {
      setErrorKey(null);
      try {
        const response = await nodesApi.getBreadcrumb(nodeId);
        if (!active) return;
        const nextItems = response.items?.length
          ? response.items
          : [{ id: ROOT_NODE_ID, name: t("nav.files") }];
        setItems(nextItems);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError) {
          setErrorKey(error.key);
        } else {
          setErrorKey("err.network");
        }
        setItems([{ id: ROOT_NODE_ID, name: t("nav.files") }]);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [isFilesRoute, nodeId, nodesApi]);

  if (!isFilesRoute) return null;
  if (errorKey) {
    return <div className="breadcrumbs__error">{t(errorKey)}</div>;
  }

  return <BreadcrumbTrail items={items} />;
}
