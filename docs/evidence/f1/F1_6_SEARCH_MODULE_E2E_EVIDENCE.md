# Path-1 S5 — reale modulare Suche

Stand: lokaler Kandidat auf `path1/suche-real-modular-20260910`; ein Exact-SHA wird erst nach den Abschlussgates eingetragen. F1.6 bleibt `NOT_STARTED`, der Kalender bleibt offen.

## Liefervertrag

- Datenquellen: ausschließlich `private.v_operational_station_queue_v1` über `readTenantOperationalOrders` und `private.v_order_intake_customers_v1` über `searchOrderIntakeCustomers`.
- Autorisierung: echte serverseitige Sitzung über `resolveAuthorization`; kein Client-`tenantId`.
- Modulnaht: `src/modules/suche` besitzt nur DTOs, Suchlogik und UI-Port. DB-, App-, Overlay-, Router- und URL-Bindungen bleiben außerhalb des Modulkerns.
- Treffer: `ORDER` und `CUSTOMER`; Teil, Material, Oberfläche und Termin führen zum zugehörigen Auftrag. ISO-, `DD.MM.YYYY`- und `DD.MM.YY`-Terminwerte werden deterministisch erkannt.
- Fail-closed: leer/zu kurz ohne Portzugriff; maximal 80 Zeichen; maximal 20 Treffer; jeder Port- oder Readmodellfehler ergibt ausschließlich `UNAVAILABLE`, nie Teilresultate oder interne Fehlertexte.
- Bedienung: Klick/Touch, `Ctrl/Cmd+K`, Escape, Pfeile und Enter; ehrliche Zustände idle/loading/empty/data/denial/error/conflict; ältere Async-Antworten können neue Treffer nicht überschreiben.

## Lokaler Real-DB-Beleg

Fresh Supabase wurde ohne Seed bis `20260909180000` zurückgesetzt. Danach lief:

```text
npx vitest run src/test/search_tenant.integration.test.ts --maxWorkers=1 --no-file-parallelism
Test Files 1 passed (1)
Tests      1 passed (1)
```

Ein Auftrag wurde über den echten `createOrderIntake`-Command und eine echt signierte, aus der DB bestätigte App-Session angelegt. Derselbe Auftrag wurde über Auftragsnummer, Teil, Material, Oberfläche, ISO-Termin und deutschen Termin exakt zurückgelesen; der zugehörige Kunde über den Kundenvertrag. Leer-/Fremdtenant blieb leer, fehlende Session wurde abgewiesen und ein absichtlich inkonsistentes Tenant-Readmodell führte ohne Teilresultat zu `UNAVAILABLE`.

Mocks im Produktionspfad: `NONE`. Mocks im Abnahmepfad: `NONE`.

## Browserbeleg

Der erlaubte Test `e2e/search.real.spec.ts` erzeugte über echtes lokales Supabase Auth und den kanonischen Intake-/Stationsübergabe-UI-Pfad genau einen synthetisch gekennzeichneten Kunden/Auftrag. Er öffnete aus der Header-Suche die vorhandene Kunden- und Auftragskarte und belegte Desktop `1440x900`, Tablet quer `1220x880`, den formulierten Leerfall, Denial, Error und horizontalen Überlauf. Treffer wurden über Kunde, Auftragsnummer, Teil, Material, Oberfläche und deutschen Termin nachgewiesen; Quelle, Matchfeld/-wert, Zusammenhang und Öffnungswirkung waren sichtbar.

Artefakte nach dem Lauf:

- `docs/evidence/f1/artifacts/search/search-desktop-customer-1440x900.png`
- `docs/evidence/f1/artifacts/search/search-desktop-order-1440x900.png`
- `docs/evidence/f1/artifacts/search/search-desktop-empty-1440x900.png`
- `docs/evidence/f1/artifacts/search/search-tablet-1220x880.png`
- `docs/evidence/f1/artifacts/search/search-tablet-denial-1220x880.png`
- `docs/evidence/f1/artifacts/search/search-tablet-error-1220x880.png`
- `docs/evidence/f1/artifacts/search/search-real-browser-receipt.json`
- `docs/evidence/f1/artifacts/search/search-real-browser-receipt.sha256`

Browser-E2E lokal: `PASS` (1/1, 2,7 Minuten). Receipt SHA256: `FC31AEFEEB3A4C4509FE16DABD3A28FD0153FA516C51BA0397D127C4E6876E69`.

## Lokale Abschlussgates

- fokussierter Such-/Header-/Modulvertrag: `PASS` (4 Dateien, 47 Tests)
- externer Provider-Guard: `PASS` (1 Datei, 2 Tests); erlaubt ausschließlich `SearchDialog`/`searchTenantAction` und verbietet weiterhin KI-, Web-, Gemini- und Legacy-Suchpfade
- vollständige Unit-Suite: `PASS` (111 Dateien, 879 Tests)
- TypeScript, vollständiges ESLint, Build und `git diff --check`: `PASS`
- Modul-Gates und W4-Read-Port-Vertrag: `PASS` (`files=658`, `read_ports=24`)
- No-Fake: `PASS`; `REACHABLE_PRODUCTION_MOCKS=0`, `UNREGISTERED_VISIBLE_CAPABILITIES=0`, `ACTIVE_CAPABILITY_REAL_E2E=PASS`
- ESLint-Ratchet: `PASS`, Debt `0 errors / 0 warnings`; Baseline-Delta ausschließlich `judgeContractHash`

Exact-SHA-CI und unabhängige Abnahme bleiben bis zum Push offen; dieses Dokument behauptet noch keine Paketabnahme.
