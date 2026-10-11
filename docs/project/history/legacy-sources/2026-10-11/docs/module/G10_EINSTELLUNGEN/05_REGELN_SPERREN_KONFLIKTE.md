<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 05 — Regeln, Sperren und Konflikte

## Unverrückbare Regeln

1. Der Server bestimmt Actor, Tenant und effektive Fähigkeit; Clientwerte dafür sind nie autoritativ.
2. G10 besitzt keine Kunden-, Auftrags-, Rechnungs-, Rechte-, Mehrarbeits- oder Providerwahrheit, sondern komponiert deren öffentliche Ports.
3. Jeder Write benötigt `expectedVersion` und `clientEventId` und liefert Audit, Receipt sowie kanonischen Readback; Wiederholung ist idempotent.
4. Bestehende Rechnungen, Snapshots und Hashes ändern sich durch neue Firmen- oder Zahlungsparameter niemals rückwirkend.
5. Zeitablauf allein löscht oder anonymisiert nichts. Aufbewahrungsaktionen benötigen einen Vorschlag und ausdrückliche Admin-Freigabe.
6. Terminal und Bank dürfen keine fachliche Erfolgsmeldung erzeugen. Zahlungsstatus wird ausschließlich durch G07 kanonisch.
7. `A-`- und `R-`-Nummern sind getrennt, serverseitig und in G10 read-only; interne Event-IDs sind keine Geschäftsnummern.
8. Postfachdaten, Secret-Werte und Einzelgehälter werden in G10 weder angezeigt noch gespeichert.

## Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Fehlende oder mehrdeutige Produktidentität | Öffnen oder Schreiben in G10 | UI/Server | `SettingsAppAdapter`; G01 | GEBAUT |
| Falscher Tenant / fremde Objekt-ID | Lesen und Ändern fremder Einstellungen | Server/DB | D-ARCH-009; RLS-/Negativtestpflicht | SPEZ |
| Fehlende effektive Fähigkeit | Bereich öffnen oder Command ausführen | UI/Server | OE-2609-09 | SPEZ |
| Nicht-Admin bei Firmen-, Rechte-, Retention-, Kosten- oder Kontostandswrite | betreffende Mutation | UI/Server/DB | OE-2609-09/20/24 | SPEZ |
| Nicht Admin/Rolf bei Zielrechnungs-Freigabe | Freigabe je Kunde | UI/Server/DB | OE-2609-11 | SPEZ |
| Veraltete `expectedVersion` | Lost update | Server/DB | Path-1-Commandvertrag | SPEZ |
| Wiederholte `clientEventId` | Doppelmutation | Server/DB | Path-1-Idempotenz | SPEZ |
| Keine oder mehrere `company_settings`-Zeilen | Rechnungserstellung | Server/DB | F1.4-Migration `seller_config_complete` | GEBAUT |
| Leeres Pflichtfeld in Firmen-/Bankdaten oder `invoice_payment_term_days=NULL` | Rechnungserstellung | UI/Server/DB | F1.4-Migration | GEBAUT |
| Fehlender finaler ZUGFeRD-Feldsatz/Validator | E-Rechnung und Live-Gate | UI/Server | OE-2609-14; Q-G10-004 | GEPLANT |
| Fehlende Kundenfreigabe „Rechnung auf Ziel“ | Modus Zielrechnung und dessen 2/10/14-Regel | UI/Server/DB | OE-2609-11; Q-G10-003 | SPEZ |
| Bereits eingefrorene Rechnung | rückwirkende Policy-/Firmendatenänderung | Server/DB | F1.4 Unveränderlichkeit | GEBAUT |
| Ungeklärter allgemeiner Katalogbesitz | Schreiben in `items`, `price_lines` oder `price_agreements` aus G10 | UI/Server | Register #3/#9; Q-G10-005 | SPEZ |
| Direkter Nummernkreis-Edit/Reset | manuelle Zähleränderung | UI/Server/DB | Register #2/#4; Q-G10-010 | SPEZ |
| Terminal ohne Owner-/M01-Gate oder reales Receipt | Provideraufruf und automatische Zahlungsbestätigung | UI/Server | OE-2609-12; Q-G10-009 | GEPLANT |
| Bank ohne Owner-Gate oder unbestätigter Vorschlag | kanonische Kosten-/Kontostandsmutation | UI/Server | OE-2609-24; Q-G10-009 | GEPLANT |
| Aufbewahrungsfrist nicht abgelaufen | Lösch-/Anonymisierungsvorschlag | Server | OE-2609-20 | SPEZ |
| Steuerliche Prüfung/Ablaufhemmung aktiv | Freigabe der Aufbewahrungsaktion | UI/Server/DB | OE-2609-20 | SPEZ |
| Kein Admin-Approval oder kein Fachcommand | Löschung/Anonymisierung | UI/Server/DB | OE-2609-20 | SPEZ |
| Objekt gehört zum Microsoft-Postfach | G10-Löschung/Anonymisierung | Server | OE-2609-20 | SPEZ |
| Fehlender Rhythmus/Fälligkeit/Warnschwelle | Kosten-/Kontostandseditor und Alterswarnung | UI/Server | Q-G10-008 | GEPLANT |
| Personenbezogene Gehaltsdetails | Anzeige oder Speicherung in G10 | UI/Server | OE-2609-24 | SPEZ |

