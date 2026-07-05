# 06 · REDTEAM- & TRUTH-Protokoll

## Wie dieses Audit gegen sich selbst geprüft wurde

Das autonome Missionsprotokoll verlangt, dass ein **unabhängiger Prüfer** jeden Kernbefund zu widerlegen versucht, statt der Selbsteinschätzung des Finders zu vertrauen. Die dafür vorgesehenen REDTEAM-Subagenten fielen am **Sessionlimit** aus (externer Blocker, dokumentiert). Ersatzmaßnahme (Board-Entscheidung BOARD-2026-07-05-02):

> Der Chefdirigent prüft jeden CRITICAL/HIGH-Befund **selbst und reproduzierbar** im Code nach — mit denselben Grep/Read-Befehlen, die jeder Dritte wiederholen kann. Das ist strenger als eine Subagent-Behauptung, weil die Belege im `EVIDENCE_LEDGER` als Befehle hinterlegt sind.

## TRUTH-Disziplin

| Label | Bedeutung | Anwendung hier |
|---|---|---|
| **K** | direkt belegt (Datei/Zeile/Befehl) | alle Cluster-A/B/C-Kernbefunde |
| **I** | begründete Schlussfolgerung | z.B. F-B4 (Migration nicht reproduzierbar), F-F6 |
| **H** | prüfbare Hypothese | Konfidenzschwellen, Storage-„entweder öffentlich oder tot" |
| **U** | unbekannt | Reife von Spracherfassung, UX-Detailflows |
| **X** | widerlegt/veraltet | siehe unten |

## Was das REDTEAM (hier: Direktprüfung) BESTÄTIGT hat

15 von 15 stichprobenartig gegengeprüften CRITICAL/HIGH-Kernbefunden wurden **zu 100 % reproduziert** (Belege E-01…E-25 im `EVIDENCE_LEDGER.md`):

- Keine aktive Middleware (E-01), proxy nicht importiert (E-02) → **F-A4 bestätigt**
- `set_config`/`app.tenant_id` nie gesetzt (E-03), kein FORCE RLS (E-04) → **F-A1/A3 bestätigt**
- Kein PIN-Hashing (E-05) → **F-A7 bestätigt**
- 15/18 Routen ohne Auth (E-06), customer-search-Leak (E-07), item-photo-upload (E-08) → **F-A4/A5/A6 bestätigt**
- base64 im localStorage (E-09), useOfflineManager nur RAM (E-10), idbSync Math.random (E-11) → **F-C2/C3/C6 bestätigt**
- orders.current_station_id fehlt (E-12), events nie erzeugt (E-13) → **F-B1/B2 bestätigt**
- 9 Mock-Repos (E-14), .agents 647 Dateien (E-15), events.order_id NOT NULL (E-16) → **F-C1/F-F1/F-D1 bestätigt**

## Was das REDTEAM ENTLASTET / relativiert hat (Gegenprobe der Positiv-Behauptungen)

Damit der Bericht nicht einseitig ins Negative kippt, wurden auch die *guten* Behauptungen gegengeprüft — und bestätigt:

| Behauptung | Gegenprobe | Ergebnis |
|---|---|---|
| „Secrets liegen im Git" | `git ls-files \| grep env` | **X — widerlegt.** Nie committet (E-17). Nur lokal gestreut. |
| „getOperationalOrders hat N+1" | grep `inArray` (E-18) | **X — widerlegt.** Batch-Load, kein N+1. Wiederverwendbar. |
| „Alles ist Mock" (pauschal) | Gemini-Fallback (E-19), echte IndexedDB-Outbox (E-20) | **relativiert:** Mock ist real vorhanden, aber **nicht überall** — es gibt soliden Kern. |
| „Fundament ist Totalschaden" | Views/Transaktionen/Auth-Bausteine geprüft | **X — widerlegt.** Kern ist reparabel, nicht verloren. |

## Grenzen dieses Audits (ehrlich benannt)

1. **UX-Detailflows, Repo-Vollkartierung, Archäologie**: Fachprüfer fielen aus; vom Chefdirigenten nur in Kernpunkten nachgezogen. Tiefe geringer — im Text als `[Konduktor-Ergänzung]` bzw. `FB` markiert.
2. **Kein Laufzeit-E2E-Beweis erbracht**: Die Gates (tsc/Unit/Build) sind grün, aber sie beweisen **Kompilierbarkeit, nicht Funktion**. Ob Foto→DB→Zielkarte real durchläuft, ob RLS eine echte fremde Session blockt, ob das Original einen Crash überlebt — das ist **nicht** live getestet und bleibt als Pflicht-Nachweis der Reparatur-Wellen offen (Kapitel 07).
3. **Einige HIGH/MEDIUM-Befunde sind `FINDER-BELEGT`, nicht einzeln nachgeprüft** — sie sind mit Datei:Zeile plausibel, aber nicht vom Konduktor reproduziert. In den Tabellen mit `FB` gekennzeichnet.

## REDTEAM-Checkliste (Pflichtfragen) — Statusspiegel

| Frage | Antwort |
|---|---|
| Zweite Daten-/UI-Wahrheit? | **Ja** — Drizzle vs. anon + Mock (F-C1) |
| Datenverlust/Dublette? | **Ja** — RAM-Outbox (F-C3), base64-Quota (F-C2), nicht-idempotenter Sync (F-C6) |
| Falsches Routing? | **Ja** — Stationsdivergenz (F-B3) |
| Mehrarbeit für Rolf/Philipp? | **Ja** — Unzuverlässigkeit erzeugt Nacharbeit |
| Originalverlust? | **Ja** — CameraCapture (F-C4) |
| Offlinekonflikt? | **Ja** — 4 Systeme (F-C3) |
| Auth vs. Autorisierung? | **Ja** — 15 Routen ungeschützt (F-A4) |
| Tenant/RLS/Storage? | **Ja** — tot (F-A1/A2/A3), öffentliche URLs (F-A10) |
| Fachwert in TS/React statt SQL? | **Ja** — F-E1/F-E2 |
| Laufzeitbeweis statt statischer Behauptung? | **Teilweise** — Befunde belegt, Reparatur-Nachweise offen |
| Live-/Verkaufsreife verbessert? | **Nur nach Sanierung** — heute nein |
