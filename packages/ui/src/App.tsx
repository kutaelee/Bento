import React from "react";
import { AppRouter } from "./app/AppRouter";
import { LOCALE_CHANGE_EVENT } from "./i18n/t";
import { useTheme } from "./hooks/useTheme";

export function App() {
  useTheme();
  const [, forceRender] = React.useReducer((value) => value + 1, 0);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const rerender = () => forceRender();
    window.addEventListener(LOCALE_CHANGE_EVENT, rerender);
    window.addEventListener("storage", rerender);

    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, rerender);
      window.removeEventListener("storage", rerender);
    };
  }, []);

  return <AppRouter />;
}
