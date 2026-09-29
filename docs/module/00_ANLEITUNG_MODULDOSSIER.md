<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# ANLEITUNG — Moduldossier (verbindlicher Standard) · Galvanik-Kreile
**Version:** 1.1 · **Stand:** 2026-09-26 · **Herausgeber:** Cowork-PL · **Owner:** Siglinder · **geprüft:** unabhängiger Prüfer 2026-09-26 (Muss-Korrekturen eingearbeitet)
**Zweck:** Jedes Modul (und das Projekt selbst) bekommt einen Ordner mit **denselben** Dateien in **demselben** Format. Danach kann **ohne Rückfragen und ohne Raten** gebaut werden. Ein Dossier gilt erst als **BAUBEREIT**, wenn die Checkliste (Abschnitt 7) vollständig erfüllt ist.

---

## 1. Ablage und Schreibgrenzen (hart)
- **Staging (jetzt):** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\<ORDNER>\` — außerhalb des Repos.
- **Ziel (später):** `02_app/docs/module/<ORDNER>/` — Import **byte-identisch** durch den PL als **ein** Docs-PR, sobald git/GitHub wieder erreichbar ist.
- **Warum:** Der Bau-Runner arbeitet mit `git add -A` und `git clean -fdq` im Repo-Arbeitsbaum; es gibt **genau einen Writer im Repo**.
- **Technisch erzwungen:** Jeder Lauf startet mit `codex exec -s workspace-write -C <eigener Ordner>` (schreibbar ist nur der eigene Ordner). Nach jedem Lauf prüft das Startskript `git status` im Repo; jede Veränderung → **Alarm und Stopp** aller weiteren Läufe.
- Du schreibst **ausschließlich** in deinen Ordner. Nie in `02_app\`, nie in fremde Ordner oder Arbeitsordner.
- **Nie** Secrets/Schlüssel/Passwörter/Tokens schreiben (nur Secret-**Namen**). **Nie löschen** (Owner-Grenze) — Überholtes wird in `09_QUELLEN_AKTUALITAET.md` markiert.
- **Format:** UTF-8 ohne BOM; keine Mojibake (ä ö ü ß „ " – korrekt); Dateinamen nur ASCII; **Datum überall `JJJJ-MM-TT`** (z. B. `2026-09-26`), auch in Dateinamen.
- **IDs überall dreistellig:** `A-<KÜRZEL>-001`, `F-<KÜRZEL>-001`, `K-<KÜRZEL>-001`, `Q-<KÜRZEL>-001`, `T-<KÜRZEL>-001`.

## 2. Ordnerliste (verbindlich)
| Ordner | Inhalt | Stufe | Kontext-Quelle (Session · Arbeitsordner) |
|---|---|---|---|
| `00_PROJEKT` | Gesamtprojekt: Zielbild, Personen, End-to-End-Prozess, Geräte, Glossar, Modulindex | — | Cowork-PL |
| `G01_FUNDAMENT_RECHTE` | Login/PIN, Personen & Rechte, Admin-Rechteverwaltung, Tenant, Commands/Receipts/Readback, Audit | Grundstamm | PL 01a0ce4b · `02_app` |
| `G02_SHELL_STARTSEITEN` | Shell, Navigation nach Gerät, Startseiten Rolf/Phillip/Gregor, Handlungsbedarf/Konflikte je Zuständigkeit | Grundstamm | PL 01a0ce4b · `02_app` |
| `G03_ANLEGEN_INTAKE` | Globales „+", Anlegen Kunde/Auftrag/KV, Ware annehmen | Grundstamm | PL 01a0ce4b · `02_app` |
| `G04_AUFTRAEGE` | Auftragsliste, Auftragskarte V8, Lifecycle, Termine | Grundstamm | PL 01a0ce4b · `02_app` |
| `G05_KUNDEN` | Kundenliste, Kundenkarte V2, Telefonnotiz, Dubletten | Grundstamm | PL 01a0ce4b · `02_app` |
| `G06_KV_ANGEBOT` | KV/Angebot, Umwandlung in Auftrag | Grundstamm | PL 01a0ce4b · `02_app` |
| `G07_GELD_RECHNUNGEN` | Rechnung, Zahlung, Warenausgang, Storno, Export, E-Rechnung | Grundstamm | PL 01a0ce4b · `02_app` |
| `G08_SUCHE` | Suche V1, Kopfleiste, Rückwege/Backstack | Grundstamm | PL 01a0ce4b · `02_app/src/modules/suche` |
| `G09_KONFLIKTE_SPERREN` | Regelkatalog Sperren/Konflikte/Warnungen, Zuständigkeit, Anzeige | Grundstamm | PL 01a0ce4b · `02_app` |
| `G10_EINSTELLUNGEN` | Firmenstammdaten, Kataloge/Preise, Nummernkreise, Zahlungsregeln, Personen | Grundstamm | PL 01a0ce4b · `02_app` |
| `M01_BUCHHALTUNG` | Buchhaltungs-Kontrollzentrum (Mahnwesen, Export, Bank, Gutschrift, Belegeingang) | hinten angestellt | 01a0a938 · `Documents\Codex\2026-09-16\du` |
| `M02_ANALYSE` | Analyse / Entscheidungsunterstützung | hinten angestellt | 01a0abaa · `...\2026-09-16\kreile-analyse-runtime-kern` |
| `M03_UNTERNEHMENSFUEHRUNG` | Ziele, Entscheidungen, Wirkung | hinten angestellt | 01a0ab1c · `...\2026-09-16\unternehmensfuehrung-ziele-entscheidungen-wirkung` |
| `M04_M365_KALENDER` | Kalenderkern (V1/V2, K1–K8), Outlook-Projektion | hinten angestellt | 01a0aa99 · `...\2026-09-16\kreile-microsoft-365-integration` |
| `M05_M365_KOMMUNIKATION` | E-Mail/Telefon-Eingang (Communication Intake) | hinten angestellt | 01a0aa99 · dito |
| `M06_OCR` | Beleg-/Foto-Erkennung (Azure Document Intelligence) | hinten angestellt | 01a0b07f · `...\2026-09-13\wie-sieht-es-derzeit-aus-mit` |
| `M07_KI_SUCHE` | KI-Suche als Adapter über Suche V1 | hinten angestellt | 01a0b07f · dito |

## 3. Pflichtdateien je Ordner (12 + Bericht)
Jede Tabelle beginnt mit der angegebenen Kopfzeile; die **Beispielzeile** zeigt die verbindliche Schreibweise (im eigenen Dossier durch echte Zeilen ersetzen).

### `00_STECKBRIEF.md`
Pflichtfelder (je eine Zeile `**Feld:** Wert`): Zweck (2–3 Sätze) · Stufe (`Grundstamm` / `hinten angestellt`) · Dossier-Status (Abschnitt 8) · Modul-Status (Abschnitt 8) · zuständige Session · Arbeitsordner · Code-Pfad (`src/modules/<x>` oder off-repo-Kandidat + SHA-256 erste 12) · braucht (Module/Ports) · wird gebraucht von · Anbindungszeitpunkt + Gate · **Bis dahin im Grundstamm** (welches Element, Status `In Aufbau`/`In Klärung`, wörtlicher Text) · **Übertragbarkeit** (`Kern app-neutral: ja/nein` + Grund; keine Details anderer Zielapps) · Rate-Stellen aus Red-Team (Nummern, z. B. `RT-13, RT-14`) · Stand · Bearbeiter.

### `01_ANFORDERUNGSKATALOG.md`
`| ID | Anforderung (testbar, ein Satz) | Pflicht | Quelle | Abnahmekriterium | Stand |`
Beispiel: `| A-G07-001 | Eine ausgestellte Rechnung ist unveränderlich (Snapshot + PDF-Hash). | Muss | Register §3 F1.4; 00_BIBEL/KREILE_F1_4_BAUVERTRAG…md | Änderungsversuch an ausgestellter Rechnung wird abgewiesen, Hash unverändert. | GEBAUT |`
`Pflicht` ∈ {`Muss`, `Soll`}; `Stand` ∈ {`GEBAUT`, `SPEZ`, `GEPLANT`, `FEHLT`}. Nur belegte Anforderungen; ohne Quelle → `08`.

### `02_FUNKTIONEN_ABLAEUFE.md`
Je Funktion ein Abschnitt `### F-<KÜRZEL>-001 — <Name>` mit: Auslöser · Personen (Standard: **alle dürfen alles**; Admin kann je Person sperren/erweitern) · Schritte 1…n · Ergebnis + Receipt/Readback · Fehlerfälle · Sperren/Konflikte (Verweis auf `K-…`).
**Zustände-Tabelle (Pflicht, alle 7):** `| Zustand | Was sieht man | Wörtlicher Text | Quelle |` mit Zeilen `Daten`, `lädt`, `leer`, `Fehler`, `gesperrt`, `In Klärung`, `In Aufbau`.
Beispiel: `| leer | Liste ohne Einträge, Aktion „+ Auftrag" | „Noch keine Aufträge." | V5 #orders (Anker) |`
**Wörtlicher Text ist Pflicht.** Kein belegter Text → Feld `FEHLT → Q-<KÜRZEL>-00x` und Frage in `08`.

