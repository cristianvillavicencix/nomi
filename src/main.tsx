import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const CHUNK_RELOAD_KEY = "nomi-chunk-reload";

/** After a deploy, old tabs may request JS chunks that no longer exist (404). Reload once. */
const reloadOnceForStaleChunk = () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  const message =
    event.reason instanceof Error
      ? event.reason.message
      : String(event.reason ?? "");
  if (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  ) {
    reloadOnceForStaleChunk();
  }
});

window.addEventListener("load", () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
