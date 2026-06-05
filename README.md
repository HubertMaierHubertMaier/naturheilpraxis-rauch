# Naturheilpraxis Rauch

Lokales Frontend-/Praxisprojekt auf Basis von Vite, React, TypeScript, shadcn-ui und Tailwind CSS.

## Projektstatus / Arbeitsweise

Dieses Repository ist mit GitHub/Lovable verbunden. Pushes können daher Live-/Builder-Folgen haben.

Verbindliche lokale Arbeitsregeln:

- Vor substantiellen Änderungen lokale ShadowCopy außerhalb des Repositorys erstellen.
- Änderungen phasenweise und klein halten.
- Lokale Gates vor Commit/Push ausführen.
- Kein Push, kein Pull Request, kein Merge ohne ausdrückliche separate Freigabe.
- Keine echten Patientendaten oder Anamnese-Daten in Logs, Tests, Commits, Screenshots oder unsicheren digitalen Flows verwenden.
- Automatischer Versand oder interaktive Übertragung von Anamnesedaten bleibt bis zur rechtlichen Prüfung deaktiviert.

Die neue Analyse- und Stabilisierungdokumentation liegt bewusst unter `doc/`.

## Lokales Setup

Voraussetzungen des zuletzt verifizierten lokalen Phase-1-Standes:

- Node.js: `v20.20.0`
- npm: `10.8.2`
- Lockfile: `package-lock.json`

Reproduzierbare Installation:

```sh
npm ci
```

Lokale Prüfungen:

```sh
npm test
npm run build
npx tsc --noEmit
npm run lint
```

Hinweis zum Lint-Status:

- `npm run lint` ist aktuell eine bekannte Bestandsschuld-Baseline und schlägt noch fehl.
- Zuletzt dokumentierte Baseline: `332 problems (300 errors, 32 warnings)`.
- Diese Lint-Schuld wird später separat strukturiert bearbeitet und blockiert Phase 1 nicht, solange sie nicht schlimmer wird.

## Devserver / Port-Regel

Für Stabilisierungsarbeit wird kein Devserver automatisch gestartet.

Falls ein Devserver für Browserprüfung notwendig ist:

1. Vorher freie Ports prüfen, z. B. mit:

   ```sh
   ss -ltnp
   ```

2. Einen explizit freien lokalen Port wählen.
3. Bevorzugt strikt und lokal starten, z. B.:

   ```sh
   npm run dev -- --host 127.0.0.1 --port <freier-port> --strictPort
   ```

Bekannte belegte Ports können u. a. `80`, `443`, `8000`, `8080`, `4321`, `8443`, `3001` und `9090` sein; immer aktuell prüfen.

## Verfügbare npm-Skripte

```sh
npm run dev       # Vite-Devserver, nur nach Portprüfung starten
npm run build     # Produktionsbuild
npm run build:dev # Development-Build
npm run lint      # ESLint-Baseline
npm test          # Vitest einmalig
npm run test:watch
npm run preview
```

## Technologien

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Vitest / Testing Library
- Supabase-Client / Supabase Edge Functions

## GitHub/Lovable

Remote:

```sh
https://github.com/reddy67/naturheilpraxis-rauch.git
```

Lokale Commits sind erlaubt, nachdem ein kleiner Schritt getestet und dokumentiert wurde.
Pushes zu GitHub/Lovable sind gesperrt, bis sie ausdrücklich separat freigegeben werden.
