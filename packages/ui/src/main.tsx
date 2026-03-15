import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installVisualFixtures } from "./app/visualFixtures";
import "./app/ShellTheme.css";
import "./styles/fonts.css";
import "../../ui-kit/src/styles/global.css";
import "./styles/tailwind.css";

installVisualFixtures();

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

const app = <App />;

createRoot(container).render(import.meta.env.PROD ? <React.StrictMode>{app}</React.StrictMode> : app);