### `03_OPTIKVORLAGE.md`
- **Quelle:** Datei + SHA-256 + Abschnitt/Anker (Grundstamm: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`; Einzelmocks nur zur Kontrolle).
- `| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |` — Beispiel: `| Auftragskarte | ✓ | ✓ | ✓ | 5/7 | V5 #auftragskarte |`. Fehlt eine Variante → `fehlt → Designphase 1` (nicht erfinden).
- **Designsystem-Bausteine** (`kr-`): „wird nach Phase 1 ergänzt".
- **Module ohne Mock (M01–M07):** `Status: FEHLT → Designphase 1b` **plus Inhaltsliste je geplantem Screen:** `| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |`. So vollständig, dass die Designphase keine Frage hat.
- Verworfene Mocks nur in `09` als `VERWORFEN`.

### `04_SCHNITTSTELLEN_DATEN.md`
1. Angebotene Ports (`public.ts` / `server-public.ts`), 2. benötigte Host-Ports, 3. Events, 4. **Datenmodell-Feldliste:** `| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |` inkl. Soll-Ist-Abgleich mit vorhandenem Schema (`supabase/migrations`, `src/db/*.ts`), 5. `capability.manifest.json` / `INTEGRATION_HANDSHAKE.json` (Pfad + SHA), 6. **APIs/Provider:** `| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |`, 7. **Übertragbarkeit:** Kern frei von Kreile-Fachbegriffen, Kreile-Spezifisches nur im Kreile-HostAdapter; Anpassungen anderer Zielapps gehören nicht in dieses Dossier (Owner 2026-09-26).

### `05_REGELN_SPERREN_KONFLIKTE.md`
1. **Sperren (vorbeugend):** `| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |`
2. **Konflikte:** `| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |` — Beispiel: `| K-G07-001 | Warenausgang bei Vorkasse ohne Zahlung | Zahlungs-Gate | Rolf | Der Tag › Handlungsbedarf | Zahlung bestätigen | GEBAUT (Gate) / FEHLT (Anzeige) |`
3. Fehlt eine Regel → `08`.

### `06_ENTSCHEIDUNGEN.md`
Nur **Verweise**: `| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |`. Keine Registertexte kopieren.

### `07_ABNAHME_TESTS.md`
`| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |`

### `08_OFFENE_FRAGEN.md`
`| Q-ID | Frage | Optionen | Empfehlung | wer klärt (Owner/PL/Designphase) | bis dahin in der App | Status |`

### `09_QUELLEN_AKTUALITAET.md`
`| Pfad | Datum | SHA-256 (12) | Status | ersetzt durch |` — Status ∈ {`GÜLTIG`, `ÜBERHOLT`, `VERWORFEN`, `DUPLIKAT`}. Doppelte/widersprüchliche Dateien **müssen** hier stehen.

### `10_CHECKLISTE.md`
Abschnitt 7 übernehmen, jeden Punkt `✓`/`✗` + Begründung.

### `11_IST_CODE_UMBAU.md`
`| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |`
Pflicht für alle Module mit vorhandenem Code (insb. k1–k4 wurden mit Mock-CSS gebaut → „umbauen auf Designsystem"). Nur synthetische Bestandsdaten; Migrationsbedarf benennen, nicht ausführen. Kein Code vorhanden → Zeile „kein Code".

### `BERICHT_JJJJ-MM-TT.md`
Was angelegt/geprüft wurde, Lücken, offene Fragen. **Letzte Zeile exakt:** `DOSSIER-STATUS: BAUBEREIT` oder `DOSSIER-STATUS: NICHT_BAUBEREIT – <Grund>`.

## 4. Arbeitsablauf
1. **Inventar:** alle Dateien zum Modul (Arbeitsordner, Digest `C:\Users\Traube\AppData\Local\Temp\kreile_digest\<…>.md`, Kanon `02_app\docs\project\linie\`, Code — nur lesen). Strukturbild: Modul-Mindmap `..\00_PROJEKT\QUELLEN\KREILE_MODUL_MINDMAP_2026-08-15.pdf` + Gültigkeitsabgleich `..\00_PROJEKT\QUELLEN\00_QUELLENREGISTER.md` (ENTFÄLLT-Liste dort überholt).
2. **Aktualität:** je Datei Datum + SHA; neueste gültige Fassung bestimmen; Widersprüche nur notieren (→ `08`, `09`).
3. **Vollständigkeit:** gegen Abschnitt 3; Lücken → `08`.
4. **Schreiben:** Pflichtdateien, nur Belegtes.
5. **Selbstprüfung:** `10_CHECKLISTE.md`.
6. **Bericht.**
7. **Anhalten.** Kein Code, keine Commits, keine Provider-Aktionen.

## 5. Inhaltsregeln
- **Nichts erfinden.** Jede Aussage hat eine Quelle; sonst Frage mit Empfehlung.
- **Erst Vorwissen suchen, dann fragen (Owner 2026-09-26):** Viele Fragen wurden früher schon beantwortet. Vor jedem Eintrag in `08` zuerst suchen in: `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md`, `..\00_PROJEKT\QUELLEN\PRIOR_QUELLEN_EINDEUTIG.md` (frühere Specs: D-USP-001, User-Twins, Prozessablauf, Startseiten-Reviews, Add-on 10 Warn-Engine, Add-on 11 Rechte/Navigation, Problemregister, Werkstatt-Puls, Masterplan Klick-Prototyp), Digest des eigenen Chats, `00_BIBEL\_bibel_historie_2026-08\`, `_ARCHIV_2026-09-05_vor_LINIE\`. Frühere Antwort gefunden → als Anforderung übernehmen, Quelle „Vorwissen (Archiv), bestätigt durch Owner 2026-09-26" angeben; widerspricht sie neuerem Kanon → in `08` als Widerspruch mit beiden Fundstellen. Eine Frage in `08` braucht die Spalte-Ergänzung „gesucht in: …".
- **Owner-Entscheidungen 2026-09-25/26** (`..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md`) gelten verbindlich und gehen älteren Registertexten vor, soweit dort als „ersetzt/präzisiert" vermerkt.
- **Kanon geht vor:** DOCUMENT_AUTHORITY / D-GOV-001. Widerspruch Chat ↔ Kanon → in `08` + `09`, nicht selbst auflösen. Register: zwei abweichende Kopien (OP-01) — Repo-Kopie mit D-UI-V5-003 gilt; V6-Beschlüsse sind verworfen.
- **Keine Doppelungen:** Register, MODULKARTE, Mocks werden verlinkt, nicht kopiert.
- **Owner-Grundsätze:** Grundstamm zuerst · Module hinten angestellt, Anbindung erst nach Grundstamm-Fertigstellung + Modul-Abnahme, dann **ausgegrautes Element ersetzen** · jede Person hat ihre Startseite und Zugriff auf alles, außer der Admin sperrt/erweitert · Konflikte landen je Zuständigkeit auf der Startseite von Rolf bzw. Phillip · Zahlungsregel: Abholung ⇒ bar oder Karte, sonst ⇒ Vorkasse; Rechnung auf Ziel nur als Ausnahme je Kunde (Skonto/Zahlungsziel nur dort); Kartenterminal integriert (später, PaymentAdapter) · E-Rechnung (ZUGFeRD) vor Livegang im Grundstamm · `LIVE = NO_GO` bis Owner-Freigabe · nur synthetische Daten.
- **Designsystem:** Kreile-DS wird aus V5 abgeleitet (Fraunces + Inter, Navy/Cream, Touch 48 px, Präfix `kr-`). **Kein Mock-CSS kopieren**, keine eigenen Farbwerte.
- **Kreile ↔ Lerninsel strikt getrennt:** keine gemeinsamen Daten, Secrets, Ressourcen, Sessions. Kreile-Dossiers enthalten keine Anforderungen anderer Apps (Owner 2026-09-26: Kreile nicht mit Lerninsel vermischen).

## 6. Ausgrauen-Standard (verbindlich, Owner 2026-09-25)
- Gilt **nur für Elemente innerhalb gebauter Grundstamm-Screens** (Kachel, Karte, Tab, Knopf, Navigationseintrag), die eine später angebundene Funktion zeigen.
- Darstellung: gedämpft, **nicht klickbar**, **keine Route dahinter**, Titel der Funktion + Status-Text **„In Aufbau"** (Modul in Arbeit) oder **„In Klärung"** (Entscheidung offen). Keine Fake-Daten, keine Fehlermeldung.
- **Ganze Routen** hinten angestellter Module gibt es nicht: kein Navigationsziel, Direkt-URL fail-closed/404 (MODULKARTE Routendisposition).
- Hinweis: MODULKARTE verbietet „kommt bald"-**Flächen**; die Owner-Entscheidung „ausgrauen" (neuer) wird beim Kanon-Abgleich (OP-02) dort ergänzt. Bis dahin gilt diese Abgrenzung (Element ja, Fläche/Route nein).
- Optik liefert das Designsystem (`kr-`-Zustand „In Aufbau/In Klärung").

## 7. Checkliste Vollständigkeit (BAUBEREIT nur bei allen ✓)
1. Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen.
2. Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen-Nummern.
3. Jede Anforderung: Quelle + Abnahmekriterium + Stand.
4. Jede Funktion: alle 7 Zustände mit **wörtlichem Text** oder begründetem `FEHLT → Q-…`.
5. Optikvorlage: Quelle + SHA; drei Geräte je Screen oder „fehlt → Designphase"; M-Module: vollständige Inhaltsliste je Screen.
6. Schnittstellen: Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider + Secret-Namen + Stand.
7. Jeder Konflikt: Zuständigkeit + Anzeigeort.
8. Entscheidungen nur als Verweise mit Datum.
9. Quellen: Datum + SHA + Status; Duplikate/Widersprüche markiert.
10. Offene Fragen: Empfehlung + „bis dahin in der App".
11. IST-Code/Umbau für jeden vorhandenen Code-Bestandteil entschieden.
12. Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`.
13. **Build-Frage:** „Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten?" — ✓ nur, wenn jede offene Frage beantwortet oder als ausgegraut/`In Klärung` abgesichert ist.

## 8. Status-Vokabular
Dossier: `ENTWURF` · `NICHT_BAUBEREIT` · `BAUBEREIT` · `FREIGEGEBEN` (Owner).
Inhalt: `GEBAUT` · `SPEZ` · `GEPLANT` · `FEHLT` · `GÜLTIG` · `ÜBERHOLT` · `VERWORFEN` · `DUPLIKAT`.
Modul: `OFF_REPO_KANDIDAT` · `HINTEN_ANGESTELLT` · `ADOPTIERT` · `LIVE`.
App-Element: `aktiv` · `In Aufbau` · `In Klärung` · `Gesperrt`.

**Abgrenzung (PL 2026-09-26):** Der Dossier-Status bewertet nur das Dossier (§7). Externe Gates – Opus-Review eines Kandidaten, Designphase 1b, Owner-Gates (Microsoft/Azure/Kosten/Datenschutz), Kanon-Abgleich/git – gehören in den Modul-Status bzw. als offene Frage mit Zuständigkeit und Ausgrau-Zustand in `08`. So abgesichert verhindern sie `BAUBEREIT` nicht (§7 Punkt 13). Gebaut werden die betroffenen Teile erst nach Schließen des Gates.

## 9. Nach Abschluss
Unabhängiger Prüfer (Sonnet) prüft jedes Dossier gegen Abschnitt 7 **und** mit mindestens 5 Stichproben gegen die echten Dateien. Erst dann: Import nach `02_app/docs/module/` (ein Docs-PR), Aufnahme in Plan und Bau-Warteschlange. Module mit BAUBEREIT-Dossier dürfen **parallel off-repo** weitergebaut werden (max. 2 Läufe gleichzeitig); Anbindung an Kreile bleibt **seriell** per Owner-Transfergate.
