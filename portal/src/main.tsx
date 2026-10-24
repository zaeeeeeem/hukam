import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "./index.css";
import { App } from "./App";
import { PortalProvider } from "./lib/store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <PortalProvider>
        <App />
      </PortalProvider>
    </MotionConfig>
  </StrictMode>,
);
