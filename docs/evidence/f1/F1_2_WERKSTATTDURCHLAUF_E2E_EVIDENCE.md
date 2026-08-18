# F1.2 Werkstattdurchlauf – realer Ende-zu-Ende-Beleg

**Datum:** 2026-08-17
**Basis-SHA:** `ef9a8411cad56b968dcbe97b089260d38c67f7d5`
**Branch:** `f1/werkstattdurchlauf-m2-20260817`
**Kanonischer Arbeitsort:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`
**Produktkandidat:** noch nicht eingefroren; der exakte Prüf-SHA wird erst im externen Review-Paket festgehalten.
**Interner Status:** realer E2E und fokussierte Paketgates PASS; unabhängige Abnahme ausstehend.

## 1. Verbindlicher Umfang

F1.2 implementiert ausschließlich den ersten realen Werkstattübergang:

`wareneingang (angenommen) → galvanik`

Zusätzlich ist die nachvollziehbare Korrektur

`galvanik → wareneingang (angenommen)`

mit Pflichtbegründung, eigenem Ereignis und Versionskonflikt abgesichert. Kein Start-Klick, kein `in_progress`, kein Abschluss, keine Abholung und kein F1.3-Atom wurden umgesetzt.

## 2. Reale Abnahmekette

Der Test `e2e/f1-2-werkstattdurchlauf.real.spec.ts` lief am 2026-08-17 mit genau einem Tablet-Worker bei 1024 × 1366 Pixeln gegen `http://localhost:3001`:

1. frisch zurückgesetztes lokales Supabase mit allen Migrationen bis `20260817120000_f1_2_order_lifecycle_contract.sql`;
2. echte lokale Supabase-E-Mail-Auth für Admin und Fremdmandant sowie echter PIN-Login für Readonly;
3. echte F1.1-UI-Erfassung desselben Auftrags `A-2026-0001`;
4. echter signierter Storage-Upload und bestätigte Finalisierung des Originalfotos;
5. echter serverseitiger Übergabe-Command mit atomarer Mutation und unveränderlichem Ereignis;
6. bestätigter Readback in der Galvanik-UI nach Navigation/Reload;
7. echter veralteter Zweitkontext mit sichtbarem `CONFLICT` und ohne zweiten Write;
8. echte Korrektur mit Pflichtgrund und eigenem Korrekturereignis;
9. bestätigter Readback zurück im Wareneingang nach Navigation/Reload;
10. echte Rollen- und Tenant-Ablehnungen ohne fachliche Mutation;
11. echter lokaler DB-Ausfall mit sichtbarem Error-Zustand und anschließender Wiederherstellung des Kreile-Stacks.

**Ergebnis:** 2/2 Playwright-Tests PASS in 3,0 Minuten.
**Produktionspfad-Mocks:** keine.
**Abnahmepfad-Mocks:** keine.

## 3. Auftrag und persistierter Endzustand

| Feld | Wert |
|---|---|
| Auftrag | `A-2026-0001` |
| Order-ID | `903078e5-1ecb-4528-9cbd-d6e5e6d2cf56` |
| Tenant | `galvanik-kreile` |
| Endstation | `wareneingang` |
| Endstatus | `angenommen` |
| Endversion | `3` |
| Actor-ID Übergabe/Korrektur | `5602cb16-e5d6-4214-9c84-8dbbb256db9d` |

Der finale read-only DB-Readback bestätigte exakt eine Order-Zeile für `A-2026-0001`, genau ein Übergabeereignis und genau ein Korrekturereignis.

### Übergabe-Receipt

| Feld | Wert |
|---|---|
| Event-/Receipt-ID | `ffe62a64-3a2a-4f3e-b5cb-0046883c4398` |
| Eventtyp | `ORDER_STATION_MOVED_V1` |
| Client-Event-ID | `662b184f-513e-4f09-b85e-4aa549c4b25e` |
| Correlation-ID | `0d843e09-3073-4ecd-b33e-26201d6122e8` |
| Version | `2` |
| Übergang | `wareneingang → galvanik` |
| Status | `success` |

### Korrektur-/Readback-Receipt

