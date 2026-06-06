# Phase 2 Decision – Öffentliche Online-Übermittlung des Anamnesebogens

- Datum: 2026-06-06
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `602b5d28cd2b8f92d83b0598022b17a59552c45d`
- Entscheidungstyp: fachliche Semantik / Security- und DSGVO-Gate
- Produktivcode in diesem Schritt geändert: nein
- Push/PR/Merge: nein

## Entscheidung

`anamnese_public=true` wird für Phase 2 als bewusst aktivierbarer echter öffentlicher Online-Übermittlungspfad verstanden.

Das bedeutet:

1. Anonyme Besucher dürfen `/anamnesebogen` ohne Login erreichen, wenn der Public-Schalter aktiv ist.
2. Der Header darf in diesem Zustand auf den Online-Anamnesebogen verlinken.
3. Ein vollständig validierter anonymer Online-Anamnesebogen darf den bestehenden `submit-anamnesis`-Verification-Pfad starten.
4. Die Übermittlung bleibt zweistufig: Erst `action: "submit"` mit E-Mail-Code/Verification-Dialog, danach gesonderte Bestätigung.
5. Diese Entscheidung gilt nur für den bewusst aktivierten Public-Modus und ersetzt keine rechtliche/DSGVO-Prüfung vor Live-Freischaltung.

## Abgrenzung

Nicht entschieden bzw. nicht geändert in diesem Schritt:

- Keine Änderung am Edge-Function-Code `submit-anamnesis`.
- Keine Änderung an Supabase Policies oder Tabellen.
- Keine Änderung am eigentlichen Verification-Code-Confirm-Pfad.
- Keine Live-Freischaltung, kein Push, kein PR, kein Merge.
- Keine Aussage, dass Lovable Live diese Phase bereits enthält.

## Sicherheitsannahmen

Der öffentliche Online-Pfad ist nur vertretbar, wenn die folgenden Punkte weiterhin gelten oder separat geprüft werden:

- Public-Zugriff ist explizit administrativ schaltbar.
- Die UI weist auf Datenschutz und Datenübermittlung hin.
- Vor finaler Übermittlung ist eine E-Mail-Code-Verifizierung vorgesehen.
- Tests verwenden ausschließlich synthetische Platzhalterdaten.
- Keine echten Patientendaten werden in Logs, Tests, Commits oder Screenshots aufgenommen.

## Testabsicherung in diesem Schritt

Der bestehende Test `src/test/anamnesebogen-public-submission-safety-characterization.test.tsx` wurde erweitert.

Neu charakterisiert:

- anonymer Besucher,
- `anamnese_public=true`,
- Route `/anamnesebogen`,
- Accordion-Layout,
- synthetisch gültige Pflichtfelder,
- synthetische Signatur-/Einwilligungsflags,
- Klick auf `Anamnesebogen absenden`,
- gemockter Supabase-Client,
- Erwartung: `supabase.functions.invoke("submit-anamnesis", { body: { action: "submit", ... } })` wird aufgerufen,
- Erfolgshinweis: `Bestätigungscode gesendet!`,
- kein echter Netzwerk-/Write-/E-Mail-Pfad.

## Verwendete synthetische Testdaten

Die Testdaten sind bewusst als nicht-reale Platzhalter erkennbar:

- Nachname: `Testperson`
- Vorname: `Synthetisch`
- E-Mail: `synthetic-anamnese@example.invalid`
- Adresse: `Testweg 1`, `00000`, `Teststadt`
- Telefonnummer: synthetische Platzhalternummer

Diese Daten sind nicht für produktive Systeme bestimmt und werden nicht an Supabase gesendet.

## Konsequenz für nächste Schritte

Da der öffentliche Online-Übermittlungspfad fachlich bestätigt ist, sollte als nächster priorisierter Schritt nicht blockiert, sondern transparent abgesichert werden:

1. Admin-/UI-Copy prüfen: Der Public-Schalter darf nicht mehr nur als unverbindlicher Testmodus missverständlich beschrieben werden.
2. Der Hinweistext auf dem Anamnesebogen sollte klar machen, dass bei Absenden Daten an die Praxis übermittelt werden.
3. Der Confirm-/Verification-Pfad sollte separat mit gemockten PDF-/Supabase-Funktionen abgesichert werden, bevor größere Refactorings am Anamnesebogen oder an `submit-anamnesis` erfolgen.
4. Vor Push/PR muss im Handoff explizit stehen, dass Phase 2 den öffentlichen Online-Anamnesebogen sichtbarer macht und den bereits bestehenden öffentlichen Submit-Start testbasiert dokumentiert.
