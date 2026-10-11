<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M06 – Dokument- und Informationserfassung (OCR)

**Zweck:** M06 sichert eingehende Dokumente und Informationen zuerst als unverändertes Original und erzeugt daraus optionale, quellennachweisbare Vorschläge. Ein Mensch prüft Fakten, Ziel und Wirkung; erst danach darf ein vorhandenes Fachkommando genau einmal ausgeführt und nachgelesen werden.

**Stufe:** hinten angestellt

**Dossier-Status:** BAUBEREIT

**Modul-Status:** HINTEN_ANGESTELLT

**zuständige Session:** 01a0b07f

**Arbeitsordner:** `C:/Users/Traube/Documents/Codex/2026-09-13/wie-sieht-es-derzeit-aus-mit`

**Code-Pfad:** off-repo-Kandidat `src/modules/dokumentenaufnahme/`; Code fehlt, daher noch kein Code-SHA-256

**braucht (Module/Ports):** `host.authorization-context`, `host.document-originals`, `host.document-processing-store`, `host.entity-candidate-read`, `host.capability-catalog`, `host.domain-command`, `host.receipt-readback`, `host.audit-telemetry`, serverseitigen `DocumentIntelligencePort`

**wird gebraucht von:** später G03 Anlegen/Intake, M01 Buchhaltung, M05 Kommunikation sowie G08 Suche/M07 KI-Suche ausschließlich über bestätigte, berechtigungsgefilterte Projektionen

**Anbindungszeitpunkt + Gate:** Modulkern gemäß OE-2609-17 parallel mit höchstens zwei Läufen und unter Beachtung der Abhängigkeit M06 vor M05; Kreile-Anbindung weiterhin seriell erst nach Owner-Abnahme des Grundstamms, freigegebenem Design 1b, Modulpass, unabhängigem Review, Manifest/Handshake und Owner-Transfergate

**Bis dahin im Grundstamm:** Element `Dokument / Info erfassen`; Status `In Klärung`; grau, nicht klickbar, ohne Route; wörtlicher Text `Datenschutz und Dokumentendienst werden noch geklärt.`

**Übertragbarkeit:** Kern app-neutral: ja – Aufnahme, Faktenledger, menschliche Bestätigung sowie Command/Receipt/Readback enthalten keine Kreile-Fachbegriffe; Kreile-spezifische Ports, Ressourcen und Regeln liegen ausschließlich im Kreile-HostAdapter.

**Rate-Stellen aus Red-Team:** RT-22, RT-23, RT-24, RT-31

**Stand:** 2026-09-26

**Bearbeiter:** Codex

| Feld | Festlegung |
|---|---|
| Dossier-Stand | 2026-09-26 |
| Dossier-Status | **BAUBEREIT** – alle Punkte aus Anleitung §7 sind erfüllt; externe Umsetzungs- und Governance-Gates sind in Datei 08 mit Zuständigkeit und sicherem App-Zustand abgesichert |
| Modulstatus | **HINTEN_ANGESTELLT**; Modulkern parallel nach OE-2609-17, Abhängigkeit M06 vor M05; Kreile-Anbindung seriell nach Grundstamm |
| Lieferwahrheit | `origin/main` des Repositorys `02_app`; aktuelle Git-Prüfung ist wegen `dubious ownership` durch PL zu klären (Q-M06-005), ohne den Dossierstatus zu blockieren |
| Produktname | WerkstattCockpit, Tenant `galvanik-kreile` |
| Arbeitsname | Dokument- und Informationserfassung; „OCR“ bezeichnet nur eine optionale Extraktionsstufe |
| Zielelement im Cockpit | Titel **„Dokument / Info erfassen“**, Status **„In Klärung“**, grau, nicht klickbar, ohne Route |
| Zielnutzer | Alle angemeldeten Kreile-Mitarbeiter; fachliche Konfliktentscheidung Rolf und Phillip; Admin nur für Administration |
| Zielgerät | Desktop und Werkstatt-Tablet; Kamera-/Dateiauswahl darf mobil ergänzt werden, ist aber kein eigener Produktpfad |
| Modulordner bei späterem Bau | geplant `src/modules/dokumentenaufnahme/` |
| Integrationsart | Path 1: gekapseltes Modul, öffentliche Ports, kein Direktimport fremder Interna |

## Zweck und Nutzenversprechen

M06 nimmt ein Foto, einen Scan, ein PDF oder eine unterstützte Office-Datei als **Original** auf, sichert dieses Original unverändert und lässt daraus anschließend optionale, quellennachweisbare Vorschläge ableiten. Ein Mitarbeiter prüft und korrigiert jeden fachlich wirksamen Wert, ordnet das Dokument eindeutig zu und bestätigt eine eventuell vorgeschlagene Aktion. Erst diese Bestätigung darf genau ein vorhandenes Fachkommando auslösen.

Das Modul ist damit keine „automatische Buchungs-KI“. Es verhindert Abtipparbeit, ohne aus einem unsicheren Modellresultat eine neue Produktwahrheit zu machen.

## Verbindliche Kurzform

