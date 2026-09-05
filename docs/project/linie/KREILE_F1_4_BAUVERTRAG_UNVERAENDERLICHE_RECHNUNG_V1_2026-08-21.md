> **VERBINDLICHE RATIFIKATION (siehe DIE LINIE §3, 2026-08-28):** Es gilt **19 % USt ONLY** (kein 7 %-Mix), **PAYMENT_TERM_DAYS=14**, **SERVICE_DATE_RULE=FINAL_F1_3_FREEZE_DATE**, EVOLVE_PUBLIC_INVOICES additiv. Wo §1/§8 unten „7 % möglich" oder „Leistungsdatum offen" andeuten, ist das durch die Ratifikation ERSETZT — nicht interpretieren, die Linie gilt.

# BAU-VERTRAG F1.4 — Unveränderliche Rechnung · V1 · 2026-08-21

**Paket:** `F1.4_UNVERAENDERLICHE_RECHNUNG` · **Für:** Mainchat/Writer · **Von:** Orchestrator (im Auftrag des Owners)
**Status:** VORGELEGT zur Owner-Ratifizierung. **Bau startet erst nach vollständigem Abschluss + Merge von F1.3** (Lieferfolge). Vorbereitung/Planung jetzt erlaubt.
**Grundlage:** M3-Bauplan §3 (accounting) · D-F15-001 (Zahlungs-Gate) · D-F13-001 (Mehrarbeit/Freeze) · D-ARCH-002 (Zwei-Achsen) · D-USP-001 (Entlastung). Owner-Entscheidungen 2026-08-21 eingearbeitet.
**Rechtlicher Hinweis:** §14 UStG-Pflichtangaben und GoBD-Unveränderlichkeit sind hier nach Standard abgebildet — final mit dem **Steuerberater** bestätigen.

> **V1.1-KORREKTUR (2026-08-21, nach Repo-Prüfung durch die Projektleitung):** Es existiert bereits `public.invoices`, von F1.3 als Rechnungssperre genutzt. **Keine neue Tabelle** — die bestehende `public.invoices` wird **kontrolliert erweitert** (`INVOICE_TRUTH=EVOLVE_PUBLIC_INVOICES`), damit es genau eine Buchhaltungswahrheit gibt. **Bindende technische Auflage:** die Erweiterung ist **additiv/rückwärtskompatibel** — der Writer liest zuerst die exakten aktuellen Spalten aus dem F1.3-Branch und ergänzt (Snapshot, Unveränderlichkeits-Trigger, Storno-Felder, lückenloser Nummernkreis, Read-Port), **ohne** Legacy-Felder (Nummer/Betrag/Status) zu entfernen/umzubenennen, sonst bricht F1.3. §4 unten gilt entsprechend als **Erweiterung** von `public.invoices`, nicht als neue Tabelle.

## 0 — Auftrag in einem Satz
Aus einem auf `fertig` eingefrorenen Auftrag eine **unveränderliche Rechnung** erzeugen (fortlaufende Nummer, Snapshot der Positionen + Mehrarbeit, USt-Ausweis, PDF) — Korrektur nur per Storno + Neuausstellung.

## 1 — Owner-Entscheidungen (verbindlich)
- **Steuer:** Regelbesteuerung — **USt wird ausgewiesen** (Standard 19 %; Satz als Stammdatum). Kein Kleinunternehmer. *(Ratifiziert: 19 % ONLY, siehe Linie §3.)*
- **Nummernkreis:** **fortlaufend pro Jahr `R-YYYY-NNNN`**, lückenlos, Neustart je Jahr, je Tenant.
- **Korrektur:** **Storno + neue Rechnung** — Original bleibt unverändert bestehen, ein Storno-Beleg hebt es auf, danach neue korrekte Rechnung.

## 2 — Vorbedingung / Datenherkunft
- Auftrag muss `fertig` sein (F1.3-Freeze `ORDER_FROZEN_V1` gesetzt) → eingefrorene Positionen + Mehrarbeit-Katalog + Beträge (D-F13, historisierter Stundensatz).
- Kunde/Auftrag/Teile kommen aus bestehenden Ports; die Rechnung nimmt einen **Snapshot** (keine Live-Referenz), damit sie unveränderlich bleibt.

## 3 — Scope / Verträge (SOLL)
**besitzt:** Rechnung (Nummer, Ausstelldatum, Positions-Snapshot, Netto, USt-Satz+Betrag, Brutto, Status, PDF-Referenz), Nummernkreis, Storno-Beleg.

