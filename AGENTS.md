# Repository Guidelines

## Project Structure & Module Organization
This Vite/React/TypeScript project lives mainly in `src/`, with page routes in `src/pages/`, shared UI in `src/components/`, domain logic in `src/lib/`, and Supabase client code in `src/integrations/supabase/`. Server-side logic, migrations, and backup/export functions live under `supabase/`. Static patient content pages are stored in `public/`. Historical analysis and restore notes are split across `docs/`, `doc/`, and `session_historie/`.

## Startup Memory
Before any non-trivial work in a new session, read `OpenCode-Erinnerung/00-Index.md`. If the task touches Infothek HTMLs, GitHub/Lovable sync, backup behavior, or the SIBO page, also read the matching file inside `OpenCode-Erinnerung/` before editing.
After meaningful new findings, update `OpenCode-Erinnerung/` so durable project knowledge does not remain only in day-specific handoff files.
For new or changed Infothek HTMLs, do not treat the task as done when the file exists locally or even on GitHub. The primary acceptance check is that the entry is visible inside the Lovable project UI/admin-side Infothek view. Public `Publish -> Update` is secondary and only required when the user wants public visibility.

## Build, Test, and Development Commands
Install with `npm ci`. Start local dev only after checking port usage: `npm run dev -- --host 127.0.0.1 --port <port> --strictPort`. Build with `npm run build` or `npm run build:dev`. Run tests with `npm test`; run a focused test with `npx vitest run src/test/<file>.test.tsx`. Type-check with `npx tsc -p tsconfig.app.json --noEmit` and `npx tsc -p tsconfig.node.json --noEmit`.

## Coding Style & Naming Conventions
Use TypeScript, React function components, and the existing `@/` import alias. Keep changes small and local. Follow the existing style in `src/`: PascalCase for components/pages, camelCase for hooks and library helpers, and route/content slugs in lowercase ASCII. ESLint is configured via `eslint.config.js`; `npm run lint` currently has known baseline failures, so do not treat existing lint debt as a regression unless your change adds new issues.

## Testing Guidelines
Tests use Vitest with Testing Library and live under `src/test/`. Prefer targeted test runs while iterating, then run `npm test` and the two `tsc` commands before finalizing meaningful frontend or routing changes. Build with `npm run build` when static assets, routes, or Infothek pages change.

## Commit & Sync Notes
Recent history mixes short descriptive messages and generic `Changes` commits. Match the clearer style when possible. For this project, GitHub/Lovable sync is operationally sensitive: do not assume Lovable has already pulled `main`; verify. The current practical memory for that workflow is documented in `OpenCode-Erinnerung/02-Lovable-GitHub-Backup-und-Sync.md`.
