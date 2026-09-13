# Path-1 UI-Konvergenz – Etappe D: reale modulare Suche

Stand: Kandidat auf `path1/ui-convergence-full-20260910`, Stack-Stand A/B/C `2aef5c5005cb76074720f01b65b949766653615a` unverändert bewahrt. Ein neuer Exact-SHA und eine unabhängige Abnahme stehen bis zum Push aus. F1.6 und Kalender bleiben `NOT_STARTED`.

## Liefervertrag

- Datenquellen: ausschließlich `private.v_operational_station_queue_v1` über `readTenantOperationalOrders` und `private.v_order_intake_customers_v1` über `searchOrderIntakeCustomers`.
- Autorisierung: serverseitige Sitzung über `resolveAuthorization`; kein Client-`tenantId`.
- Modulnaht: `src/modules/suche` besitzt DTOs, deterministische Suchlogik und den UI-Port. App-, Overlay-, Router-, Tenant-, Datenbank- und Providerbindungen bleiben außerhalb des wiederverwendbaren Kerns.
- Treffer: `ORDER` und `CUSTOMER`; jeder Treffer zeigt Quelle, tatsächliches Matchfeld/-wert, Zusammenhang und die Wirkung auf dieselbe V8-/V2-Karte.
- Nullergebnis: nennt Suchbegriff, geprüften Auftragsbestand und Kundenstamm sowie sichere Suchalternativen. Im produktiven Suchpfad existiert weder `NOT_FOUND` noch ein sichtbarer „nicht gefunden“-Sackgassentext.
- Fail-closed: leer/zu kurz ohne Portzugriff; maximal 80 Zeichen und 20 Treffer; jeder Port- oder Readmodellfehler ergibt `UNAVAILABLE`, nie Teilresultate oder interne Fehlertexte.
- Bedienung: Klick/Touch, `Ctrl/Cmd+K`, Escape, Pfeile und Enter; ältere asynchrone Antworten überschreiben keine neueren Treffer.
- Externe Suche: kein Internet-, Web-, KI-, Gemini- oder Google-Adapter im Produktpfad.

## Fresh-Supabase-Real-DB

Der dedizierte lokale Stack `02_app` wurde auf Loopback geprüft und ohne Seed bis `20260909180000` frisch zurückgesetzt. Danach lief blockierend:

```text
npx vitest run src/test/search_tenant.integration.test.ts --maxWorkers=1 --no-file-parallelism
Test Files 1 passed (1)
Tests      1 passed (1)
```

Der Test erzeugte über `createOrderIntake` mit echt signierter und aus der Datenbank bestätigter Sitzung einen synthetisch gekennzeichneten Kunden/Auftrag. Derselbe Auftrag wurde über Auftragsnummer, Teil, Material, Oberfläche, ISO-Termin und deutsches Datum exakt zurückgelesen; der Kunde über den Kundenport. Fremdtenant blieb leer, eine fehlende Sitzung wurde verweigert und ein absichtlich inkonsistentes Readmodell lieferte ohne Teilresultat `UNAVAILABLE`.

Mocks im Produktionspfad: `NONE`. Mocks im Real-DB-Abnahmepfad: `NONE`.

## Ziel-Shell-Browserbeleg

`e2e/search.real.spec.ts` lief mit einem Worker gegen denselben lokalen Fresh-Supabase-Stack: `PASS (1/1, 1,2 Minuten)`.

Belegt wurden:

1. Desktop `1914x917`: Kunden-Treffer öffnet die Kundenkarte V2; deren echter aktiver Auftrag öffnet die Auftragskarte V8; Schließen führt zurück zur Kundenkarte und danach zur unveränderten Ziel-Shell.
2. Desktop `1914x917`: Auftrag wird über Nummer, Teil, Material, Oberfläche und deutschen Termin gefunden und öffnet jeweils dieselbe Auftragskarte V8.
3. Desktop: formuliertes Nullergebnis mit beiden geprüften internen Quellen und sicheren Suchalternativen; kein verbotener Sackgassentext.
4. Tablet `1220x880`: Data-Zustand, V8-Öffnung und `horizontalOverflow=0`.
5. Mobile `390x844`: Kunden-Treffer/V2-Karte, Denial und echter Readmodellfehler als getrennte Zustände; kein horizontaler Überlauf.
6. Der `conflict`-Zustand ist im Komponentenvertrag fail-closed gebunden. Die reine Suchaction besitzt bewusst keinen versionierten Schreibkonflikt; im Real-Browser wurde deshalb kein künstlicher Conflict erzeugt.

Der Lauf erzeugte den Auftrag `A-2026-0003` ausschließlich im lokalen synthetischen Testtenant. Receipt SHA256:
`866DFBE7CD41EB7B077543ECAF8995E720BE5D88749EC3CC5A00CF47593850AA`.

| Artefakt | SHA256 |
| --- | --- |
| `search-desktop-customer-1914x917.png` | `471FCDB72D6C87CE1612C6F2AE07DE790937AFA8E5553B4465FE5DFA2B99D00F` |
| `search-desktop-order-1914x917.png` | `F2252918BDC149920EE0DD44B0BD9107FDC6C1BAA63D94F3D291C2C08712A8DB` |
| `search-desktop-empty-1914x917.png` | `3427CB865C1276E30A13338702074E2C9213AC346654148033B9CCC66801B218` |
| `search-tablet-1220x880.png` | `AAA45E4FB59E24E6264343F1931D965645634697BC3B4FCA35AF32B18947A867` |
| `search-mobile-customer-390x844.png` | `5CC8DC91D0849C6B210CB7130282424D162721FF73AC2D5BA4C36E24C6930790` |
| `search-mobile-denial-390x844.png` | `AA82599E74AEB6DBB3B89A07353487AABD9CC04ABE98BDDB16566D7E1C697BEA` |
| `search-mobile-error-390x844.png` | `5E70A80C6C6DDC5098CE158982BFF6BABDFE0C7F4CB438F60A6D2DFAF12ECB84` |
| `search-real-browser-receipt.json` | `866DFBE7CD41EB7B077543ECAF8995E720BE5D88749EC3CC5A00CF47593850AA` |

Die Bilder zeigen die gebaute Ziel-Shell und die gelieferten V8-/V2-Karten; die drei geprüften Stichproben enthielten kein Dev-Error-Overlay.

## Lokale Gates des Kandidaten

- fokussierter Search-/Header-/Providervertrag: `PASS` (5 Dateien, 42 Tests)
- vollständige Unit-Suite: `PASS` (110 Dateien, 832 Tests)
- TypeScript: `PASS`
- Build gegen ausschließlich lokalen Supabase-Prozesskontext: `PASS`
- Fresh-Supabase-Suchtest: `PASS` (1/1)
- Real-Browser-E2E: `PASS` (1/1)
- Modul-Gates, W4-Read-Port-Vertrag, No-Fake und Diff-Check: `PASS`
- ESLint: `PASS` für das vollständige Repository ohne den von der laufenden Supabase-CLI generierten Ordner `supabase/.temp/**`; das Paket selbst ist fehlerfrei
- Ratchet: `PASS`, Debt unverändert `0 errors / 0 warnings`; Baseline-Delta ausschließlich `judgeContractHash`

Exact-SHA-CI und unabhängige Abnahme bleiben bis zum Push offen. Dieses Dokument behauptet weder einen Teil-/Gesamt-UX-PASS noch einen Merge.
