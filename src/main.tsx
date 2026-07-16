import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { purgeLegacyAnamnesisStorage } from "./lib/anamnesisDraftStorage.ts";
import "./index.css";

// Remove health data persisted by versions that predate session-scoped drafts.
try {
  purgeLegacyAnamnesisStorage(localStorage);
} catch {
  // Storage may be unavailable in hardened browser contexts.
}

createRoot(document.getElementById("root")!).render(<App />);