## Konflikte

Konflikte für Rolf stehen im Startseiten-Bereich „Das braucht dich“, Konflikte für Phillip im Startseiten-Bereich „Heute sichern“. Für Gregor ist kein eigener Startseiten-Bereich belegt; ob G10 einen eigenen Admin-Bereich benötigt, bleibt bis Q-G10-011 „In Klärung“. Belege: `../G02_SHELL_STARTSEITEN/05_REGELN_SPERREN_KONFLIKTE.md` §2–3, `../G09_KONFLIKTE_SPERREN/05_REGELN_SPERREN_KONFLIKTE.md` K-G09-001–017, `02_app/docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` und `02_app/docs/project/linie/ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html`. „zuständig“ bezeichnet die Produktperson, nicht zwingend den technischen Actor der Korrektur.

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| C-G10-001 | Firmenstammdaten fehlen, sind doppelt oder für Rechnung unvollständig | F1.4-Vollständigkeitsreadback | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | genau eine Zeile herstellen, Pflichtfelder über Admin-Command ergänzen, Readback prüfen | SPEZ |
| C-G10-002 | ZUGFeRD-Ausstellerdaten/Validator fehlen | G07-E-Rechnungsvalidator geschlossen | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | Q-G10-004/OP-13 abschließen, Felder ergänzen, Real-Validator bestehen | GEPLANT |
| C-G10-003 | Zwei Admins ändern dieselbe Einstellung | `expectedVersion` stimmt nicht | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | neuesten Readback laden, Änderung bewusst erneut ausführen oder verwerfen | SPEZ |
| C-G10-004 | Persönliche Allow/Deny-Policy widerspricht altem Rollen-/Feature-Flag-Verhalten | effektive G01-Projektion weicht ab | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | G01 als einzige effektive Wahrheit herstellen; Altpfad nicht parallel schreiben | GEPLANT |
| C-G10-005 | Zielrechnung wird ohne Kundenfreigabe gewählt | G05-Port meldet `enabled=false/fehlt` | Rolf | Rolf-Startseite → „Das braucht dich“ | Freigabe im Kundenkontext durch Admin/Rolf erteilen oder Vorkasse/Abholung wählen | SPEZ |
| C-G10-006 | Zahlungsparameter ändern sich während Rechnungsvorbereitung | Policy-Version am Snapshot weicht ab | Rolf | Rolf-Startseite → „Das braucht dich“ | neuen Snapshot vor Erstellung bestätigen; bestehende Rechnung nie ändern | SPEZ |
| C-G10-007 | Mehrarbeitsposition oder Satz wurde parallel geändert | Extra-Work-Command liefert Versionskonflikt | Rolf | Rolf-Startseite → „Das braucht dich“ | aktuellen Katalog laden und Änderung fachlich neu bestätigen | GEBAUT |
| C-G10-008 | Doppelte/ungültige `A-`- oder `R-`-Nummer | Unique-/Allocatorfehler oder Sequenzprüfung | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | Ausgabe stoppen; besitzendes Modul/DB-Vertrag prüfen, niemals in G10 umnummerieren | SPEZ |
| C-G10-009 | Terminal ist beim kassierenden Warenausgang nicht erreichbar | echter Adapterstatus/Providerfehler | Phillip | Phillip-Startseite → `Heute sichern` | Zahlung manuell bestätigen; Providerfehler separat an Gregor, kein Auto-Erfolg | GEPLANT |
| C-G10-010 | Aufbewahrungsvorschlag trifft aktive Ablaufhemmung oder unklare Dokumentart | Policy-/Fachreadback | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | Vorschlag blockieren, Hemmung/Dokumentart prüfen, danach neu vorschlagen | GEPLANT |
| C-G10-011 | Kontostand überschreitet bestätigte Altersgrenze | `heute - asOf > X` | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | neuen manuellen Kontostand mit Stichtag erfassen; kein Bankwert erfinden | FEHLT → Q-G10-008 |
| C-G10-012 | Bankvorschlag weicht vom manuellen Kontrollwert ab | Vorschlagsvergleich nach späterem Bank-Gate | Gregor | eigener Admin-Bereich: FEHLT → Q-G10-011; bis dahin „In Klärung“ | Abweichung prüfen und Vorschlag bestätigen/ablehnen; manuellen Wert erhalten | GEPLANT |
