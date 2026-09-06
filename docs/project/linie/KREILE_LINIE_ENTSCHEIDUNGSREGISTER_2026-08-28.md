# KREILE — DIE LINIE · Kanonisches Entscheidungsregister & Bauplan-Verfassung · 2026-08-28

**Zweck:** Genau EINE Wahrheit für alle Entscheidungen (Owner-Chat, Design-Chats, Projektleitung, Reviews). Widerspruchsfrei, datiert, mit Quelle und Status. Dies ist die *Linie*. Die PL-Bibel muss deckungsgleich sein; bei Divergenz gilt DIESES Register, die Bibel wird nachgezogen.
**Ablage:** `Kreile app\` (Owner-Ordner, kanonisch für PL-Inventar).

---

## 0 — VERFASSUNGSPRINZIP (über allem)

1. **Ein Bauplan/Bauvertrag ist wörtliches Gesetz. Er wird NIE interpretiert.** Jede Unklarheit ist KEIN Freiraum zum Improvisieren, sondern ein **Stopp**: Status `BLOCKED_PRODUCT_DECISION`, Frage an Owner+Orchestrator, Beschluss landet HIER — **dann erst** wird gebaut.
2. **Kein Silent-Interpret.** Writer/PL füllen fehlende Spezifikation NIE durch Annahme. Verboten: „nur mechanisch", „letzter Fix", Test an den Code anpassen, Erwartungswerte bis-grün biegen (false-green).
3. **Eine Linie.** Nichts Mündliches oder Verstreutes zählt. Gültig ist nur, was hier eingetragen ist. Design-Chat-Ergebnisse werden erst gültig, wenn sie hier stehen. Bei Konflikt gilt der neueste hier datierte Beschluss.

---

## 1 — GOVERNANCE / PROZESS (ratifiziert)

- Genau **EIN Writer**; **PR statt Push**; **kein Mock** im Produkt-/Abnahmepfad (Design-Demodaten wie Mustermann/300 SL nie als Daten); keine Remote-DB/RLS/Production ohne Owner-Freigabe; **Statusvokabular** nur `PASS / FAIL_INTERNAL / BLOCKED_EXTERNAL_PERMISSION / BLOCKED_PRODUCT_DECISION / BLOCKED_CAPABILITY_ADAPTER_MISSING`; Repo-Wahrheit nur via GitHub-Connector; Credentials nie in Chats.
- **A1 — Reparatur-Cap (NEU 2026-08-28):** gleiche Datei ODER gleiche fehlschlagende Assertion-Gruppe = **gleicher Fehler**. Max **2 Versuche**, dann **Pflicht: schriftlicher Root-Cause** vor jedem weiteren Versuch. Keine Per-Versuch-Owner-Freigabe (Owner ist kein Retry-Knopf).
- **A2 — Spec-first (NEU):** je Paket enumerierte, testbare **Soll-Aussagen** (DoD-Testspezifikation), von Owner+Orchestrator freigegeben, **BEVOR** gebaut wird. Tests werden gegen die Spec geschrieben, nie an den Code angepasst.
- **A3 — Gate-Determinismus (NEU):** Abnahme-Gate reproduzierbar in CI mit frischer DB, **nicht** abhängig vom lokalen Maschinenzustand (`index.lock`-ACL, „Rahmenfehler" = Umgebungs-Flakiness, nicht Testfehler). „Grün/rot" maschinell eindeutig.
- **A4 — Ehrliche Statuspflicht (NEU):** ab dem 2. Fehlversuch Statuswechsel `FAIL_INTERNAL` + Root-Cause, nie „letzter mechanischer Fix".
- Gate-Stufen (PL): FUNCTIONAL_SLICE_PASS / DATA_TRUTH_PASS / UI_REFERENCE_PASS / OWNER_UX_PASS / PRODUCT_READY. Merge nur bei ALLEN Gates + voll im ratifizierten Scope; OWNER_UX_PASS bleibt offen bis Nutzer-Abnahme.

---

## 2 — ARCHITEKTUR & PRODUKT (ratifiziert)

- **D-USP-001** — Entlastung ist oberstes Leitprinzip. App = „smarter bester Mitarbeiter", der den Nutzer vollständig entlastet. 5-Punkte-Check an JEDEM Entwurf.
- **D-ARCH-010** — **Galvanik = EIN Step. Keine Bäder, keine internen Stationen — nirgends.** Alles in Galvanik = „in Bearbeitung". Einzige interne Schritte: Mehrarbeit erfassen + fertig markieren.
- **D-ARCH-002** — Zwei Achsen: Ort ≠ Abrechnung.
- **D-F12-003** — Rollen `buero | werkstatt | meister | admin`.
- **D-F13-001** — Mehrarbeit-Katalog, historisierter Stundensatz, Freeze bei `fertig`.
- **D-F15-001** — Zahlungs-Gate je Modus (Vorkasse / Abholung / Rechnung).
- **Startseite = wichtigstes Kontrollinstrument:** Kontrolle, Termintreue, Organisation, Bündelung (z. B. Zink), Terminplanung — damit Aufträge in realistischer Zeit ohne Engpässe zu Geld werden.
- **Geld-Auslagerung:** Geld/Zahlen-Bereiche später an Buchhaltung/Analyse anschließen (nicht in den frühen Startseiten).

---

## 3 — F1.4 UNVERÄNDERLICHE RECHNUNG (Bauvertrag ratifiziert)

`F1_4_V1_RATIFIED=YES · INVOICE_TRUTH=EVOLVE_PUBLIC_INVOICES · INVOICE_EVOLUTION=ADDITIVE_BACKWARD_COMPATIBLE · VAT_RULE=STANDARD_19_PERCENT_ONLY · SERVICE_DATE_RULE=FINAL_F1_3_FREEZE_DATE · PDF_SCOPE=DOWNLOAD_ONLY_2026_TRANSITION · MASTER_DATA_SOURCE=EXISTING_COMPANY_SETTINGS_NOT_GIT · INVOICE_CREATION=FAIL_CLOSED_UNTIL_MASTER_DATA_COMPLETE · PAYMENT_TERM_DAYS=14 · NUMMERNKREIS=R-JJJJ-NNNN_luekenlos_pro_Jahr · KORREKTUR=STORNO_PLUS_NEUAUSSTELLUNG · EINVOICE_STRATEGY=OPEN_DECIDE_BEFORE_WIDER_ROLLOUT`
Detailvertrag: `KREILE_F1_4_BAUVERTRAG_UNVERAENDERLICHE_RECHNUNG_V1_2026-08-21.md` (V1.1, EVOLVE-Korrektur). **HINWEIS: liegt aktuell NICHT im Ordner `Kreile app\` — nachlegen (Konsolidierung §10).**

---

## 4 — F1.5 ZAHLUNGSEINGANG & WARENAUSGANG (vorbereitet)

Vertrag liegt: `KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1_2026-08-21.md`. **Bau erst nach F1.4-Merge — Ratifikation + Start = Owner-Grenze.**

---

## 5 — FRONTEND-UMSETZUNG (Parallel-Paket, ratifiziert „jetzt")

Bestehendes Designsystem konsolidieren statt forken; echte F1.2/F1.3-Ports, kein Mock; Phase 0 Inventar → Phase 1 EIN Proof-Screen (Phillip Werkstatt) → Rest OTC-Pfad. Paket: `KREILE_UEBERGABE_FRONTEND_UMSETZUNG_V1_2026-08-21.md`. Rolf-Routen-Konsolidierung & baeder-Disposition sind **nicht mehr PL-Ermessen** — Owner-entschieden (§7 #6/#7): eine Startseite pro Login, `baeder` entfällt.

---

## 6 — UI-REFERENZEN (eingefroren, GÜLTIG/FINAL)

Rolf V8 · Phillip V4 · Auftragskarte MACHART_V8 · Kundenkarte MACHART_V2. HTML-Selbstläufer; Demo-Daten nie als Produktdaten.
**Speicherort (2026-09-06 aktualisiert):** Die vier Referenzen liegen **auf der Platte, im Repo eingefroren:** `docs/project/linie/ui/` (`KREILE_STARTSEITE_ROLF_V8_2026-08-20.html`, `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html`, `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html`, `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html`). Index: `ui/00_UI_REFERENZ_KANONISCH.md`. Der frühere Verweis auf Claude-Artefakt-URLs bzw. den externen Ordner `design und klickpfade UI\` ist damit erledigt. Freeze auf Disk = erfüllt.

---

## 7 — ENTSCHEIDUNGSREGISTER (chronologisch, mit Status)

- **#1 [ENTSCHIEDEN 2026-08-28]** — 4. Reparaturschleife F1.4-Testdatei: **Kein Blindpatch. Zuerst belegter Root-Cause** (warum 3 Runden nicht konvergierten; prüft der Test das Richtige oder wird er bis-grün gebogen; Beleg dass Restfehler rein Test-Harness). Erst danach gemeinsame Entscheidung über eine eng begrenzte, wirklich letzte Korrektur. *(Owner-Chat)*
- **#2 [ENTSCHIEDEN 2026-09-06, Owner]** — **B1 Auftrags-Identität = Rechnungsnummer `R-JJJJ-NNNN`.** Kein zweiter fachlicher Nummernkreis („sonst läuft eine Nummer parallel"). Die interne append-only Event-ID bleibt rein technisch und nicht nutzer-sichtbar.
- **#3 [ENTSCHIEDEN 2026-09-06 — Regel steht, vgl. #1-FINAL]** — **B2 Katalog-ID-Klassifikation:** Die Gruppierung im Rechnungs-Snapshot folgt der **echten Produktsemantik der Preisliste**, nicht willkürlich: fachlich zusammengehörende Positionen = `coupled` (eine Gruppe), sonst `isolated`. Das ist keine freie Owner-Wahl — die konkrete Klassifikation je Position (z. B. Pos. 42) wird bei der Umsetzung **gegen den echten Katalog belegt** (Beleg-Pflicht), nicht geraten.
- **#4 [ENTSCHIEDEN 2026-09-06, Owner]** — **B3 Nummernvergabe = bei Annahme (Wareneingang).** Die Nummer entsteht bei der Auftragsannahme und ist zugleich die spätere Rechnungsnummer (#2). ⚠️ Umsetzungsregel: Rechnungsnummern müssen lückenlos bleiben (GoBD) — Storno/Nicht-Rechnungs-Fälle vor Rechnung so behandeln, dass keine Lücke im Rechnungsnummernkreis entsteht (bindet F1.4/F1.5).
- **#5 [ENTSCHIEDEN 2026-09-06, Owner]** — **Skonto = JA, Satz = 2 % bei Zahlung ≤ 10 Tage, sonst netto 30 Tage** („wie in jeder Firma", Standard). Prozentsatz und Frist sind ein Konfig-Parameter — jederzeit per Owner-Wort änderbar, keine Architekturfrage.
- **#6 [ENTSCHIEDEN 2026-09-06, Owner]** — **Galvanik statt Bäder.** Galvanik = EINE Blackbox-Stufe (angenommen→galvanik→fertig→abgeholt); `baeder`-Route entfällt (löschen); kein Stations-/Bäder-Innenleben. „Badpflege" (einziger Bäder-Kontext) ist derzeit NICHT im Scope; falls gewünscht, eigenes Modul per neuer Owner-Entscheidung.
- **#7 [ENTSCHIEDEN 2026-09-06, Owner]** — **Genau EINE Startseite pro Login, personalisiert.** Keine drei konkurrierenden Start-Routen: today/start/cockpit werden auf eine konsolidiert, die anderen entfallen. Jede Rolle sieht nach Login IHRE personalisierte Startseite; das linke Menü ist für alle frei klickbar. Admin: App-Einstellungen als Startseite. Festgenagelt.
- **#8 [ENTSCHIEDEN 2026-09-06, Owner]** — **Kill-Liste freigegeben:** die ENTFÄLLT-Routen der Modulkarte, die reiner Mock / nicht verwertbar sind, werden gelöscht (S2). `archive` und `feedback` vorher kurz auf Verwertbarkeit prüfen; wenn reiner Mock, ebenfalls löschen. „Sauber = weg, was man nicht verwerten kann."
- **Künftige Owner-Grenzen** (bei Bedarf hier eintragen): E-Rechnungs-Strategie · F1.5-Baustart · F1.6/Pilot · Echtdatenfreigabe · „zugewiesen an"-Delegationsmodell · UI-Gerätetest→Freeze · neue Tabellen/Provider/Credentials.

---

## 8 — BETRIEBSREGELN (aus diesem Chat)

- **kreileapp ≠ lerniselapp:** Es gibt zwei getrennte Projektleiter-Chats. Lerniselapp läuft **bewusst parallel** und ist ein FREMDES Projekt — nie mit Kreile vermischen, nie in Kreile-Bewertung einrechnen.
- **Überwachung schlank/billig**, zum Denken fable5.
- **PowerShell** erlaubt für Prozess-Hygiene/Lese-Checks (hängende Prozesse beenden, Rechner handlungsfähig halten) — **NIE Repo/Code** (das bleibt der eine Writer).
- **Relais-Vorsicht:** `computer_type` fügt über einen Clipboard-Fehler veralteten Text ein → heikle/lange Weiterleitungen nicht blind tippen; nach dem Tippen zoom-verifizieren; im Zweifel gibt der Orchestrator dem Owner den exakten Wortlaut zum Selbst-Einfügen.

---

## 9 — PFLEGE DER LINIE

Jede neue Entscheidung — egal aus welchem Chat — wird **hier** eingetragen (Datum, Quelle, Status) und dann in die PL-Bibel gespiegelt. Bibel und Linie müssen deckungsgleich sein; bei Divergenz gilt die Linie, die Bibel wird nachgezogen. Ein Bauplan, der eine hier offene Frage berührt, wird NICHT gebaut, bis die Frage hier entschieden ist.

---

## 10 — ABLAGE-STATUS (WICHTIG — Konsolidierung offen)

**Befund 2026-08-28 (Disk-verifiziert):** Baupläne/Specs/Entscheidungen liegen verstreut über **mindestens drei Ordner** plus Bibel-Zip plus Cloud-Workspace plus PL-Bibel:
- `Kreile app\` — die aktuellen Orchestrator-Steuerdokumente (Mandat, Frontend-Übergabe, F1.5, Pathfinder, **diese Linie**). **= KANONISCHER ORDNER (PL-Inventar).**
- `ui oberfläche app\` — großer Screenshot-/Mockup-/HTML-Fundus (historisch, viele Iterationen).
- `KREILE_App_Website_Specs\` — viele Specs + **mehrere alte/versionierte Baupläne** (BUILD_PLAN_Galvanik_Kreile_v1, ANTIGRAVITY_BUILDBRIEF, Website v1/v2/v3, revenue_intelligence v1/v2/v3 …).
- `KREILE_BUSINESS_BIBEL_V0_1_2026-07-07.zip` — alte Bibel.

**Regel (ab jetzt):** Quelle der Wahrheit ist **nur**, was in DIESER Linie steht bzw. hier verlinkt ist. Alles in den anderen Ordnern ist **historisch/Archiv** und **kein Bauplan-Input**, bis es hier ausdrücklich promotet wird. So kann kein alter/konkurrierender Bauplan „interpretiert" werden.

**Offene Owner-Entscheidung (Konsolidierung):** (a) `Kreile app\` als einzigen kanonischen Ordner bestätigen; (b) die alten Bauplan-/Spec-Ordner als `_ARCHIV\` markieren (nicht löschen); (c) UI-Referenzen als Dateien exportieren (§6); (d) den bisherigen Pathfinder korrigieren. Bis diese Entscheidung fällt, gilt die Regel oben.

---
*Die Linie · 2026-08-28 · Owner + Orchestrator · Verfassungsprinzip: Ein Bauplan wird nie interpretiert. · Änderungen nur additiv mit Datum/Grund.*

---

## UPDATE 2026-08-28 (nachmittags) — Register #1 aufgelöst

**Root-Cause F1.4-Testdatei liegt vor (PL, ehrlich):** Ursache = **Test-/Coverage-Lücke**, KEIN bewiesener Produktfehler — der reale Command-Integrationstest fährt derzeit keine echte Extra-Work-/Katalogzeile; das alte grüne Gate band veraltete Migration-/Command-/Testhashes.

**Owner+Orchestrator-Entscheidung (#1 FINAL):** EINE letzte, vertraglich gebundene Testkorrektur freigegeben — exakt eine Datei (Prehash B3696823…/233135): nur Eventfälle in kollisionsfreie Reihenfolge; nur `catalogPositionId:42` von `isolated`→`coupled` **und nur wenn 42 nach echter Produktsemantik coupled ist (Beleg)**; KEINE Migration/Command/Werte/Erwartungen ändern. **ZUSÄTZLICH (Lücke schließen):** Integrationstest MUSS eine echte Extra-Work-/Katalogzeile fahren; Migration-Replay (frische DB) belegen; Pos.42-Klassifikation gegen echte Produktsemantik bestätigen. **HARTE STOP-REGEL:** jeder weitere Fehler danach = echter DB-/Produktbefund, ursachenklären — KEIN weiteres Testbiegen.

Dies konkretisiert die Fachfragen B1 (Eventreihenfolge) und B2 (Katalog-ID-Klassifikation, Pos.42) aus §7; endgültiger Abschluss nach sauberem Real-Gate-PASS.


---

## D-ARCH-008 — Path 1 Modulbauweise (Owner-Entscheid 2026-09-06)

**Kontext (P1-Architektur-Drift, belegt):** 02_app hat keine Modul-Einheit (Domäne über app+components+lib+features verschmiert); Modul-Manifest ~3 % (1 von ~30); Grenzen nur negativ/ratschenhaft und nur auf `lib/`; Tenant `'galvanik-kreile'` 65× in 23 Dateien (verletzt D-ARCH-007). „Später extrahieren" wird pro Woche teurer.

**Entscheid:** Es wird **Path 1** gebaut — forkbare Module sind echte Anforderung. Nähte werden JETZT gelegt, inkrementell, naht-zuerst; kein Neustart (korrekte Domänen-Logik bleibt). Verbindliche Bauanleitung: `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md`.

**Erzwungen (CI, nicht Prosa):** Modul = ein Ordner `src/modules/<fach>/` (ui+server+api+db+manifest+public.ts); Manifest je Modul; positive Fassade `public.ts`, Tiefimporte build-rot (dependency-cruiser); Tenant per Provider injiziert, Literal per Lint verboten; Cross-Modul nur über `v_*`-Views; UI = Phillip V4, Stationshome = FAIL.

**Reihenfolge:** S0 Tenant-Fix → S1 Gate → S2 Löschung toter Parallel-Routen → S3 Muster-Modul erfassung → S4 Home neu (V4) → S5 restliche Domänen. F1.5 bleibt geparkt bis S1.

**Nicht mehr fragen:** Ob modular gebaut wird (ja, Path 1). Ob das Stationshome gilt (nein, verworfen).


---

## D-ARCH-009 — Modulkarte / Scope-Kanon (Owner-Ratifizierung 2026-09-06)

Die Owner-Modulmindmap „Baustruktur Mini-USP" (Stand 15.08.2026) wird ratifiziert als verbindlicher Modul- und Scope-Kanon: `docs/project/linie/MODULKARTE_KANON.md`. Roter Faden INFOS REIN → KARTE → SUCHEN → RAUS; wenige, vollständige Module.

**KANON (einzige Module):** Fundament (gebaut), Suchleiste (F1.6, muss aus 00_BIBEL\_parallel herein), Intake (F1.1), Orders/Auftragskarte (F1.2/1.3), Customers/Kundenkarte (F1.3), Kalender (F1.6), Accounting-minimal (F1.4/1.5).
**QUARANTÄNE (nur Vertrag):** OCR, Galvanik-Innenleben, F2-Büro, DHL/Mollie/Mahnwesen.
**ENTFÄLLT (löschen):** Analyse/KPI-Cockpit, eigenständiges Buchhaltungs-Modul, Zeiterfassung, Teilfertigung, Kundenportal, eigenes Kalender-Produkt, Galvanik-Stufentracking, E-Mail/OCR/Bank-Eigenbau, Marketing.

**Folge:** „4 Mocks vs. 36 Routen" ist KEIN Baubarkeits-Problem — ~30 Routen sind ENTFÄLLT/QUARANTÄNE. Die Vorlagen reichen für die beabsichtigte App. Arbeit = Subtraktion + Path-1-Nähte + Suchleiste. `buchhaltung` (54 Dateien) auf Accounting-minimal trimmen. AMBIG (lager/lieferanten/items/telefonnotiz) = Owner-Entscheid vor Löschung, nicht raten.

**Nicht mehr fragen:** Was ein Modul ist, was es gibt, was entfällt.