**Commands (Result-Union, Receipt-Readback):**
- `createInvoice({orderId, expectedVersion, clientEventId})` — nur wenn Auftrag `fertig`. Vergibt **transaktional** die nächste lückenlose Nummer `R-YYYY-NNNN` (Sequence/Sperre je Tenant+Jahr, keine Lücke, keine Doppelvergabe). Friert Positions-Snapshot + USt-Berechnung ein. Erzeugt PDF. Danach **immutable**. Rolle: `buero|meister|admin`.
- `cancelInvoice({invoiceId, expectedVersion, reason(5–500), clientEventId})` — erzeugt Storno-Beleg (negativ), Original bleibt bestehen; gibt den Auftrag für eine neue Rechnung frei. Rolle: `meister|admin`. Nie Löschung.

**Ereignisse (append-only, versioniert):** `INVOICE_CREATED_V1`, `INVOICE_CANCELLED_V1`. Abnehmer (Zahlungsabgleich F1.5, Mahnung, Buchhaltung) docken hier an — nie an UI/Tabellen.

**Read-Port:** `private.v_invoice_summary_v1` (Rechnung + Auftrags-/Kundenbezug, Status, offener Betrag) für Karten, Suche und spätere Buchhaltung.

**USt-Berechnung:** Netto je Position (inkl. Mehrarbeit) → USt-Satz (Stammdatum, 19 %) → Brutto. Rundung kaufmännisch, je Rechnung ausgewiesen.

**PDF (Pflichtangaben §14 UStG):** Name/Anschrift Kreile + Kunde · Steuernummer/USt-IdNr · Rechnungsnummer · Rechnungsdatum · Leistungs-/Lieferdatum · Menge und Art der Leistung (aus Snapshot) · Netto · USt-Satz + -Betrag · Brutto · Zahlungshinweis. (Vom Steuerberater gegenprüfen lassen.)

## 4 — Datenvertrag (Owner-Grenze: neue Tabellen/Statusmaschine)
- Erweiterung von `public.invoices` (additiv): `id, tenant_id, order_id, number, issued_at, snapshot(jsonb), net, vat_rate, vat_amount, gross, status(issued|cancelled), cancelled_by, cancel_reason, pdf_ref, aggregate_version` — Legacy-Felder (Nummer/Betrag/Status) NICHT entfernen/umbenennen.
- Nummernkreis: `invoice_number_sequence(tenant_id, year, last_no)` transaktional, oder DB-Sequence je Tenant+Jahr.
- **Unveränderlichkeit:** nach `INVOICE_CREATED` sind die Rechnungsfelder per DB-Vertrag (Trigger/Constraint) schreibgeschützt; einzige Zustandsänderung ist `issued → cancelled` über `cancelInvoice`.

## 5 — EXPLIZIT NICHT in F1.4 (Abgrenzung)
- **Zahlungseingang / „bezahlt"-Bestätigung / offener-Betrag-Abgleich = F1.5** (D-F15-001, Bank/Mollie später).
- **Mahnwesen, DATEV/Export, Buchhaltungs-Übergabe = später** (D-ARCH-004: kein Export in diesem Modul).
- **E-Mail-Versand der Rechnung** = später über Outlook-Adapter; F1.4 liefert PDF + Download. Papierdruck optional.

## 6 — Governance (unverändert)
Ein Writer · PR statt Push · **kein Mock** im Abnahmepfad · Tenant aus `resolveAuthorization()` fail-closed · Commands liefern die Result-Union · Migrationen lokal → PR · keine Remote-DB/RLS/Merge ohne Freigabe · Status-Vokabular.

## 7 — Abnahmekriterien (Definition of Done)
- Nummernkreis **lückenlos + kollisionsfrei** unter Nebenläufigkeit (Parallel-Erstellung getestet).
- Rechnung nach Erstellung **unveränderlich** (Mutationsversuch → abgelehnt); Storno erzeugt Beleg + erlaubt Neuausstellung.
- USt (19 %) korrekt gerechnet und ausgewiesen; PDF enthält alle §14-Pflichtangaben.
- Vertragstests je Port: leerer / gefüllter / fremder Tenant abgewiesen.
- `INVOICE_CREATED_V1` / `INVOICE_CANCELLED_V1` DB-vertraglich fixiert; Receipt-Readback; kein Mock.
- Nur aus `fertig`-Aufträgen erstellbar; Snapshot entkoppelt von Live-Daten.
- Abschlussbericht mit finalem SHA + Prüfsumme; CI grün am selben SHA; unabhängiges Review ohne P0/P1.

## 8 — Offen zur Steuerberater-Bestätigung (blockiert das Schreiben nicht)
- Firmen-Stammdaten für den PDF-Kopf (Anschrift, Steuernummer/USt-IdNr, Bankverbindung). *(USt-Satz + Leistungsdatum sind ratifiziert — Linie §3.)*

---
*F1.4-Bau-Vertrag V1.1 · 2026-08-21 · Owner-Entscheidungen + Ratifikation eingearbeitet · Kopie im kanonischen Ordner abgelegt 2026-08-28 · Änderungen nur als V2 mit Grund.*
