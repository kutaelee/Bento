import React, { useState } from "react";
import { Dialog } from "../Dialog";
import { Button } from "../Button";
import { TextField } from "../TextField";

export type ConfirmDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    requireTypeToConfirm?: string; // If set, user must type this to enable confirm button
    requireTypeLabel?: string; // The label instructions, e.g. "Type 'delete' to confirm"
    isDestructive?: boolean;
};

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    requireTypeToConfirm,
    requireTypeLabel,
    isDestructive = false,
}: ConfirmDialogProps) {
    const [typedValue, setTypedValue] = useState("");

    const isConfirmEnabled = requireTypeToConfirm === undefined || typedValue === requireTypeToConfirm;

    return (
        <Dialog
            open={isOpen}
            onClose={() => {
                setTypedValue("");
                onClose();
            }}
            title={title}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setTypedValue("");
                            onClose();
                        }}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        disabled={!isConfirmEnabled}
                        variant={isDestructive ? "danger" : "primary"}
                        onClick={() => {
                            setTypedValue("");
                            onConfirm();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <p style={{ margin: "0 0 var(--nd-space-4, 16px) 0" }}>{description}</p>
            {requireTypeToConfirm && (
                <div style={{ marginTop: "var(--nd-space-4, 16px)" }}>
                    <label style={{ display: "block", marginBottom: "var(--nd-space-2, 8px)", fontSize: "0.875rem" }}>
                        {requireTypeLabel || `Please type "${requireTypeToConfirm}" to confirm:`}
                    </label>
                    <TextField
                        value={typedValue}
                        onChange={(event) => setTypedValue(event.target.value)}
                        placeholder={requireTypeToConfirm}
                    />
                </div>
            )}
        </Dialog>
    );
}
