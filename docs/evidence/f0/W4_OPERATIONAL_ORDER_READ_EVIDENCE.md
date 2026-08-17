# W4 Operational Order Read Evidence

Status: PASS_LOCAL

Gesamtstatus W4: PASS_LOCAL; F0-Delivery bleibt BLOCKED_EXTERNAL_PERMISSION

## Gegenstand

Der operative W4-08-Read-Anteil ersetzt die aktiven globalen beziehungsweise hardcodierten Auftragsleser durch genau einen vollständigen, frischen und tenantgebundenen Read-Port. Das Paket ändert keine Migration, keine Policy, keine Grants, keine Remote-Datenbank und keinen Writer.

## Datenkette

public.orders/customers/items → private.v_operational_station_queue_v1 → readTenantOperationalOrders(AuthorizationSnapshot) → getOperationalOrders(AuthorizationSnapshot) → getOrdersDb() → Orders/Archive/Station → Loading/Unavailable/Loaded-Empty/Data.

Der Count nutzt dieselbe versionierte View über readTenantOperationalOrderCount(AuthorizationSnapshot). Ein ungültiger Tenant-, Ownership-, Pflichtfeld- oder Stationszustand macht Full-Read und Count unverfügbar; er wird nicht als leer oder null ausgegeben.

## Sicherheits- und Datenvertrag

- Actor, Tenant, Rolle und perm_view_leitstand stammen ausschließlich aus resolveAuthorization().
- getOrdersDb() und getOrderCountDb() haben keine Clientparameter.
- Der fachliche DB-Port wird erst nach erfolgreicher Session- und Capability-Prüfung dynamisch geladen.
- Der Full-Read und Count setzen den Session-Tenant transaktionslokal und lesen ausschließlich private.v_operational_station_queue_v1.
- Jede Full-Read-Zeile wird streng auf Tenant, Ownership, Version, Pflichtfelder, Stationskonsistenz und Item-Zugehörigkeit geprüft.
- Leere oder nur aus Leerzeichen bestehende Stationsaliaswerte sind keine Nullwerte und werden abgelehnt.
- Es gibt keinen Prozesscache, keinen hartcodierten Tenant im Read-Pfad und keinen generischen Station-/Customer-Read-Export.
- ordersRepository.getAll() ist nicht provider-env-gated, verwirft keinen Fehler als [] und propagiert jede Nicht-OK- oder Promise-Ablehnung.
- readonly und buero dürfen mit perm_view_leitstand lesen; Stationsmutationen bleiben weiterhin an perm_op_status gebunden.

## UI-Wahrheit

Orders, Archive und Station unterscheiden explizit:

1. loading: keine Zahl und keine Leerbehauptung,
2. unavailable: keine stale Daten, keine Null-/Leer-Simulation,
3. loaded-empty: nur nach erfolgreichem Read,
4. data: reale Read-Model-Daten.

Orders trennt echte Gesamtleere von einem Such-/Filter-Leerstand. Archive und Station trennen echte Gesamtleere von einer leeren routenspezifischen Teilmenge. Bei jedem Reload werden stale Aufträge und ausgewählte Details vor dem neuen Read entfernt. Der Anzeigename beschichtung wird ausschließlich in der UI auf die kanonische interne Station galvanik abgebildet; er wird nicht als DB-Selektor an den Server übergeben.

## Tests

| Nachweis | Status |
| --- | --- |
| Action: Resolver vor Read-Port, Capability, neutraler Fehler, adversarialer Tenantparameter | PASS |
| Repository: Nicht-OK-/Reject-Matrix und explizites Success-Empty | PASS |
| Mapper: Datumstreue, Tenant/Ownership, Stationsalias, kein Cache, sicherer Count | PASS |
| Orders: echtes Card-Rendering, Loading/Unavailable/Empty/Data, Filterleerstand, Reload non-ok/reject | PASS |
| Archive: Loading/Unavailable/Empty/Data, kanonische persistierte Archivstatus und leere Archivteilmenge | PASS |
| Station: Loading/Unavailable/Empty/Data, leere Stationsteilmenge, Beschichtung→Galvanik | PASS |
| Legacy-Klassifikator: kein Import/Port/Datenoutput, exakter NOT_AVAILABLE-Fehler und Exit 1 | PASS |
| Frischer lokaler Supabase-Replay | PASS — 11 Migrationen |
| Lokale PG17-Integration: wechselnde Tenants, Set-Gleichheit, kein Cache-Bleed, Corruption fail-closed, Count, Rollen-/Command-Trennung | PASS — 1 Datei, 19 Tests |
| Fokussierte Vitest-Suite | PASS — 5 Dateien, 35 Tests |
| TypeScript (`npx.cmd tsc --noEmit --incremental false`) | PASS |
| Exact-Path ESLint (14 TS-/TSX-Pfade) | PASS |
| Vollständiger Unitlauf | PASS — 83/83 Dateien, 448/448 Tests; Start 20:12:04; Dauer 71,96 s |
| Diff-Check | PASS |