| Feld | Wert |
|---|---|
| Event-/Receipt-ID | `8d7f8cad-644f-4862-a399-e1fd74d38c5a` |
| Eventtyp | `ORDER_STATION_CORRECTED_V1` |
| Client-Event-ID | `209d463b-81a9-4da6-8a98-439f0f2bd38d` |
| Correlation-ID | `b3cbfa39-a9ea-4071-a900-f587de437f4c` |
| Version | `3` |
| Korrektur | `galvanik → wareneingang` |
| Pflichtgrund | `Falsche Zuordnung im Wareneingang korrigieren` |
| Readback-Quelle | echte lokale Datenbank nach UI-Navigation/Reload |

### Originalfoto-Receipt

| Feld | Wert |
|---|---|
| Reservation-ID | `309a94fb-f0f5-44b9-8319-b5be64e9a96b` |
| Evidence-Receipt-ID | `b6eae9fa-5b9b-4937-9913-0ae7a7950df7` |
| Storage-Object-ID | `b5d9c458-b705-46b7-a1dc-43a01b0d1301` |
| Purpose | `ORDER_INTAKE_ORIGINAL_V1` |
| Pfad | `order-intake-evidence/v1/309a94fb-f0f5-44b9-8319-b5be64e9a96b.png` |
| SHA-256 | `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460` |

## 4. Positive und negative Nachweise

- **Loading:** Galvanik-Liste zeigt den echten Ladezustand.
- **Empty:** frisch zurückgesetzte DB zeigt den echten Leerzustand.
- **Data:** `A-2026-0001` erscheint nach dem Übergang in Galvanik.
- **Conflict:** der zweite bereits geöffnete Admin-Kontext erhält wegen Version 1 gegen Version 2 sichtbar `Auftrag wurde bereits geändert.`; DB und Ereignisse bleiben unverändert.
- **Correction:** Pflichtgrund erzeugt Version 3 und genau ein `ORDER_STATION_CORRECTED_V1`.
- **Reload/Readback:** derselbe Auftrag erscheint danach wieder in Wareneingang mit Version 3.
- **Denial/Rolle:** echter Readonly-PIN-Login erhält `Stationswechsel ist nicht erlaubt.`; keine Mutation.
- **Denial/Tenant:** echte Auth des Fremdmandanten endet mit `AUTH_ERROR: Benutzer nicht gefunden`, ohne App-Session und ohne Mutation.
- **Error:** bei real gestopptem Container `supabase_db_02_app` zeigt der Browser `Daten konnten nicht geladen werden`; anschließend wurden DB und Gateway wiederhergestellt (`DB_HEALTH=healthy`, `AUTH_HEALTH=200`).

## 5. Browser-Artefakte

| Datei | Zustand | SHA-256 |
|---|---|---|
| `01-galvanik-loading.png` | Loading | `8F8869D89CD25E05B44CF802490FDA0966B0B99CA26EBE6EE5D2BA74277AB808` |
| `02-galvanik-empty.png` | Empty | `B926C21BCAFA422B1C4B74DD5DD08F032E52C9707F1F56A035639542F8A2659A` |
| `03-intake-photo-confirmed.png` | echter Storage-Upload | `4E639B72182FF699D51491CA919AAA8DDA435D3880A754108D450B67D11230DB` |
| `04-source-order-data.png` | Wareneingang Data | `0F0CCC6120EC378A271875C3AEC39AFB1E25C2FEDAC80FC4C40A83CCE5BD9D52` |
| `05-forward-success.png` | Übergabe bestätigt | `F013F01851439FA404D0AC8F646F18D93280A87014673F5E3BB97A9421C4D1CF` |
| `06-stale-conflict.png` | sichtbarer Versionskonflikt | `AE6E91CE50D47C2392050FB40C8B0760C4A0C61C58DB148BF9F66877E5901515` |
| `07-target-reload-data.png` | Galvanik Readback | `7333949BB917F0688772A3C41E276E4CC72D9C158E1FC809C178F38355080E21` |
| `08-correction-success.png` | Korrektur bestätigt | `FF00F0483FD75B076AE700426CB74FBA02B7E4B3437C048E95B7618AB746D158` |
| `09-source-reload-readback.png` | Wareneingang Reload/Readback | `F5196036AA4A5D6FDCD824A8730CDB1979E1937DB441628C4A44CD1838F43664` |
| `10-readonly-denial.png` | echte Rollen-Ablehnung | `320DD32B6D2984047F36EF7A9B8061F5EF155070DB434786BD557713EBD8E95C` |
| `11-foreign-tenant-denial.png` | echte Tenant-Ablehnung | `997CC3BBC00085E6CF4E6AF7E32A44A71342BD83AC4966CFB643D4DF59204030` |
| `12-galvanik-real-error.png` | echter DB-Ausfall/Error | `E861649E68BE1EB77C9EE00DF34471FA3B742907F215CB77C2463112A9949BF9` |

