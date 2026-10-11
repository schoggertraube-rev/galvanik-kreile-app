<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Bericht Nacharbeit M04 Microsoft-365-Kalender — 2026-09-26

## Ergebnis

Die zwei Befunde der unabhängigen Sonnet-Prüfung vom 2026-09-26 sind quellengebunden nachgearbeitet. Der Steckbrief folgt jetzt der Pflichtform aus Anleitung §3. Die Outlook-Kopie eines betroffenen App-Datensatzes folgt einer freigegebenen Anonymisierung/Löschung, während andere Postfachinhalte unberührt bleiben. Ablaufende delegierte Anmeldung und Graph-Abonnements werden als überwachungs- und erneuerungspflichtig beschrieben; bei drohendem oder eingetretenem Ablauf ist die Warnung auf Gregors Startseite vorgeschrieben.

## Änderungsliste

| Datei | Stelle | alt → neu | Beleg |
|---|---|---|---|
| `00_STECKBRIEF.md` | Pflichtfelder | zweispaltige Feld/Wert-Tabelle und Feld „Red-Team-Treffer“ → inhaltsgleiche `**Feld:** Wert`-Zeilen und Feld „Rate-Stellen aus Red-Team“ | `..\00_ANLEITUNG_MODULDOSSIER.md` §3 |
| `01_ANFORDERUNGSKATALOG.md` | A-M04-041 | Microsoft-Postfach blieb bei App-Retention vollständig unverändert → die gemappte, von der App erzeugte Outlook-Kopie wird nach Admin-Freigabe ebenfalls anonymisiert/gelöscht; andere Postfachinhalte bleiben unberührt | `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` OE-2609-20; `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R3 |
| `01_ANFORDERUNGSKATALOG.md` | A-M04-043 | keine ausdrückliche Gesamtanforderung → Ablauf der delegierten Anmeldung und der Graph-Abonnements überwachen, soweit möglich per Hintergrundjob erneuern und Gregor auf seiner Startseite warnen | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R5 und §4 |
| `02_FUNKTIONEN_ABLAEUFE.md` | F-M04-006 | Subscription-/Delta-Betrieb ohne ausdrückliche Anmeldungsablauf- und Startseitenpflicht → Überwachung/Erneuerung beider Ablaufarten mit Receipt/Health und Warnung für Gregor | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R5 und §4 |
| `03_OPTIKVORLAGE.md` | S-M04-003, S-M04-005 | allgemeine M365-Warnung und Subscription-Ablauf → konkrete Daten für ablaufende delegierte Anmeldung und Graph-Abonnements auf Gregors Startseite und im Healthscreen | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R5 |
| `04_SCHNITTSTELLEN_DATEN.md` | Host-Ports/Provider | Identitätsstatus und generische Subscription-Jobs → Ablaufstatus sowie Überwachung/Erneuerung von delegierter Anmeldung und Graph-Abonnements über vorhandene Host-/Scheduler-Grenzen | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R5 und §4 |
| `05_REGELN_SPERREN_KONFLIKTE.md` | K-M04-004/005 | entzogen/falsch beziehungsweise generischer Subscription-Ablauf → drohender/erfolgter Ablauf mit Erneuerungsprüfung und ausdrücklicher Warnung auf Gregors Startseite | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R5 |
| `06_ENTSCHEIDUNGEN.md` | OE-2609-20; Red-Team R5 | pauschal „Postfach selbst unberührt“ und kein R5-Verweis → Abgrenzung der app-erzeugten Outlook-Kopie von anderen Postfachinhalten sowie eigener R5-Verweis | `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` OE-2609-20; `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R3/R5 |
| `07_ABNAHME_TESTS.md` | T-M04-031, T-M04-033 | Retention-Test ließ Outlook unverändert; kein gemeinsamer Ablauf-Warntest → Spiegelprüfung für App/Outlook-Kopie und E2E-Spezifikation für Erneuerungsjob/Receipt/Gregor-Warnung | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R3/R5 |
| `08_OFFENE_FRAGEN.md` | Q-M04-016 | Empfehlung „Microsoft-Postfach unberührt“ → Retention auf gemappte App-Outlook-Kopie ausdehnen und andere Postfachinhalte abgrenzen | `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` OE-2609-20; `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R3 |
| `09_QUELLEN_AKTUALITAET.md` | Quellenregister | Nacharbeitsauftrag und Gesamt-Red-Team nicht verzeichnet → beide echten Dateien mit Datum, SHA-256/12 und Status `GÜLTIG` ergänzt | `..\00_ANLEITUNG_MODULDOSSIER.md` §3/§7 Punkt 9; SHA-256-Prüfung dieses Laufs |
| `10_CHECKLISTE.md` | §7 Punkte 1–3, 5–8, 10, 12 und Selbstprüfungsgrenze | Stand vor Nacharbeit → 43 Anforderungen, R3/R5-Abdeckung, Nacharbeitsbericht und tatsächlich durchgeführte Prüfgrenze | `..\00_ANLEITUNG_MODULDOSSIER.md` §7/§8; geänderte Dossierdateien |

## Prüfgrenze dieses Laufs

Geprüft wurden die betroffenen Markdown-Inhalte, IDs, Pflichtfeldform und die quellengebundene Konsistenz von Anforderung, Ablauf, Optik, Schnittstelle, Konflikt, Entscheidung, Test und offener Retention-Frage. Es wurde kein Produktcode geändert, kein Provider-/Graph-Lauf ausgeführt und kein bestehender Produkt- oder E2E-Test als in diesem Lauf bestanden behauptet.

DOSSIER-STATUS: BAUBEREIT
