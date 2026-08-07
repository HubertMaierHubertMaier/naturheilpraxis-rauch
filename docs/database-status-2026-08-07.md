# Datenbankstatus und Arbeitsweise

Stand: 7. August 2026

## Kurzantwort: Warum dauert das?

Die Aufgabe besteht nicht aus dem Eintragen von rund 500 Namen. Im gesicherten Bestand stehen 542 Mannayan-Produktzeilen, 436 vorhandene Wiki-Artikel und nur zwei bestehende Produktverknüpfungen. Eine Produktzeile ist daher noch kein medizinisch nutzbarer Wissensdatensatz.

Für jedes Mittel müssen getrennt und nachvollziehbar bleiben:

1. Hersteller, Produktfamilie und konkrete Variante.
2. Aktuelle Rezeptur, Packungsgröße, Kennung und Gültigkeitszeitraum.
3. Einzelne Inhaltsstoffe und Mengen statt eines Sammeltexts.
4. Herstellerangaben, traditionelle beziehungsweise praktische Erfahrung und unabhängige Evidenz.
5. Anwendungshinweise getrennt von einer medizinischen Dosierungsfreigabe.
6. Kontraindikationen, Wechselwirkungen, Schwangerschaft, Stillzeit, Kinder, Organfunktion und Monitoring.
7. Quellen, Versionsstand, Prüfer und unveränderliche Revision.

Schon ein Nahrungsergänzungsmittel kann deshalb mehrere Dutzend atomare Aussagen erzeugen. Bei `BASIS MULTI+` waren es 45. Für 542 Produkte sind das nicht 542, sondern mehrere Tausend getrennt prüfbare Aussagen. Automatisches Übernehmen wäre zwar schnell, würde aber unklare Herstellertexte, alte Rezepturen und unvollständige Sicherheitsangaben direkt als scheinbar geprüfte Praxisinformation darstellen. Das ist genau der Fehler, den die Datenbank verhindern soll.

Die letzten zwei Wochen waren außerdem keine zwei durchgängigen Wochen ausschließlich für die Produktprüfung. Parallel liefen Sicherung und Restore der Wiki, die getestete Phase-1-Struktur, Sicherheitsblöcke, Steuerunterlagen sowie Sorra-Control-Arbeit. Die vorhandene technische Grundlage ist dabei nicht verloren: Phase 0 stellte 436 Wiki-Zeilen und 542 Produktzeilen vollständig und feldgleich wieder her; Phase 1 liegt lokal und auf GitHub getestet vor. Die Remote-Migration bleibt bewusst gesperrt, bis sie ausdrücklich freigegeben wird.

## Aktueller überprüfter Stand

| Bereich | Stand |
|---|---:|
| Wiki-Artikel im geprüften Export | 436 |
| Mannayan-Produktzeilen im geprüften Export | 542 |
| Bestehende Produktverknüpfungen | 2 |
| Vollständig getestete Wiki-Phase-1-Kernschema-Tests | 239/239 |
| Live-Migration / Wiki-Schreibzugriff | gesperrt |
| B1-Produktblock in Arbeit | Mannayan BETA+ mit Lutein |

## Arbeitsmodus ab jetzt

1. Zuerst Herstelleridentität und aktuelle Rezeptur rein lesend sichern.
2. Jede überprüfte Aussage bleibt `blocked_read_only`, bis Quelle, Fachbewertung und Sicherheitskontext getrennt vorliegen.
3. Herstellerangaben werden erhalten, aber nicht als unabhängiger Wirksamkeitsbeleg behandelt.
4. Keine Dosierung, Bewertung oder Freigabe wird automatisch erzeugt.
5. Nach jedem kohärenten Block folgen Strukturprüfung, SHA-256-Sicherung sowie ein gezielter Commit. Fremde Arbeitskopie-Änderungen bleiben unberührt.

## Nächster konkreter Block

`Mannayan BETA+ mit Lutein` wird als B1-Quelleninventur dokumentiert. Der Block erfasst Identität, 11 deklarierte Pflanzenstoffe, Verzehrempfehlung, Pflichtwarnungen und offene Sicherheitsfragen. Er verbindet weder Quellen noch Aussagen mit der Live-Datenbank und gibt keine Anwendung frei.

## Was eine verlässliche Fertigstellung bedeutet

Die technische Datenbankgrundlage kann vor dem vollständigen Quellenbestand fertig sein. Eine medizinisch freigabefähige Abdeckung aller 542 Produkte ist ein deutlich größerer fachlicher Prüfauftrag. Der Status darf diese beiden Ziele nicht vermischen: Eine fertige Katalogzeile ist nicht automatisch eine freigegebene Therapieverbindung.
