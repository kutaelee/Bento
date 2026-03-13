import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installVisualFixtures } from "./app/visualFixtures";
import "./styles/fonts.css";
import "../../ui-kit/src/styles/global.css";

installVisualFixtures();

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

createRoot(container).render(
  <App />
);
