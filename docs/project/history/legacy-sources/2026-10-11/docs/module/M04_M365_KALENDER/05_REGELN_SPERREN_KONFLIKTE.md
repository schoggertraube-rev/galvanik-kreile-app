<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 05 — Regeln, Sperren und Konflikte

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| M04-Route/Nav bis Provider-E2E unsichtbar; nur „Microsoft 365 – In Klärung“ nicht klickbar | Fake-/Legacy-Providerbehauptung | UI/Server | D-UI-CORE-002; OE-2609-04; Anleitung §6 | SPEZ; aktueller Repozustand durch Q-M04-011 erneut zu validieren |
| Nur kanonischer Hosttermin mit Domain-Receipt/Readback | Outlook als Fachwahrheit | Server | candidate.3 V2 | GEBAUT off-repo |
| Scope-/Tenantvergleich an jedem Port | Cross-Tenant-Zugriff | Server/DB | Handshake; Contracts | GEBAUT off-repo, DB FEHLT |
| Delegierte, verifizierte Identitätsbindung | falscher Tenant/Benutzer und app-only | Server | Mission; Graph-Protokoll | GEBAUT Vertrag, Host FEHLT |
| Atomare Intent-/Operation-/Receipt-Annahme | akzeptierter Auftrag ohne Wiederaufnahme | Server/DB | candidate.3 | GEBAUT Vertrag, DB FEHLT |
| Idempotency-Key + Intent-Hash + Mapping | Doppeltermine bei Replay | Server/DB | candidate.3 | GEBAUT off-repo |
| `UNKNOWN` vor Retry zwingt Readback/Reconcile | Doppel-Schreiben nach Timeout | Server | candidate.3 | GEBAUT off-repo |
| Optimistic Revision + Lease/Fencing | parallele Worker und veraltete Revision | Server/DB | candidate.3 | GEBAUT Vertrag, DB FEHLT |
| Content-Policy-Referenz und -Hash | freie oder nicht von OE-2609-19 freigegebene Outlook-Inhalte | Server | OE-2609-19; candidate.3 | GEBAUT Vertrag; Kreile-Detailfelder/App-Links noch zu ergänzen |
| Betriebs-/Abwesenheitssignale sind read-only | externe Änderung überschreibt App | Server | OE-2609-19; candidate.3 | GEBAUT off-repo |
| Kreile-Link verlangt Tenantprüfung sowie Domain-Receipt/Readback | ungeprüfte oder fremde Verknüpfung | Server/DB | OE-2609-19; candidate.3 | GEBAUT Vertrag, Host FEHLT |
| Webhook-Request darf nur durable queuen | verlorene Benachrichtigung oder fachliche Verarbeitung im Request | Server/DB | PL-Entscheidung Hintergrund-Jobs 2026-09-26 | SPEZ; Vercel-Route/Outbox FEHLT |
| Supabase-Cron-Job nur mit Job-/Outbox-Receipt und Lease | Verlust oder Doppelverarbeitung beim Neustart | Server/DB | PL-Entscheidung Hintergrund-Jobs 2026-09-26; candidate.3 | SPEZ; DB/Worker FEHLT |
| Adminrecht für Connect/Re-Consent | unautorisierte Provideradministration | UI/Server | OE-2609-09 | SPEZ |
| Keine Secrets in Payload, UI, Receipt oder Telemetrie | Token-/Secretabfluss | UI/Server | AGENTS; candidate.3 Redaction | GEBAUT Vertrag, Runtime FEHLT |
| Keine Teiladoption | Schattenpfad ohne Beweiskette | Gate/Server/DB | Plan v1.1; Handshake | SPEZ |
| Legacy `calendar_events` nicht als M04-Wahrheit | zweite Terminwahrheit | Review/Server/DB | A-M04-033 | SPEZ |

## 2. Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M04-001 | Quellrevision ändert sich während Projektion | gespeicherte Revision ≠ aktueller Domain-Readback | Rolf; Phillip nur bei seinem Fachobjekt | Startseite oben › Handlungsbedarf | alte Operation sicher abschließen, neueste Revision separat projizieren | GEBAUT Kernel / FEHLT Anzeige |
| K-M04-002 | Provider-Ausgang nach Versand unbekannt | Timeout/Abbruch → `OUTCOME_UNKNOWN` | Rolf fachlich, Gregor technisch | Startseite oben › Handlungsbedarf; Gregor › Einstellungen | unabhängiger Readback, dann bestätigen/retryen/reviewen | GEBAUT Kernel / FEHLT Anzeige |
| K-M04-003 | Providertermin weicht vom Intent ab | Readback-Hash/Version passt nicht | Rolf | Startseite oben › Konflikte | App-Wahrheit prüfen und bewussten Reconcile starten; nie rückimportieren | GEBAUT Kernel / FEHLT Anzeige |
| K-M04-004 | Delegierte Anmeldung läuft ab, ist entzogen oder falsch | Identity-Port meldet bevorstehenden Ablauf, Reauth, Denied oder Disabled | Gregor | Gregors Startseite oben › dringende Warnungen; Gregor › Einstellungen › Verbindungen | Erneuerungsjob prüfen und freigegebenen delegierten Re-Consent durchführen | SPEZ; Runtime FEHLT |
| K-M04-005 | Graph-Abonnement läuft ab oder ist abgelaufen, Webhook nicht queued oder Delta-Lücke | Ablauf, Lifecycle Notification, fehlendes Queue-Receipt, ungültiger Cursor | Gregor | Gregors Startseite oben › dringende Warnungen; Gregor › Einstellungen › Verbindungen | Queue/Graph-Abonnement prüfen und kontrollierten Delta-/Vollabgleich im Policy-Fenster durchführen | GEBAUT Vertrag / Queue und Adapter FEHLT |
| K-M04-006 | Read-only Betriebstermin oder Abwesenheit hat kein eindeutiges Kreile-Objekt | kein Link oder mehrere Kandidaten | Rolf; Phillip nur bei seinem Fachobjekt | Startseite oben › Handlungsbedarf | manuell zulässiges Kreile-Objekt wählen oder Signal unverbunden lassen | GEBAUT Vertrag / UI FEHLT |
| K-M04-007 | Signal ist bereits anders verknüpft | bestehender Hostlink widerspricht neuer Wahl | Rolf | Startseite oben › Konflikte | bewusste Hostentscheidung mit neuem Receipt/Readback; keine Provideränderung | GEBAUT Vertrag / Host FEHLT |
| K-M04-009 | Auftragstermin kollidiert potenziell mit Kapazität, Priorität, Betriebstermin oder anstehender Abwesenheit | Regel aus G09/erzeugendem Modul plus read-only Kalenderinformation | Rolf; Phillip nach Fachzuständigkeit | Startseite oben › Konflikte; Abwesenheit zusätzlich im Tagesüberblick | ausschließlich im Kreile-Quellmodul entscheiden; M04 zeigt/projiziert nur das Ergebnis | FEHLT in G09; M04 entscheidet nie |
| K-M04-010 | Kreile-App-Registrierung, Büropostfach-Identität oder Consent ist nicht eindeutig freigegeben | Ressourceninventar ist unvollständig oder nicht Kreile-eigen | Gregor | Gregor › Einstellungen › Verbindungen | Kreile-Ressource schriftlich bestätigen, erst dann Hauptkalender verbinden | FEHLT → Q-M04-001/005/014 |