1. Original unverändert und tenantgebunden sichern.
2. Strukturierte Quelle bevorzugen; OCR nur einsetzen, wenn die Information sonst nicht zuverlässig strukturiert vorliegt.
3. Extraktion als Vorschlag mit Quelle und Konfidenz anzeigen.
4. Jede erkannte Tatsache genau einem Zustand zuordnen: `ASSIGNED`, `REFERENCE_ONLY`, `CONFLICT` oder `UNASSIGNED`.
5. Werte ab 85 % dürfen visuell vorausgewählt werden; sie werden **nicht** automatisch gebucht, zugeordnet oder gespeichert.
6. Unter 85 % muss die App den einzelnen Wert sichtbar zur Prüfung markieren.
7. Ein Mensch bestätigt die geprüften Fakten und separat die Zuordnung beziehungsweise Aktion.
8. Ohne Providerfreigabe bleibt die Provideranalyse gesperrt; die manuelle Erfassung aus dem gesicherten Original bleibt der sichere Kernpfad.

## Umfang

### In M06

- Dokument-/Dateiauswahl und Übergabe an den bestehenden Originalspeicher-Port.
- Analyseauftrag, Provideradapter und expliziter manueller Pfad.
- Quellennachweis pro Fakt, Konfidenz, Konflikt und Vollständigkeitsprüfung.
- Prüfansicht mit Original und Feldern nebeneinander.
- Kandidaten für Kunde, Auftrag, Beleg oder ungeklärten Eingang.
- Auswahl eines serverseitig erlaubten Fachkommandos, Bestätigung, Receipt und Readback.
- Wiederaufnahme nach Abbruch sowie verständliche Fehler- und Sperrzustände.
- Audit- und Telemetrieereignisse ohne Dokumentinhalt oder Secret.

### Nicht in M06

- Eigene Kunden-, Auftrags-, Rechnungs- oder Buchhaltungswahrheit.
- Volltextsuche oder KI-Chat. Diese dürfen später ausschließlich bestätigte, berechtigungsgefilterte M06-Fakten über öffentliche Ports konsumieren.
- Automatische Buchung, automatische Kundenzuordnung oder autonome Folgeaktion.
- E-Mail-/Graph-Postfachabruf, Provideranlage, Azure-Konfiguration oder Secret-Verwaltung.
- Ersatz für vorhandene Foto-, Auftrags-, Buchhaltungs- oder Originalspeicherfunktionen.

## Ist-Zustand

- **FEHLT:** kein adoptiertes M06-Modul, kein Manifest und kein Integrations-Handshake.
- **GESPERRT:** `src/app/actions/ocr.actions.ts` und die Scan-Upload-Route liefern absichtlich `NOT_AVAILABLE`/503.
- **QUARANTÄNE:** alte Gemini-, Klippa-, Mock- und Simulationspfade; sie sind keine Produktfunktion.
- **TEILNACHWEIS:** Azure Document Intelligence wurde isoliert real getestet. Layout-Erkennung war stark, das Rechnungsmodell vertauschte bei einem atypischen UPS-Dokument Absender und Empfänger. Das ist kein Produktpass.
- **VORHANDENE BASIS:** `scan_uploads`, tenantbezogene Original-/Attachment-Pfade und Fail-closed-Routen existieren teilweise; Drizzle-Abbildung und Baseline sind jedoch nicht deckungsgleich.
- **OPTIK FEHLT:** kein freigegebenes, dediziertes M06-Mock; Designphase 1b ist Pflicht.

## Einbau- und Freigabegates

| Gate | Muss vorliegen | Bis dahin |
|---|---|---|
| G-M06-001 Design | dediziertes M06-Mock, alle Zustände und mobile Prüfung freigegeben | Cockpit-Element bleibt grau und nicht klickbar |
| G-M06-002 Modul | Manifest, Handshake, Tests und unabhängiger Review bestanden | keine Route im Grundstamm |
| G-M06-003 Provider | Owner-Freigabe zu Datenschutz/AVV, Region, Kosten, Netzwerk und Betrieb | nur manueller Pfad; Analyseknopf „In Klärung“ |
| G-M06-004 Adoption | Grundstamm-UX vom Owner abgenommen und Vorgängermodule seriell behandelt | Modul bleibt `OFF_REPO_KANDIDAT`/`HINTEN_ANGESTELLT` |
| G-M06-005 Produktivbetrieb | RLS-/Tenant-, Failure-, Kosten- und vertikaler E2E-Nachweis | kein Live-Traffic, keine Providerbehauptung |

## Builder-Einstieg nach Öffnung der jeweiligen Umsetzungsgates

Der PL klärt Q-M06-005/Q-M06-006 vor einer Repo-Mission mit einem git-fähigen Zugang. Diese externe Governance-Prüfung ändert die Bauspezifikation nicht. Der Builder arbeitet ohne fachliche Rückfrage in dieser Reihenfolge:

1. `05_REGELN_SPERREN_KONFLIKTE.md` als Sicherheitsvertrag lesen.
2. In Designphase 1b `03_OPTIKVORLAGE.md` umsetzen und freigeben lassen.
3. Das Modul ausschließlich hinter dem grauen Cockpit-Gate und mit manuellem Kernpfad bauen.
4. Daten- und Portverträge aus `04_SCHNITTSTELLEN_DATEN.md` verwenden; keine neue Tabelle und keinen neuen Provider erfinden.
5. Alle Tests aus `07_ABNAHME_TESTS.md` bestehen lassen.
6. Erst nach den genannten Gates den Integrationsstatus ändern. Provideraktivierung und Adoption sind getrennte Entscheidungen.

## Red-Team-Abdeckung

Für M06 einschlägig: `RT-22` (Zustände), `RT-23` (graue Elemente), `RT-24` (fehlende Moduloptik) und `RT-31` (Feld-Mapping/Absender-Empfänger). Die Auflösung steht in den Dateien 02, 03, 05 und 07.
