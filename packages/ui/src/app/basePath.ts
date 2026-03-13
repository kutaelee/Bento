export const getAppBasePath = () => {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname;
  if (path === "/bento" || path.startsWith("/bento/")) return "/bento";
  return "";
};

export const withBasePath = (path: string) => {
  const base = getAppBasePath();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};
