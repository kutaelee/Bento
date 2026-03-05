import React from "react";

export type DialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
};

let dialogInstance = 0;

function getDialogId(prefix: string, id?: string) {
  if (id) {
    return id;
  }
  dialogInstance += 1;
  return `${prefix}-${dialogInstance}`;
}

export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel,
  className,
}: DialogProps) {
  const dialogId = getDialogId("nd-dialog", undefined);
  const titleId = title ? `${dialogId}-title` : undefined;
  const descriptionId = description ? `${dialogId}-desc` : undefined;

  const dialogClassName = ["nd-dialog", className].filter(Boolean).join(" ");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onClose) {
      onClose();
      return;
    }
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  const handleDialogRef = (node: HTMLDivElement | null) => {
    if (node && open) {
      node.focus();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="nd-dialog-overlay" onClick={handleBackdropClick}>
      <div
        className={dialogClassName}
        role="dialog"
        aria-modal={true}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        autoFocus
        onKeyDown={handleKeyDown}
        ref={handleDialogRef}
      >
        <div className="nd-dialog__header">
          <div className="nd-dialog__heading">
            {title ? (
              <h2 className="nd-dialog__title" id={titleId}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="nd-dialog__description" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          {onClose && closeLabel ? (
            <button type="button" className="nd-dialog__close" onClick={onClose}>
              {closeLabel}
            </button>
          ) : null}
        </div>
        <div className="nd-dialog__body">{children}</div>
        {footer ? <div className="nd-dialog__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