Alle Dateien liegen unter `docs/evidence/f1/artifacts/f1-2/`.

## 6. Serielle Paketgates

| Gate | Ergebnis |
|---|---|
| Lifecycle-/Command-Unit | PASS, 23/23 |
| frische reale DB-Integration | PASS, 23/23 |
| fokussierte F1.2-UI | PASS, 38/38 |
| Attachment-Vertrag | PASS, 18/18 |
| Auth-Routenvertrag | PASS, 3/3 |
| Tablet-Navigationsvertrag | PASS, 5/5 |
| alle geänderten fokussierten Unit-/RTL-Dateien | PASS, 13/13 Dateien, 217/217 Tests |
| realer Browser-E2E | PASS, 2/2, ein Worker |
| F1-R0 No-Fake-Production-Gate | PASS, `REACHABLE_PRODUCTION_MOCKS=0`, `UNREGISTERED_VISIBLE_CAPABILITIES=0`, `ACTIVE_CAPABILITY_REAL_E2E=PASS` |
| TypeScript `--noEmit` | PASS |
| fokussiertes ESLint | PASS |
| Next.js Produktions-Build (`--webpack`, 2-GB-Node-Grenze) | PASS, 58/58 statische Seiten generiert |
| `git diff --check` | PASS |

Unit-/RTL-Mocks bleiben ausschließlich `TEST_ONLY` und sind keine Abnahmebelege. Die Abnahme beruht auf dem realen Browser-/DB-/Auth-/Storage-Pfad oben.

Ein erster kombinierter Unit-Aufruf zeigte ausschließlich eine Test-Harness-Ursache: zwei verzögerte Mock-Antworten waren vor ihrem tatsächlichen Aufruf abgeräumt worden und blieben in der Once-Queue. Die beiden betroffenen Testdateien setzen diese Queue nun deterministisch zurück; der anschließende vollständige fokussierte Lauf bestand mit 217/217. Produktcode, Datenvertrag und realer E2E-Pfad wurden in dieser Schleife nicht verändert.

## 7. Maschinenlesbarer Abschlussblock

```text
REAL_E2E_PATH=e2e/f1-2-werkstattdurchlauf.real.spec.ts; fresh local Supabase -> real Auth/Tenant/Roles -> F1.1 UI create A-2026-0001 -> real Storage -> server command -> wareneingang/angenommen V1 to galvanik V2 -> receipt -> reload/readback -> stale conflict/no write -> correction with reason -> wareneingang/angenommen V3 -> reload/readback -> readonly and foreign-tenant denial/no write -> real DB outage/error -> stack recovery; PASS 2/2
SUPABASE_RESET_AND_MIGRATIONS=PASS
PRODUCTION_PATH_MOCKS=NONE
ACCEPTANCE_PATH_MOCKS=NONE
WRITE_RECEIPT=ffe62a64-3a2a-4f3e-b5cb-0046883c4398, Version 2, Correlation-ID 0d843e09-3073-4ecd-b33e-26201d6122e8
READBACK_RECEIPT=8d7f8cad-644f-4862-a399-e1fd74d38c5a, Version 3, Quelle echte lokale Datenbank nach UI-Navigation/Reload
BROWSER_PROOF=http://localhost:3001/warendurchlauf/wareneingang und /warendurchlauf/galvanik; Loading, Empty, Error, Denial, Conflict, Data, Übergabe, Korrektur, Reload/Readback
NEGATIVE_PROOF=Tenant fremd AUTH_ERROR/no session/no write; Rolle readonly FORBIDDEN/no write; Version stale CONFLICT/no second event; realer DB-Ausfall sichtbarer Error und Wiederherstellung
COMMIT_SHA=PENDING_FREEZE_IN_EXTERNAL_REVIEW_PACKAGE
INDEPENDENT_REVIEW=NOT_RUN
F1_2_STARTED=YES
F1_3_STARTED=NO
```

Dieser Beleg behauptet F1.2 noch nicht als unabhängig abgenommen. Das Paket bleibt bis zum eingefrorenen Commit-SHA und externen Read-only-PASS ein interner Kandidat.
