import React, { useEffect } from "react";

export type LightboxProps = {
    isOpen: boolean;
    onClose: () => void;
    imageUrl?: string;
    imageName?: string;
    onNext?: () => void;
    onPrev?: () => void;
};

export function Lightbox({ isOpen, onClose, imageUrl, imageName, onNext, onPrev }: LightboxProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") onNext?.();
            if (e.key === "ArrowLeft") onPrev?.();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, onNext, onPrev]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
            onClick={onClose}
        >
            <button
                style={{
                    position: "absolute",
                    top: "var(--nd-space-4, 16px)",
                    right: "var(--nd-space-4, 16px)",
                    background: "none",
                    border: "none",
                    color: "white",
                    fontSize: "2rem",
                    cursor: "pointer",
                }}
                onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onClose();
                }}
            >
                ×
            </button>

            {onPrev && (
                <button
                    style={{
                        position: "absolute",
                        left: "var(--nd-space-4, 16px)",
                        background: "none",
                        border: "none",
                        color: "white",
                        fontSize: "4rem",
                        cursor: "pointer",
                        padding: "var(--nd-space-4, 16px)",
                    }}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onPrev();
                    }}
                >
                    ‹
                </button>
            )}

            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={imageName}
                    style={{
                        maxWidth: "90%",
                        maxHeight: "90%",
                        objectFit: "contain",
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
            ) : (
                <div style={{ color: "white" }}>Loading...</div>
            )}

            {onNext && (
                <button
                    style={{
                        position: "absolute",
                        right: "var(--nd-space-4, 16px)",
                        background: "none",
                        border: "none",
                        color: "white",
                        fontSize: "4rem",
                        cursor: "pointer",
                        padding: "var(--nd-space-4, 16px)",
                    }}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onNext();
                    }}
                >
                    ›
                </button>
            )}
        </div>
    );
}
