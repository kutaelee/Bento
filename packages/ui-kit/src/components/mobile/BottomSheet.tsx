import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type BottomSheetProps = {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <>
            <div
                className="nd-bottom-sheet-backdrop"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? "auto" : "none",
                    transition: "opacity 0.2s",
                    zIndex: 999,
                }}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className="nd-bottom-sheet"
                style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "var(--nd-color-surface-primary, #ffffff)",
                    borderTopLeftRadius: "var(--nd-radius-xl, 16px)",
                    borderTopRightRadius: "var(--nd-radius-xl, 16px)",
                    padding: "var(--nd-space-4, 16px)",
                    paddingBottom: "max(var(--nd-space-4, 16px), env(safe-area-inset-bottom))",
                    transform: open ? "translateY(0)" : "translateY(100%)",
                    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    zIndex: 1000,
                    boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                role="dialog"
                aria-modal="true"
            >
                <div
                    style={{
                        width: 36,
                        height: 4,
                        backgroundColor: "var(--nd-color-border-hover, #d1d5db)",
                        borderRadius: 2,
                        margin: "0 auto var(--nd-space-4, 16px) auto",
                    }}
                />
                {title && (
                    <div style={{ marginBottom: "var(--nd-space-4, 16px)", fontWeight: 600, fontSize: "1.125rem" }}>
                        {title}
                    </div>
                )}
                <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
}
