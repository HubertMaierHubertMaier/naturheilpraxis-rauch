---
name: Separate Project Boundary Lovable vs Rauch-Heilpraktiker
description: Das Lovable-Projekt naturheilpraxis-rauch.lovable.app und rauch-heilpraktiker.de sind strikt getrennte, unabhängige Projekte und dürfen nicht vermischt werden
type: preference
---

# Strikte Projektgrenze

Für dieses Repository und alle weiteren Arbeiten gilt:

1. `https://naturheilpraxis-rauch.lovable.app` ist die eigenständige Lovable-Anwendung dieses Projekts.
2. `https://rauch-heilpraktiker.de` ist ein separates, unabhängiges Projekt/System.
3. Es darf **keine** implizite Kopplung, automatische Gleichsetzung oder Deployment-Annahme zwischen beiden Systemen getroffen werden.
4. Änderungen in diesem Repository beziehen sich ausschließlich auf die Lovable-Anwendung, solange der User nichts anderes ausdrücklich anweist.
5. Smoke-Tests, Freigaben, Sicherheitsbewertungen und Deployments müssen projektbezogen klar benannt werden.

## Konsequenz für die Arbeitsweise

1. Keine Aussagen wie „die Domain zeigt auf Lovable", solange der User das nicht explizit bestätigt.
2. Keine Maßnahmen an `rauch-heilpraktiker.de`, DNS, Plesk, WordPress oder Server-Deployment aus diesem Projektkontext heraus.
3. Live-Verifikation für dieses Projekt erfolgt über die Lovable-App, nicht über die getrennte Domain.
