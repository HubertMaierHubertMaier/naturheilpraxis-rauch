# Restore Part 1: Overview, Config & Dependencies

**Date:** 2026-02-22 | **Project:** Naturheilpraxis Peter Rauch

## Technology Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Mail:** PHP Mail-Relay on rauch-heilpraktiker.de

## Environment Variables (.env)
```bash
VITE_SUPABASE_URL="https://<supabase-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<supabase-publishable-key>"
VITE_SUPABASE_PROJECT_ID="<supabase-project-ref>"
```

## Critical Secrets (Supabase Edge Functions)
- `RELAY_SECRET`: `[REDACTED - vor Verwendung rotieren]`
- `SUPABASE_SERVICE_ROLE_KEY`: (set via Lovable Cloud Secrets)

## NPM Dependencies (exact versions)
```json
{
  "@hookform/resolvers": "^3.10.0",
  "@radix-ui/react-accordion": "^1.2.11",
  "@radix-ui/react-alert-dialog": "^1.1.14",
  "@radix-ui/react-aspect-ratio": "^1.1.7",
  "@radix-ui/react-avatar": "^1.1.10",
  "@radix-ui/react-checkbox": "^1.3.2",
  "@radix-ui/react-collapsible": "^1.1.11",
  "@radix-ui/react-context-menu": "^2.2.15",
  "@radix-ui/react-dialog": "^1.1.14",
  "@radix-ui/react-dropdown-menu": "^2.1.15",
  "@radix-ui/react-hover-card": "^1.1.14",
  "@radix-ui/react-label": "^2.1.7",
  "@radix-ui/react-menubar": "^1.1.15",
  "@radix-ui/react-navigation-menu": "^1.2.13",
  "@radix-ui/react-popover": "^1.1.14",
  "@radix-ui/react-progress": "^1.1.7",
  "@radix-ui/react-radio-group": "^1.3.7",
  "@radix-ui/react-scroll-area": "^1.2.9",
  "@radix-ui/react-select": "^2.2.5",
  "@radix-ui/react-separator": "^1.1.7",
  "@radix-ui/react-slider": "^1.3.5",
  "@radix-ui/react-slot": "^1.2.3",
  "@radix-ui/react-switch": "^1.2.5",
  "@radix-ui/react-tabs": "^1.1.12",
  "@radix-ui/react-toast": "^1.2.14",
  "@radix-ui/react-toggle": "^1.1.9",
  "@radix-ui/react-toggle-group": "^1.1.10",
  "@radix-ui/react-tooltip": "^1.2.7",
  "@supabase/supabase-js": "^2.90.1",
  "@tanstack/react-query": "^5.83.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "date-fns": "^3.6.0",
  "embla-carousel-react": "^8.6.0",
  "input-otp": "^1.4.2",
  "jspdf": "^4.0.0",
  "lucide-react": "^0.462.0",
  "next-themes": "^0.3.0",
  "react": "^18.3.1",
  "react-day-picker": "^8.10.1",
  "react-dom": "^18.3.1",
  "react-hook-form": "^7.61.1",
  "react-resizable-panels": "^2.1.9",
  "react-router-dom": "^6.30.1",
  "recharts": "^2.15.4",
  "sonner": "^1.7.4",
  "tailwind-merge": "^2.6.0",
  "tailwindcss-animate": "^1.0.7",
  "vaul": "^0.9.9",
  "zod": "^3.25.76"
}
```

## components.json (shadcn/ui)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

## index.html
```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Naturheilpraxis Peter Rauch | Heilpraktiker in Augsburg</title>
    <meta name="description" content="Naturheilpraxis Peter Rauch in Augsburg – ganzheitliche Therapien, Irisdiagnose, Darmsanierung und individuelle Beratung für Ihre Gesundheit." />
    <meta name="author" content="Peter Rauch, Heilpraktiker" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://rauch-heilpraktiker.de/" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://rauch-heilpraktiker.de/" />
    <meta property="og:title" content="Naturheilpraxis Peter Rauch | Heilpraktiker in Augsburg" />
    <meta property="og:description" content="Naturheilpraxis Peter Rauch in Augsburg – ganzheitliche Therapien, Irisdiagnose, Darmsanierung und individuelle Beratung für Ihre Gesundheit." />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:site_name" content="Naturheilpraxis Peter Rauch" />
    <meta name="geo.region" content="DE-BY" />
    <meta name="geo.placename" content="Augsburg" />
    <meta name="geo.position" content="48.3561;10.9056" />
    <meta name="ICBM" content="48.3561, 10.9056" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## vite.config.ts
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

## src/main.tsx
```typescript
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```
