import { useState, useCallback, useEffect } from "react";

export type ViewMode = "table" | "grid";

export type ViewPreferences = {
    viewMode: ViewMode;
    visibleColumns: string[];
};

const DEFAULT_PREFS: ViewPreferences = {
    viewMode: "table",
    visibleColumns: ["name", "modifiedAt", "size", "owner"],
};

export function useViewPreferences() {
    const [prefs, setPrefs] = useState<ViewPreferences>(() => {
        try {
            const stored = localStorage.getItem("nimbus_view_prefs");
            if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
        } catch {
            // ignore
        }
        return DEFAULT_PREFS;
    });

    useEffect(() => {
        localStorage.setItem("nimbus_view_prefs", JSON.stringify(prefs));
    }, [prefs]);

    const setViewMode = useCallback((mode: ViewMode) => {
        setPrefs((prev: ViewPreferences) => ({ ...prev, viewMode: mode }));
    }, []);

    const toggleColumn = useCallback((column: string) => {
        setPrefs((prev: ViewPreferences) => {
            const visible = prev.visibleColumns.includes(column);
            if (visible) {
                return { ...prev, visibleColumns: prev.visibleColumns.filter((c: string) => c !== column) };
            }
            return { ...prev, visibleColumns: [...prev.visibleColumns, column] };
        });
    }, []);

    return { prefs, setViewMode, toggleColumn };
}
