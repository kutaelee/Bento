import React from "react";
import type { I18nKey } from "../i18n/t";
import { t } from "../i18n/t";
import { EmptyState } from "@nimbus/ui-kit";

type SimplePageProps = {
  titleKey: I18nKey;
  emptyKey?: I18nKey;
};

export function SimplePage({ titleKey, emptyKey }: SimplePageProps) {
  return (
    <section style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 20, marginBottom: 24 }}>{t(titleKey)}</h1>
      {emptyKey ? <EmptyState titleKey={t(emptyKey)} /> : null}
    </section>
  );
}
