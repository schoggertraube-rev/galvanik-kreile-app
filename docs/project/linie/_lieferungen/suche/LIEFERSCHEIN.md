# SUCHE-LIEFERUNG — Parallelmodul search, V1 (2026-08-18)

```
SUCHE-LIEFERUNG
Status: PASS
Getestet gegen: Repo galvanik-kreile-app, main = 54858e4ffebb5472b02d5dbdafdc42b2241e588a
                (Soll-SHA des Startpakets; aktueller main-SHA am 2026-08-18 per GitHub-API
                geprüft und IDENTISCH). Testebene: Vitest-Unit (Testdoubles) in nachgebildeter
                Repo-Testinfrastruktur — 30/30 Tests PASS, tsc --noEmit sauber.
                Keine lokale Supabase in dieser Umgebung verfügbar; Integrationslauf gegen
                echte lokale Instanz erfolgt bei M7 durch den Writer (Nachtrag Startprompt).
Dateien: search-modul/src/lib/search/searchTenant.ts
         search-modul/src/lib/search/__tests__/searchTenant.test.ts
         search-modul/src/components/search/SearchBar.tsx
         search-modul/src/components/search/__tests__/SearchBar.test.tsx
         search-modul/LIEFERSCHEIN.md
Gemeldete Lücken:
  L: durchsuchbarer Suchdokument-Port für Receipts, Positionsdetails und Karten-Notizen
     → für Treffer jenseits von Queue-View und Kundenstamm; deckt sich mit Bauplan §5 L4
       (F1.3, Writer). Die Receipts-Views (v_order_intake_receipts_v1,
       v_order_station_receipts_v1) sind reine Punkt-Lookups (orderId + clientEventId,
       teils actor-gebunden) und bieten heute keine durchsuchbare Fläche; Positionen der
       Aufträge sind über das parts-Feld der Queue-View bereits abgedeckt.
```

## Was geliefert wurde

**`searchTenant(query: string) → Promise<SearchTenantResult>`** — Querschnittssuche nach Bauplan §3. search besitzt nichts: kein Speicher, kein Index, keine zweite Wahrheit. Gelesen wird ausschließlich über die existierenden Server-Read-Funktionen der §2-Ports, nie per Direkt-SQL: `readTenantOperationalOrders` (→ `private.v_operational_station_queue_v1`, ORDER-Treffer inkl. Positionen über `parts`) und `searchOrderIntakeCustomers` (→ `private.v_order_intake_customers_v1`, CUSTOMER-Treffer, serverseitige `search_text`-Filterung, LIMIT 20 im Port). Tenant-Filter kommt ausschließlich aus `resolveAuthorization()` (Fundament); ohne gültige Session Denial fail-closed ohne jeden Portzugriff.

**`SearchBar`** — schlanke Client-Komponente: Eingabe + Trefferliste, Tastaturbedienung (Pfeiltasten, Enter, Escape), ARIA-Combobox-Muster, die sechs ehrlichen Zustände Loading / Empty / Error / Denial / Conflict / Data als `data-state`-Attribut. Optik neutral in den vorhandenen Token-Familien (`navy-900`, `neutral-gray-100`, Amber-/Rot-Muster analog `FoundationUnavailable`) — keine eigene Designwelt; finale Gestalt kommt vom UI-FIX-GATE. Die Komponente spricht nie selbst mit Ports: der Server-Zugriff wird als `search`-Prop injiziert.

## Vertragserfüllung (geprüft gegen Bauplan V1 §1/§3/§4 und Startpaket)

`SearchHit = { type: "ORDER" | "CUSTOMER", id, title, subtitle, status, matchField }` exakt wie vorgegeben. Ergebnis-Muster ist die gemeinsame diskriminierte Union aller Module (`OK | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION_ERROR | UNAVAILABLE`, Feldstil identisch mit `OrderIntakeCommandResult`); als Lese-Port trägt `OK` die Treffer (`hits`) statt eines Receipts. search erzeugt in V1 selbst nur `OK | UNAUTHENTICATED | VALIDATION_ERROR | UNAVAILABLE`; die UI behandelt vertragsgemäß alle Codes. Verbote eingehalten: keine neuen `v_*`-Views, keine Schema-/RLS-/Remote-/Production-Aktion, keine Mocks im Produktcode, kein KI-Adapter (dockt später ÜBER `searchTenant` an), kein Legacy-Zugriff (`GlobalSearch.tsx` nur gelesen, nicht reaktiviert). GitHub ausschließlich read-only verwendet.

## Testrealität: Unit-Ebene vs. Integrationsebene

**Unit-Ebene (diese Lieferung, PASS):** `resolveAuthorization` und die beiden Ports sind Testdoubles im Stil der bestehenden `src/lib/server/__tests__/*` (Vorlagen: `orderIntakeRead.test.ts`, `w2cB2m5u.operationalDueTruth.failClosed.test.ts`). Geprüfte Vertragsmatrix, je gelesenem Port:

| Vertragsfall | v_operational_station_queue_v1 | v_order_intake_customers_v1 |
|---|---|---|
| leerer Tenant → leere Treffer | PASS | PASS |
| gefüllter Tenant → korrekte Treffer inkl. `matchField` | PASS (orderNumber/title/customerName/task/parts, case-insensitiv, Kappung 20, deterministische Reihenfolge) | PASS (name/companyName/customerNumber/city, ehrlicher Fallback `searchText`) |
| fremder Tenant → keine Treffer, kein Fehler-Leak | PASS (Port wirft fail-closed → `UNAVAILABLE`, interner Fehlertext leakt nicht; Tenant nie aus Client-Input) | PASS (analog) |
| ohne Session → Denial ohne Datenzugriff | PASS (`UNAUTHENTICATED`, 0 Portaufrufe; `AUTHORIZATION_UNAVAILABLE` → `UNAVAILABLE`) | PASS (analog) |

Zusätzlich UI-Vertrag: alle sechs Zustände, Tastaturbedienung, Entprellung, Verwerfen veralteter Antworten (12 Tests). Läufe: `vitest run` → 30/30 PASS; `tsc --noEmit` (strict, Repo-Optionen) sauber. Harness: Node 22.22.2, Vitest 4.1.11, React 19.2.4, RTL 16.3.2 (Repo: Node 24.18 — für die Unit-Ebene ohne Belang, es werden keine Node-APIs genutzt).

**Integrationsebene (offen, M7/Writer):** echter Lauf gegen lokale Supabase mit echten (auch leeren) Daten — insbesondere Tenant-Isolation in SQL und `search_text`-Verhalten des Kunden-Ports. Keine Fake-Daten als Beleg in dieser Lieferung.

## Technische Festlegungen innerhalb des Vertrags (keine Produktentscheidungen)

1. Leerer Suchbegriff → `OK` mit leeren Treffern, ohne Portzugriff (kein Blätter-Modus in V1).
2. Suchbegriff: Trim, Obergrenze 80 Zeichen (Angleichung an das Limit des Kunden-Such-Ports), darüber `VALIDATION_ERROR`.
3. Kappung 20 Treffer je Typ (`SEARCH_MAX_HITS_PER_TYPE`); Reihenfolge deterministisch: erst ORDER (Port-Reihenfolge `created_at DESC`), dann CUSTOMER (Port-Reihenfolge `orders_count DESC`).
4. Treffer-Komposition nur aus Port-Feldern: ORDER `title` = Port-`title`, `subtitle` = `orderNumber · station`, `status` = Port-`status`; CUSTOMER `title` = `companyName ?? name`, `subtitle` = `customerNumber · city`, `status` = `customerType`.
5. Jeder Portfehler → `UNAVAILABLE` mit generischer Meldung, nie partielle Treffer, nie interner Fehlertext.
6. UI-Mapping: `UNAUTHENTICATED`/`FORBIDDEN` → Denial, `CONFLICT` → Conflict, `NOT_FOUND` → Empty, `VALIDATION_ERROR`/`UNAVAILABLE`/Promise-Fehler → Error.

Sollte eine dieser Festlegungen dem Auftraggeber produktseitig widersprechen, bitte melden — Anpassung ist lokal begrenzt.

## Einbau durch den Writer (M7)

Ordner `search-modul/src` 1:1 nach `src/` übernehmen (neue Pfade `src/lib/search/`, `src/components/search/`; keine bestehende Datei wird berührt). `SearchBar` benötigt eine vom Writer angelegte Server-Action als `search`-Prop (z. B. `'use server'; export async function searchTenantAction(query: string) { return searchTenant(query); }`) — bewusst nicht Teil dieser Lieferung, da Route-/Action-Anlage Repo-Integration ist. Vertragstests laufen in der vorhandenen Vitest-Infrastruktur ohne Zusatzkonfiguration (`npm run test:unit` / `vitest run`).

## Prüfumgebung im Paket

`_pruefumgebung/` = lauffähige Kopie (Harness mit Repo-`vitest.config`/-`tsconfig`-Spiegel, Typ-Shims der Fundament-/Port-Module mit 1:1-Signaturen vom gepinnten SHA). Zum Nachvollziehen: `cd _pruefumgebung && npm install && npx tsc --noEmit && npx vitest run`. **Nicht ins Repo übernehmen** — kanonisch ist ausschließlich `search-modul/`.

---
*Parallelmodul-Chat SUCHE · Lieferung V1 · 2026-08-18 · nach Bauplan KREILE_M3_BAUPLAN_V1 (M3-Gate offen) und Startpaket V1. Nach dieser Lieferung: STOPP — Prüfung durch den Orchestrator.*