## Unabhängige Reviews und Red-Team

- Security/Data-Truth-Review: REVIEW_PASS, keine offenen P0/P1.
- UI-/Testqualitäts-Review: REVIEW_PASS, keine offenen P0/P1.
- Der abschließende Kommentar-Red-Team-Fehler war ein enger Falschfehler: Der alte `/cache/i`-Guard traf ausschließlich das Wort `uncached` in einem Kommentar, nicht einen Cache-Import oder ein Cache-Symbol. Der Kommentar wurde ohne Laufzeitdelta auf `Fresh per invocation` präzisiert; der vollständige Unitlauf blieb mit 83/83 Dateien und 448/448 Tests grün.

## Reparaturschleifen

1. Ursache: Die neuen UI-Testmocks erzeugten pro Render eine neue Router-Identität; zusammen mit einer Router-Abhängigkeit im Ladeeffekt entstand eine erneute Ladeschleife. Der Stationstest wartete außerdem nicht auf den bereits erfüllten Route-Parameter innerhalb von `act`. Delta: stabile Router-Testinstanzen und ein vollständig erwarteter Station-Render-Harness; keine Produktionsänderung.
2. Ursache: Nach Entfernung der generischen Legacy-Read-Exports blieb ein unbenutzter TypeScript-Typimport in `operationalOrders.ts`. Delta: ausschließlich den obsoleten Type-only-Import entfernt; kein Laufzeitdelta.

## Scope

Produktionspfade: src/app/actions/orders.actions.ts, src/lib/server/orderStationRead.ts, src/lib/server/operationalOrders.ts, src/lib/repositories/ordersRepository.ts, src/app/orders/page.tsx, src/app/archive/page.tsx, src/app/station/[slug]/page.tsx.

Testpfade: src/app/actions/__tests__/w4OperationalOrdersRead.test.ts, src/lib/server/__tests__/w2cB2m5u.operationalDueTruth.failClosed.test.ts, src/app/orders/__tests__/w4OperationalOrdersReadStates.test.tsx, src/app/archive/__tests__/w4ArchiveOrdersReadStates.test.tsx, src/app/station/[slug]/__tests__/w4StationOrdersReadStates.test.tsx, src/test/w3_order_station.integration.test.ts.

Eng freigegebener zusätzlicher Quarantänepfad: scripts/fetch_and_classify_orders.ts. Das alte Skript hat keinen autorisierten Session-/Tenant-Kontext und endet deshalb ohne Import, Portzugriff oder Datenoutput mit einem neutralen NOT_AVAILABLE-Fehler.

Evidence: docs/evidence/f0/W4_OPERATIONAL_ORDER_READ_EVIDENCE.md.

## Externe Grenze

Der lokale Replay- und Integrationstest lief gegen PostgreSQL 17. Der lokale Postgres-Rollenvertrag verwendet `rolbypassrls`; damit belegt dieser Lauf den App-Prädikat- und Transaktionsvertrag, nicht Production-RLS oder Least-Privilege.

Dieses Paket führt keine Production-/Remote-DB-Aktion aus. Remote-/Production-Aktivierung sowie Production-RLS und Least-Privilege sind nicht belegt und bleiben bis zur gesonderten Freigabe außerhalb dieses Nachweises. Der vollständige lokale W4-Abschluss und der globale Read-Port-Checker sind in `W4_EVIDENCE_READ_CONTRACT_EVIDENCE.md` belegt; F0-Delivery bleibt extern blockiert.
