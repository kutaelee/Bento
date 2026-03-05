import React from "react";

type ForbiddenStateProps = {
  title?: string;
  detail?: string;
};

const styles: {
  wrapper: React.CSSProperties;
  title: React.CSSProperties;
  detail: React.CSSProperties;
} = {
  wrapper: {
    padding: "1rem",
    borderRadius: "0.75rem",
    border: "1px dashed color-mix(in srgb, #2563eb 30%, transparent)",
    background: "color-mix(in srgb, #bfdbfe 28%, transparent)",
    color: "#1e3a8a",
  },
  title: {
    margin: 0,
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  detail: {
    marginTop: "0.35rem",
    marginBottom: 0,
    fontSize: "0.85rem",
  },
};

export function ForbiddenState({
  title = "접근이 제한된 리소스입니다",
  detail = "권한이 없는 페이지이거나 링크가 만료된 경로입니다.",
}: ForbiddenStateProps) {
  return (
    <div style={styles.wrapper} role="status">
      <p style={styles.title}>{title}</p>
      {detail ? <p style={styles.detail}>{detail}</p> : null}
    </div>
  );
}

export type { ForbiddenStateProps };
