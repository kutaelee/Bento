import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type OverlaySidebarProps = {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    side?: "left" | "right";
};

export function OverlaySidebar({ open, onClose, children, side = "left" }: OverlaySidebarProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <>
            <div
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
                style={{
                    position: "fixed",
                    top: 0,
                    bottom: 0,
                    [side]: 0,
                    width: "80%",
                    maxWidth: "320px",
                    backgroundColor: "var(--nd-color-surface-primary, #ffffff)",
                    transform: open ? "translateX(0)" : `translateX(${side === "left" ? "-100%" : "100%"})`,
                    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    zIndex: 1000,
                    boxShadow: side === "left" ? "4px 0 6px -1px rgba(0, 0, 0, 0.1)" : "-4px 0 6px -1px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                }}
                role="dialog"
                aria-modal="true"
            >
                {children}
            </div>
        </>,
        document.body
    );
}
