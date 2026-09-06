# KREILE — MODULKARTE (verbindlicher Scope & Modulschnitt)

Quelle: Owner-Modulmindmap „Baustruktur Mini-USP" (Stand 15.08.2026), ratifiziert 2026-09-06 als D-ARCH-009. Roter Faden: **INFOS REIN → LIEGT & WÄCHST (Karte) → SUCHEN & AUSKUNFT → RAUS.** Wenige Module, aber vollständig; alles andere entfällt oder wartet als Quarantäne. Diese Datei bestimmt, WAS ein Modul ist und WAS es NICHT gibt. Gilt mit `ARCHITEKTUR_MODULE_PATH1.md` (Wie) und `ui/` (Aussehen).

## KANON — die einzigen Module (F1)
- **FUNDAMENT** (F0/F1.1 gebaut+geprüft): Login & Rollen (alle dürfen alles), Tenant-Sicherheit, Server-Commands mit Versionsprüfung, Ereignisse, Receipts, Readback, privater Foto-/Dokument-Speicher, `v_*`-Read-Ports.
- **SUCHLEISTE** („das Gehirn", eigenes Modul, mit allem verknüpft; Pflicht vor Pilot F1.6): Suchvertrag — jedes Modul liefert Suchindex; Volltext über Kunde/Auftrag/Nummer/Termin. HINWEIS: liegt aktuell NICHT in `02_app` (in `00_BIBEL\_parallel`) → muss als Modul hereingeholt werden.
- **INTAKE — Infos & Ware rein** (F1.1 gebaut): Kunde wählen/neu, 1–20 Positionen, Menge, Oberfläche, Termin(wunsch), Foto/Dokument, Auftragsnummer + Receipt + Readback. UX-Gate: telefonbegleitend schnell, keine Formularwüste.
- **ORDERS — Auftragskarte (Herz)** (F1.2+F1.3): Lifecycle angenommen→galvanik→fertig→abgeholt (ein Command je Übergang, kein Start-Klick; „fertig" = Freeze → Abrechnung). Lebende Karte (Mockup Auftragskarte V8): Leistungsarten, Metall, Fotos/Notizen jederzeit, Termin änderbar. Karte = UI des Moduls; Fremddaten nur lesend über Ports; keine eigene Speicherung → herauslösbar. RAUS aus Mock: Benchmarks, Merge, LTV, Analyse-Widgets, Stations-Innenleben.
- **CUSTOMERS — Kundenkarte** (F1.3): Karte (Mockup Kundenkarte V2): Stammdaten, Kontakte, Eigenheiten, aktive Aufträge + Historie (über Port), Preisabsprachen, Notizen inkl. Telefonnotiz, Fotos/Dokumente. RAUS aus Mock: Analyse-/Marketing-Tab, LTV/Marge, Risk-Level, Auto-Mails. Ports gegen echte (auch leere) Daten, nie erfundene.
- **KALENDER** (Pflicht vor Pilot F1.6): Woche/Monat aus Auftrags-Terminen. Eine Wahrheit, zwei Ansichten.
- **ACCOUNTING (minimal) — raus** (F1.4+F1.5): Positionen aus eingefrorener Karte; Rechnung (Nummer, Snapshot, echtes PDF); Zahlung manuell bestätigen; offener Betrag; Status OFFEN/BEZAHLT. Buttons = Anschluss-Stellen (Command+Ereignis: fertig/bezahlt/abgleich). Kleiner Export-Formatierer (CSV/DATEV, Format-Freigabe Steuerberater).

## HOME/UI (kein eigenes „Modul", sondern Sicht auf dieselben Daten)
- Werkstatt = Phillip V4 (Kontroll-Home „Heute sichern"). „Der Tag" = Rolf V8. Referenz: `ui/`.

## QUARANTÄNE — später andocken, jetzt NUR als Vertrag/Anschluss-Stelle, kein Eigenbau
- OCR (externer Provider/API, kein Eigenbau).
- Produktions-Innenleben: interne Galvanik-Stufen (galvanik bleibt Blackbox „ganze Produktion").
- F2 Büro-Automatisierung (nächstes Paket): Anfrage→KV→Auftrag umwandeln, E-Mail an Kunde/KV/Auftrag verknüpfen (Provider-API), „Büro-Arbeitsvorrat".
- Anschluss an Ereignisse: DHL/Versand („abgeholt/versendet"), Mollie/Bank-Abgleich („bezahlt"), Mahnwesen („offener Betrag").

## ENTFÄLLT BEWUSST — kein Modul, auch keine Mini-Version, wird GELÖSCHT
Analyse/KPI-Cockpit · eigenständiges Buchhaltungs-Modul (über Accounting-minimal hinaus) · Zeiterfassung · Teilfertigung · Kundenportal · eigenes Kalender-Produkt · Galvanik-Stufentracking · E-Mail-/OCR-/Bank-Eigenbau · Marketing.

## ROUTEN-ZUORDNUNG (`src/app/*`, Stand 36 Routen) — für S2-Löschung
- **KANON (behalten → in `src/modules/` überführen):** orders, customers, kalender, buchhaltung→**auf Accounting-minimal (rechnungen) trimmen**, erfassung/intake (+ warendurchlauf/neu als Intake), api, actions, admin, settings. Werkstatt-Home aus `warendurchlauf` NUR als Orders-Sicht (Phillip V4), Stationsband gelöscht.
- **QUARANTÄNE (stehen lassen, eingefroren, nur Vertrag):** scan (OCR), station/[slug]+galvanik-Innenleben, kommunikation (F2), quotes (KV→F2).
- **ENTFÄLLT → LÖSCHEN:** analyse, cockpit, kontrolle, performance, status (alle KPI/Cockpit), marketing, baeder (Galvanik-Stufen), betrieb, betrieb-kvp, kvp, today+start (konkurrierende Homes → Werkstatt/Der Tag), finanzen (06., Leiche), kunden-auftraege (06., Dublette→customers), print-queue, feedback, archive(prüfen).
- **AMBIG — Owner-Entscheid vor Löschung:** lager, lieferanten, items, telefonnotiz (→ Intake-Notiz oder eigen?). Nicht raten.

## Warum das die „alte-App-Falle" schließt
Der scheinbare Widerspruch „4 Mocks vs. 36 Routen" ist keiner: die App SOLL ~6 Module sein; ~30 Routen sind genau das oben als ENTFÄLLT/QUARANTÄNE Benannte. Die Vorlagen sind für die beabsichtigte App ausreichend. Die Arbeit ist Subtraktion + 5 Nähte (siehe Path 1) + Suchleiste hereinholen — kein neues Screen-Bauen.
