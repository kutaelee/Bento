import React from "react";
import type { I18nKey } from "../i18n/t";
import { t } from "../i18n/t";
import { EmptyState } from "@nimbus/ui-kit";
import "./SimplePage.css";

type SimplePageProps = {
  titleKey: I18nKey;
  emptyKey?: I18nKey;
};

export function SimplePage({ titleKey, emptyKey }: SimplePageProps) {
  return (
    <section className="simple-page">
      <h1 className="simple-page__title">{t(titleKey)}</h1>
      {emptyKey ? <EmptyState titleKey={t(emptyKey)} /> : null}
    </section>
  );
}
