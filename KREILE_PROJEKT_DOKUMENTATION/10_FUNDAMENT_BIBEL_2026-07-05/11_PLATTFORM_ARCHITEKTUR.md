# 11 · Plattform-/Architektur-Audit (nachgeholt, Konduktor)

Ersetzt den ausgefallenen `platform-architect`. Belege: `99_AUDIT_INPUT/sweep_C_plattform.txt`. Vertieft Kapitel 04 (Wiederverwendbarkeit) mit Kopplungsdaten.

## Positiver Kernbefund: Der Kern ist NICHT abwärts an die Domäne gekoppelt

Direkter Kopplungstest:
```
grep "from '@/(lib/(baths|stations|buchhaltung)|features)'"  in  src/lib/auth, src/lib/offline, src/lib/server
→ 0 Treffer
```
**Das ist die wichtigste Nachricht für Wiederverwendung:** `lib/auth`, `lib/offline`, `lib/server` importieren **keine** galvanikspezifischen Module. Der generische Kern hängt nicht an Bädern, Stationen oder Buchhaltung. Er ist sauber nach unten entkoppelt und damit **extrahierbar** — genau die Voraussetzung, die Evas Lerninsel braucht.

## Schichtung (real vorhanden, wenn auch unvollständig)

| Schicht | Verzeichnis | Bewertung |
|---|---|---|
| Generischer Kern | `lib/auth`, `lib/offline`, `lib/ai`, `lib/ocr`, `lib/email`, `lib/payments`, `lib/search`, `lib/tracking`, `lib/server`, `lib/license`, `lib/privacy` | sauber trennbar |
| Domäne (Kreile) | `lib/baths`, `lib/stations`, `lib/buchhaltung`, `warendurchlaufIconResolver` | klar identifizierbar |
| Feature-Slices | `features/orders`, `features/customers`, `features/analyse` | nur 3 — Rest liegt in `app/actions` |
| Konstanten/Config | `constants/{pricing,stations,status}`, `config/{license,lockHints}` | vorhanden, aber **kein zentrales Tenant-Config** |

## Kopplungs-/Zirkularitätsbefunde

- **Tenant-Hardcode konzentriert**, nicht diffus: Top-Verursacher sind `db/schema.ts` (19×, die `.default("galvanik-kreile")`-Defaults) und `app/actions/erfassung.actions.ts` (11×). Der Rest verteilt sich dünn über Server-Actions. → **Ein zentraler, session-gespeister Tenant-Provider** würde den Großteil auf einen Schlag ablösen. Gut sanierbar (F-H1).
- **Kein zentrales Tenant-Config**: `"galvanik-kreile"` ist ein gestreutes Stringliteral, kein Symbol. Der Fix (Tenant aus Session) schafft zugleich die Multi-Projekt-Fähigkeit.
- **Milde App↔Feature-Kopplung**: `features/*` importiert 0× aus `app/`; `app/*` importiert nur 3× aus `features/`. Keine gefährliche Zirkularität — die Richtung stimmt grundsätzlich (app → features → lib).
- **Feature-Slice-Prinzip unvollständig**: Nur 3 echte `features/`-Module; die meiste Domänenlogik sitzt in `app/actions/*`. Für saubere Modulgrenzen sollte Domänenlogik dorthin wandern — aber das ist Kür, kein Blocker.

## Stabiler-Kern-Kandidaten (reif genug zum „Einfrieren")

Nach den Wellen 0–3 können als **stabiler Kern** deklariert werden:
- Auth-Bausteine (`lib/server/appSession`, `authorization`, `roles`, `permissions`)
- Offline-Outbox (`lib/offline/OfflineOutbox`)
- Gemini-/OCR-Client (`lib/ai/geminiClient`)
- Transaktions-Wrapper + `getOperationalOrders`-Muster (`lib/server`)
- SQL-View-Muster (KPI in Views)

## Blocker-Liste vor jeder Wiederverwendung (verdichtet)

1. Tenant aus Session statt Hardcode (F-H1) — **Pflicht für Multi-Projekt**.
2. App-Rolle + FORCE RLS + `SET LOCAL` (F-A1/A2/A3) — **Pflicht, v.a. bei Kinderdaten**.
3. Ein kanonischer Datenpfad, Mock-Typen (`MockOrder`/`MockCustomer`) durch DB-Typen ersetzen (F-C1, Kap. 09).
4. Schema aus Migrationen reproduzierbar (F-B1/B2/B4).
5. `.agents/`-Klon + Root-Ballast entfernen (F-F1/F-F2).

## Architektur-Urteil

Die Architektur ist **grundsätzlich gesund** (entkoppelter Kern, erkennbare Schichten, konzentrierter statt diffuser Tenant-Hardcode). Die Defekte sind **Verdrahtungs- und Disziplinprobleme**, keine Architekturfehler. Das stützt die Board-Entscheidung: **sanieren, nicht neu bauen** — und der Sanierungsweg produziert als Nebenprodukt das wiederverwendbare Kern-Template.
