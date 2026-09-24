import React from "react";
import { createRoot } from "react-dom/client";
import App from "../App.web";
document.documentElement.lang = "ru";
document
  .querySelector('meta[name="viewport"]')
  ?.setAttribute(
    "content",
    "width=device-width, initial-scale=1, viewport-fit=cover",
  );
createRoot(document.getElementById("root")!).render(React.createElement(App));
