# ÜBERGABE — Frontend-Umsetzung (Design → echte App) · V1 · 2026-08-21

**An:** Projektleitung / Mainchat-Writer · **Von:** Orchestrator
**Anlass:** Die abgenommenen neuen Oberflächen (Rolf „Der Tag" V8, Phillip „Werkstatt" V4, Auftragskarte MACHART_V8, Kundenkarte MACHART_V2) sind **entschieden, aber nie in die App gebaut**. Die App läuft auf der bestehenden alten Oberfläche. Dieses Paket beauftragt die Umsetzung — **parallel** zum Order-to-Cash-Backend (F1.4/F1.5).
**Repo-Stand (Konnektor-verifiziert):** `main = f1c34b8`. App = Next.js App-Router unter `src/app/` mit ~30 bestehenden Routen (u. a. `today`, `start`, `cockpit`, `kontrolle`, `warendurchlauf`, `baeder`, `orders`, `kunden-auftraege`, `customers`, `station`). Es gibt `src/app/globals.css` als bestehendes Style-Fundament.

## Ziel
Die abgenommenen Mockups als **echtes Frontend** der App umsetzen — auf dem **Order-to-Cash-Pfad zuerst**, gegen die **bereits vorhandenen Daten/Ports aus F1.2/F1.3**. Nicht neu erfinden, sondern die bestehende App auf die neue Optik heben.

## Prinzipien (bindend)
- **Bestehendes ehren:** vorhandene `globals.css` + Komponenten-Struktur reconcilen, **kein zweites Designsystem forken**. Die Kreile-Tokens (Navy/Cream/Brand, Fraunces + Inter, Touch 48px) in das bestehende System einbringen.
- **Keine neuen Daten, kein Mock:** die neuen UIs an die **selben echten Ports** hängen, die F1.3 schon nutzt (Station-Queue, Intake, Evidence, Auftrag). Demo-Daten der Mockups (Mustermann/300 SL) sind reine Design-Demo, nie übernehmen.
- **D-USP-001 / D-ARCH-010:** Galvanik = **1 Step** (keine Bäder-Oberfläche), Startseite = Kontrollinstrument.

## Scope Phase 1 (OTC-kritischer Pfad — NICHT alle ~30 Routen)
| Mockup | Ziel-Route (bestehend) |
|---|---|
| Rolf „Der Tag" (V8) | **eine** aus `today`/`start`/`cockpit`/`kontrolle` — **konsolidieren, kein 5. Dashboard** |
| Phillip „Werkstatt" (V4) | `warendurchlauf` / `station`-Einstieg |
| Auftragskarte V8 | `orders` / `kunden-auftraege` (Detailansicht) |
| Kundenkarte V2 | `customers` |

Buchhaltung, Finanzen, Analyse, Marketing, Lager usw. sind **nicht** Phase 1.

## Vorgehen (Proof-Slice zuerst — de-riskt die Reconcile)
0. **Inventar + Reconcile:** Writer sichtet die bestehenden Start-/Today-/Cockpit-/Warendurchlauf-Seiten + `globals.css`; legt fest, **wie** die Kreile-Tokens integriert werden und **welche** bestehende Route die neue Rolf-Startseite wird. Ergebnis als kurze Notiz.
1. **EIN Nachweis-Screen — Phillip „Werkstatt" (V4):** ein vertikaler Schnitt gegen echte Daten. Beweist Designsystem-Reconcile **und** Datenanbindung an einem Screen. Klein, prüfbar, PR.
2. **Rest des OTC-Pfads:** Rolf-Startseite + die zwei Karten, auf demselben Muster.
3. Jede Phase: PR · kein Mock · echte Ports · Abnahme + unabhängiges Review.

## Parallel / Voraussetzungen
- **UI-Freeze:** Rolf V8 + Phillip V4 + Karten auf echtem Gerät testen → als Referenz einfrieren (läuft parallel, blockiert Phase 0/1 nicht).
- **Fehlende Screens:** die **F1.4-Rechnungs-Ansicht** + **F1.5-Warenausgang/Bezahl-Fluss** entwerfe ich (Orchestrator/Design-Chat) parallel; sie kommen dann in Phase 2/3 dieses Pakets.
- **Alt-Reste:** `baeder`-Route + Bad-Logik gegen D-ARCH-010 prüfen (retten/entfernen) — eigener kleiner Task, nicht Phase 1.

## Zwei Owner-/PL-Bestätigungen (bevor Phase 0 endet)
1. **Welche bestehende Route wird die neue Rolf-Startseite** (`today` vs. `start` vs. `cockpit`) — und werden die anderen zusammengeführt?
2. **`baeder` entfernen** (D-ARCH-010) — ja/parken?

## Governance
Ein Writer · PR statt Push · kein Mock · echte Ports · Designsystem **konsolidieren, nicht forken** · keine Remote-DB/RLS/Merge ohne Freigabe. Läuft **parallel** zu F1.4/F1.5; **kein** Vorziehen weiterer Backend-Pakete.

---
*Frontend-Umsetzung V1 · 2026-08-21 · Grundlage: abgenommene Mockups (Rolf V8, Phillip V4, Karten V8/V2) + echte App-Struktur @ main f1c34b8 · Owner-Entscheidung „Parallel-Paket jetzt" · Änderungen nur als V2 mit Grund.*
