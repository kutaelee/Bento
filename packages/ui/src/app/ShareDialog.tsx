import React, { useEffect, useMemo, useState } from "react";
import { Button, Dialog, TextField } from "@nimbus/ui-kit";
import { ApiError } from "../api/errors";
import { createNodesApi, type ShareLink } from "../api/nodes";
import type { NodeItem } from "../api/nodes";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import "./ShareDialog.css";

const secondsPerDay = 86400;

type ShareDialogProps = {
  open: boolean;
  node: NodeItem | null;
  onClose: () => void;
};

export function ShareDialog({ open, node, onClose }: ShareDialogProps) {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

  const [requirePassword, setRequirePassword] = useState(false);
  const [setExpiry, setSetExpiry] = useState(false);
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);

  useEffect(() => {
    if (!open) return;
    setRequirePassword(false);
    setSetExpiry(false);
    setPassword("");
    setExpiryDays("7");
    setErrorKey(null);
    setShareLink(null);
    setIsSubmitting(false);
  }, [open, node?.id]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!node) return;

    const trimmedPassword = password.trim();
    if (requirePassword && trimmedPassword.length < 6) {
      setErrorKey("err.validation");
      return;
    }

    let expiresInSeconds: number | undefined;
    if (setExpiry) {
      const parsed = Number(expiryDays);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setErrorKey("err.validation");
        return;
      }
      const calculated = Math.round(parsed * secondsPerDay);
      if (calculated < 300) {
        setErrorKey("err.validation");
        return;
      }
      expiresInSeconds = calculated;
    }

    setIsSubmitting(true);
    setErrorKey(null);

    try {
      const link = await nodesApi.createShareLink({
        nodeId: node.id,
        expiresInSeconds,
        password: requirePassword ? trimmedPassword : undefined,
      });
      setShareLink(link);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareUrl = shareLink
    ? typeof window === "undefined"
      ? `/s/${shareLink.token}`
      : new URL(`/s/${shareLink.token}`, window.location.origin).toString()
    : "";

  const submitDisabled =
    !node ||
    isSubmitting ||
    (requirePassword && password.trim().length < 6) ||
    (setExpiry && !expiryDays.trim());

  return (
    <Dialog
      open={open}
      title={t("modal.share.title")}
      onClose={handleClose}
      closeLabel={t("action.close")}
      footer={
        <div className="nd-dialog__actions">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" form="share-link-form" disabled={submitDisabled} loading={isSubmitting}>
            {t("action.share")}
          </Button>
        </div>
      }
    >
      {node ? (
        <form id="share-link-form" onSubmit={handleSubmit} className="share-dialog__body">
          {shareLink ? (
            <div className="share-dialog__link-field">
              <TextField label={t("modal.share.link")} value={shareUrl} readOnly />
            </div>
          ) : null}
          <div className="share-dialog__section">
            <label className="share-dialog__checkbox-row">
              <input
                type="checkbox"
                checked={requirePassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRequirePassword(event.target.checked)}
              />
              {t("modal.share.requirePassword")}
            </label>
            {requirePassword ? (
              <TextField
                type="password"
                label={t("field.password")}
                value={password}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              />
            ) : null}
            <label className="share-dialog__checkbox-row">
              <input
                type="checkbox"
                checked={setExpiry}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSetExpiry(event.target.checked)}
              />
              {t("modal.share.setExpiry")}
            </label>
            {setExpiry ? (
              <TextField
                type="number"
                label={t("field.expiry")}
                value={expiryDays}
                min={1}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExpiryDays(event.target.value)}
              />
            ) : null}
          </div>
          {errorKey ? <div className="share-dialog__error">{t(errorKey)}</div> : null}
        </form>
      ) : (
        <div className="share-dialog__body">{t("msg.selectItem")}</div>
      )}
    </Dialog>
  );
}
