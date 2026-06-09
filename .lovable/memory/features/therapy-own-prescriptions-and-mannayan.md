---
name: Therapie-Empfehlung — eigene Verordnungsvorlagen + Mannayan-Bestellungen prüfen
description: Eigene Therapie-/Verordnungspläne und Mannayan-Bestellungen müssen patientenbezogen mit Befund, Diagnostik, Wiki und Sicherheit abgeglichen werden.
type: feature
---

## Regel

In der Therapie-Empfehlung dürfen eigene Mittel/Verordnungsideen des Therapeuten sowie bereits gespeicherte Mannayan-Bestellungen nicht blind übernommen werden. Sie müssen gegen Befund-Auswertung, Symptome, Labor/Stuhl, Arztberichte, Medikamente, Voruntersuchungen, Wiki-Kontext und Kontraindikationen geprüft werden.

## Umsetzungspflicht

- Eigene Therapie-/Verordnungsvorlagen können als Freitext, PDF, Word (.docx) oder Textdatei in das Therapie-Tool übernommen werden.
- Mannayan-Bestellungen werden über die Pseudonym-ID im Feld `patient_label` gefunden und als real bestellte/vorgesehene Präparate in die Prüfung einbezogen.
- Die KI-Auswertung braucht eine eigene Sektion **„🧾 Prüfung der eingebrachten Therapie/Verordnung"**.
- Pro Mittel/Maßnahme muss ausgewiesen werden:
  - Herkunft: eigene Eingabe / Datei / Mannayan-Bestellung
  - Patiententhema/Befundbezug
  - Bewertung: ✅ passend / 🔄 anpassen / ❓ unklare Indikation / ⚠️ Risiko / ❌ nicht passend
  - Begründung und ggf. Anpassung oder fehlende Daten
- Wenn ein Präparat nicht im Wiki-Kontext vorhanden ist: als externe/therapeutische Vorgabe kennzeichnen und Wiki-Ergänzung empfehlen, nicht halluzinieren.
