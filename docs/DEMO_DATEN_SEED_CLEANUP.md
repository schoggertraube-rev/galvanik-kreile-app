# 🚀 Demo-Daten Seed- & Cleanup-System

## Zweck
Dieses System dient dazu, kontrollierte Test- und Demo-Daten in die Datenbank einzuspielen (für Präsentationen, Showcases) und diese restlos wieder zu löschen, ohne echte Live-Daten zu beeinträchtigen.

## Welche Daten werden erzeugt?
Das Seed-Skript erzeugt:
* **Kunden:** ca. 8 typische Kunden (Museum, Atelier, Schreiner, Privatkunden)
* **Aufträge:** ca. 8 Aufträge, verteilt über verschiedene Prozess-Stationen (Galvanik, Versand, etc.)
* **Artikel (Items):** Passend zu den Aufträgen (z.B. Stoßstangen, Türgriffe, Besteck)
* **Timeline Events:** Passende Historien-Einträge pro Auftrag (Erstellt, Gestartet, Abgeschlossen)
* **Telefonnotizen:** Thematisch passende Notizen zu Demo-Kunden
* **Bäder:** 2 Beispielbäder für die Galvanik

**Was NICHT geseedet wird:** Tabellen wie `business_kvp_items`, `feedback_notes`, `cost_positions`, `invoices`, `payments`, da sie zum aktuellen MVP-Stand noch nicht im Drizzle-Schema `src/db/schema.ts` existieren.

## Markierungsstrategie (Wie werden Demo-Daten erkannt?)
Alle Demo-Daten werden **ohne Schema-Migration** durch deterministische Primary Keys, Foreign Keys und einen Batch-Marker (`demo-livegang-2026-06-03`) identifiziert:
* `customers`: `id` beginnt mit `DEMO-CUST-` und `notes` enthält den Batch-Marker
* `orders`: `id` beginnt mit `DEMO-ORD-` und `statusText` enthält den Batch-Marker
* `items`: `id` beginnt mit `DEMO-ITM-`
* `events`: `id` beginnt mit `DEMO-EVT-` und `notes` enthält den Batch-Marker
* `baths`: `id` beginnt mit `DEMO-BATH-`
* `phone_notes`: Erhalten `tenantId = 'demo-galvanik-kreile'` sowie den Batch-Marker im `extractionJson`.

## Ausführung & Sicherheitsregeln

> [!WARNING]
> Seed und Cleanup sollten immer **zuerst im Dry-Run** ausgeführt werden! Die Skripte laden automatisch die `.env.local` Datei mittels `dotenv/config`.

### 1. Seed (Einspielen)
```bash
npm run demo:seed
```
Ohne Argumente läuft das Skript im **Dry-Run-Modus** und ändert nichts.
Zum echten Einspielen:
```bash
npm run demo:seed -- --confirm
```
Das Skript ist **idempotent** (Upsert) und erzeugt bei mehrfacher Ausführung keine Duplikate.

### 2. Cleanup (Löschen)
```bash
npm run demo:cleanup
```
Ohne Argumente läuft das Skript im **Dry-Run-Modus**, berechnet aber die zu löschenden Datensätze als Vorab-Prüfung aus der Datenbank.

Zum echten Löschen:
```bash
npm run demo:cleanup -- --confirm
```
Das Skript löscht Daten in **umgekehrter Foreign-Key-Reihenfolge**, um Constraints zu wahren:
1. `phone_notes`
2. `events`
3. `items`
4. `orders`
5. `customers`
6. `baths`

### Echter Datenschutz
* Löschvorgänge verwenden immer strikte `LIKE 'DEMO-%'` Filter auf die Primary Keys.
* Niemals wird eine Wildcard-Löschung ohne Präfix durchgeführt.
* Es ist unmöglich, dass echte `cuid()`-basierte Einträge versehentlich gelöscht werden, da sie kein `DEMO-`-Präfix enthalten.
