# BAU-VERTRAG F1.5 — Bestätigter Zahlungseingang & Warenausgang · V1 · 2026-08-21

**Paket:** `F1.5_BESTAETIGTER_ZAHLUNGSEINGANG` · **Für:** Mainchat/Writer · **Von:** Orchestrator (im Auftrag des Owners)
**Status:** VORGELEGT zur Owner-Ratifizierung. **Bau startet erst nach Abschluss + Merge von F1.4** (Lieferfolge). Vorbereitung jetzt erlaubt.
**Repo-Stand (Konnektor-verifiziert 2026-08-21):** `main = f1c34b8` (F1.3 via PR #66 `fc551b07` gemergt, Production READY). F1.3 = complete inkl. L6.
**Grundlage:** D-F15-001 (Zahlungs-Gate, drei Fälle) · M3-Bauplan §3 (accounting: `PAYMENT_CONFIRMED_V1`, `ORDER_PICKED_UP_V1`; Lücke L5) · D-ARCH-002 (Zwei-Achsen) · F1.4-Rechnung (offener Betrag) · D-USP-001.

## 0 — Auftrag in einem Satz
Den Order-to-Cash-Loop schließen: **Ortskette bis „abgeholt"** (Warenausgang) + **Zahlung offen→bezahlt** als eigene Achse, mit **modusabhängigem Gate**. Zuerst manueller „bezahlt"-Schalter; Mollie/Bank als **Adapter später** (kein Payment-Eigenbau).

## 1 — Kreile-Zahlungsrealität (aus D-F15-001, bindend)
1. **Vorkasse / Versand:** fertig → **bezahlt (Gate)** → Versand. Warenausgang **gesperrt bis bezahlt**.
2. **Abholung:** fertig → Kunde kommt → **bezahlen bei Übergabe** (bar / Karte via Mollie später) → abgeholt.
3. **Rechnung / Stammkunde:** fertig → Ware raus → Rechnung → **bezahlt danach** (Zahlungsziel). **Kein Gate.**

## 2 — Scope / Verträge (SOLL)
**besitzt:** Zahlungsstatus je Auftrag/Rechnung (offen → bezahlt, Modus Vorkasse|Abholung|Rechnung, offener Betrag, Zahlungsdatum, Zahlweg bar|Überweisung|Karte); Warenausgangs-Zustand.

**Commands (Result-Union, Receipt-Readback):**
- `confirmPayment({invoiceId, amount, method, expectedVersion, clientEventId})` — setzt bezahlt (voll oder Teil → offener Betrag). Rolle `buero|meister|admin`. Ereignis `PAYMENT_CONFIRMED_V1`.
- `recordGoodsOut({orderId, mode: Versand|Abholung, expectedVersion, clientEventId})` — Ortskette `fertig → abgeholt` (Bauplan-Lücke **L5**). **GATE:** bei **Vorkasse gesperrt** (`CONFLICT`/`FORBIDDEN`), bis Zahlung bestätigt. Rolle `werkstatt|meister|admin`. Ereignis `ORDER_PICKED_UP_V1` („abgeholt" ist der generische Ortszustand; „verschickt" ist die Versand-Ausprägung).

**Read-Port:** `private.v_payment_summary_v1` (bzw. Erweiterung von `v_invoice_summary_v1`): Status, offener Betrag, Modus, **Gate-Zustand** (raus erlaubt ja/nein). Für Karten, Rolf-Startseite („Vorkasse offen — Versand erst nach Zahlung"), Phillip-Startseite („🔒 noch nicht rausgeben — Freigabe fehlt", geldlos).

## 3 — Gate-Regel je Modus (D-F15-001)
- **Vorkasse:** `recordGoodsOut` gesperrt, bis `confirmPayment`. Sichtbar auf beiden Startseiten (Rolf: Warum/Geld; Phillip: nur „nicht rausgeben").
- **Abholung:** „bezahlen"-Aktion Teil der Übergabe (bar; Karte via Mollie später), dann `recordGoodsOut`.
- **Rechnung/Stammkunde:** kein Gate — `recordGoodsOut` erlaubt, Zahlung bleibt `offen`, später per `confirmPayment` gesetzt.

## 4 — Datenvertrag (Owner-Grenze: Statusfelder/Ereignisse)
- **Wie F1.4: bestehende Wahrheit erweitern, nicht duplizieren.** Zahlungsfelder additiv an `public.invoices` bzw. dem Auftrag ergänzen (rückwärtskompatibel, F1.3/F1.4 nicht brechen). Keine zweite Zahlungs-Tabelle.
- Ereignisse append-only, versioniert; Gate-Regel serverseitig erzwungen (nicht nur UI).

## 5 — Anbindung / Adapter (spätere Phase, Owner-Grenzen)
- **Mollie** (Kartenzahlung bei Abholung) und **Bank** (automatischer Zahlungseingangs-Abgleich für Vorkasse/Rechnung) = **API-first-Adapter**, sprechen nur `confirmPayment`/die Ereignisse. **Kein Payment-Eigenbau.** Credentials nur am Gate + Testkonto → **Owner-Entscheidung** (Provider + kostenpflichtiger Dienst). Bis dahin manueller „bezahlt"-Schalter.
- Rechnungsversand per E-Mail = Outlook-Adapter, separat (nicht F1.5).

## 6 — EXPLIZIT NICHT in F1.5
Mahnwesen · DATEV/Export (D-ARCH-004) · E-Rechnung-Versand (eigene Entscheidung, s. F1.4-Register) · vollständiges Buchhaltungsmodul. F1.5 = Warenausgang + Zahlungsbestätigung + Gate; Adapter danach.

## 7 — Governance (unverändert)
Ein Writer · PR statt Push · **kein Mock** im Abnahmepfad · Tenant aus `resolveAuthorization()` fail-closed · Result-Union + Receipt-Readback · Migrationen lokal → PR · Status-Vokabular. **Provider/Credentials/RLS/Remote-DB = Owner-Grenzen → vor Adapter-Bau ratifizieren.**

## 8 — Abnahmekriterien (Definition of Done)
- **Gate erzwingt:** Vorkasse-Warenausgang **vor** Zahlung → abgelehnt (Test); nach `confirmPayment` erlaubt.
- Abholung: Zahlung an Übergabe + Warenausgang; Rechnung: Warenausgang ohne Gate, Zahlung bleibt offen.
- Teilzahlung/offener Betrag korrekt; Idempotenz (`clientEventId`) + `expectedVersion`/`CONFLICT`.
- `PAYMENT_CONFIRMED_V1` / `ORDER_PICKED_UP_V1` DB-vertraglich fixiert; Read-Port zeigt Gate-Zustand.
- Vertragstests je Port (leer/gefüllt/fremder Tenant); **kein Mock**; Abschlussbericht mit SHA + Prüfsumme; CI grün am selben SHA; unabhängiges Review ohne P0/P1.

## 9 — Offen zur Owner-Entscheidung (blockiert den Vertrag nicht; vor Adapter-Phase klären)
- Welcher Zahlungs-Adapter zuerst: **ENTSCHIEDEN 2026-09-06 (Owner): Bank-Abgleich zuerst, Mollie spaeter** (Register §7-Nachtrag #10). Verbleibend nur Provider-Credentials/Kosten (Go-live-Gate).
- Teilzahlungen zulassen (ja/nein) und Skonto-Behandlung (Bezug Rolf-Skonto-Punkt / Buchhaltung).

---
*F1.5-Bau-Vertrag V1 · 2026-08-21 · Grundlage D-F15-001 · Bau erst nach F1.4-Merge · Ratifizierung durch Owner/Projektleitung, dann an Writer · Änderungen nur als V2 mit Grund.*
