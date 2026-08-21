# F1.3 Leistungsabschluss - realer Ende-zu-Ende-Beleg

**Datum:** 2026-08-21
**Basis-SHA:** `54858e4ffebb5472b02d5dbdafdc42b2241e588a`
**Branch:** `f1/leistungsabschluss-m3-20260820`
**Kanonischer Arbeitsort:** `C:\\Antygravityprojekte\\04_Kundenprojekte\\galvanik_kreile\\02_app`
**Produktkandidat:** noch nicht eingefroren; der exakte Pruef-SHA wird erst im externen Review-Paket festgehalten.
**Interner Status:** reales lokales DB/Auth/Storage/Browser-Gate PASS; Freeze, CI und unabhaengige Exact-SHA-Abnahme ausstehend.
**Unabhaengige Abnahme:** `NOT_RUN`

Dieser Beleg ist ein Autorenbeleg fuer den lokalen Kandidaten. Er ist kein
unabhaengiges Review, kein Merge- und kein Production-Nachweis.

## 1. Verbindlicher Umfang

F1.3 implementiert ausschliesslich den operativen Leistungsabschluss:

`galvanik -> fertig`

Der Abschluss friert die bis dahin erfasste Mehrarbeit je Auftragsteil
unveraenderlich ein und erzeugt das append-only Ereignis `ORDER_FROZEN_V1`.
Eine begruendete L6-Korrektur durch Meister/Admin erhaelt den historischen
Freeze, erzeugt `ORDER_FREEZE_CORRECTED_V1` und fuehrt den Auftrag nur dann
nach `galvanik` zurueck, wenn noch keine Rechnung existiert. Danach ist eine
Korrektur der Mehrarbeit und ein erneuter Freeze moeglich.

Die Daten bleiben operative Leistungswahrheit. F1.3 schreibt nicht in
`order_cost_positions`, `price_lines`, `db_geplant` oder `db_ist`.
Rechnung, Zahlung, Abholung, F1.4, F1.5, F1.6, eine Workflow-Engine und eine
zweite Accounting-Achse sind nicht Teil dieses Pakets.

Mitgelieferte, wiederverwendbare Vertraege:

- **L1:** Faelligkeit aus `private.v_operational_station_queue_v1`;
- **L2:** tenant- und nutzergebundener letzter Login mit append-only
  `USER_LAST_SEEN_RECORDED_V1` und Readback;
- **L4:** abgeleiteter Kartensuchvertrag ueber
  `private.v_card_search_documents_v1`, ohne vorgezogene Such-UI;
- **L6:** append-only Freeze-Korrektur mit Pflichtbegruendung und engem
  Rechnungs-Grenzvertrag;
- **S3:** ein gemeinsamer Zuweisungszustand je Auftrag mit
  `ORDER_TASK_ASSIGNED_V1` und `ORDER_TASK_HANDED_BACK_V1`.

Tenant und Rolle werden serverseitig aus `resolveAuthorization()` abgeleitet.
Eine Client-`tenantId` ist keine Autorisierungsquelle.

## 2. Reale Abnahmeumgebung

Der Realitaetslauf wurde mit
`C:\\Users\\Traube\\Desktop\\KREILE_F1_3_RUN_LOCAL_REAL_GATE.ps1`
gestartet. Die unveraenderten Roh-Receipts liegen unter:

`C:\\Users\\Traube\\Desktop\\App und Web Projekte 2026\\Kreile app\\_reviews\\f1-3-local-gate-20260821_092103`

| Umgebungsbeleg | Wert |
|---|---|
| Quell-`config.toml` SHA-256 | `1DC3A70191A12FA4F9E7AF2C05D428BF9A6D094CEE5B2B4D3762D5DE08289264` |
| temporaere Konfiguration SHA-256 | `1A74AADFD5DCE1DC4DD0803E507CEABB2DEBC5887EC78AA39F55C840D076613F` |
| lokales Supabase-Projekt | `02_app` |
| API / DB / Shadow | `55421 / 55422 / 55420` |
| Windows-Portkollision | `NO` |
| Repo-Konfiguration mutiert | `NO` |
| Migrationen laut Launcher | `21` Dateien; alle aktiven Migrationen bis F1.3 angewandt |
| Cleanup | `PASS`; lokaler Supabase-Stack nach dem Lauf gestoppt |

`00-supabase-reset.txt` bestaetigt den frischen Reset und die Anwendung aller
F1.3-Migrationen:

- `20260820121500_f1_3_foundation_ports.sql`
- `20260820133000_f1_3_extra_work_contract.sql`
- `20260820140000_f1_3_order_freeze_contract.sql`
- `20260820143000_f1_3_customer_summary.sql`

Lokale Schluessel wurden im Receipt redigiert. Es wurde keine Remote- oder
Production-Datenbank veraendert.

## 3. Vollstaendige reale Kette

Der Test `e2e/f1-3-leistungsabschluss.real.spec.ts` lief seriell mit genau
einem Worker gegen ein frisch zurueckgesetztes lokales Supabase:

1. echte Migrationen und echte lokale Tabellen, Views, Funktionen und Storage;
2. echte lokale Supabase-E-Mail-Auth fuer Admin und Fremdmandant sowie echter
   PIN-Login fuer Werkstatt und Readonly;
3. echte F1.1-UI-Erfassung eines neuen Auftrags mit echtem Storage-Original;
4. echter F1.2-Uebergang `wareneingang/angenommen -> galvanik`;
5. Tablet- und Desktop-Readback der Live-Auftragskarte;
6. echte Admin-Zuweisung an eine reale Werkstatt-Identitaet, Receipt und
   gemeinsamer Readback;
7. echte Rueckgabe durch dieselbe Werkstatt-Identitaet;
8. echte Admin-Konfiguration von Stundensatz und Katalogposition;
9. echte Mehrarbeitsmutation je Auftragsteil mit Receipt und Readback;
10. veralteter Zweitkontext mit sichtbarem `CONFLICT` und ohne zweiten Write;
11. reale Readonly-, Fremdtenant-, Missing-Session- und manipulierte
    Session-Ablehnungen ohne fachliche Mutation;
12. atomarer Abschluss `galvanik -> fertig` mit `ORDER_FROZEN_V1`,
    gefrorenen Zeilen, Receipt und Reload/Readback;
13. reale L6-Korrektur mit Pflichtbegruendung, erhaltenem historischen Freeze
    und Rueckkehr nach `galvanik`;
14. echte Mehrarbeitskorrektur und erneuter Freeze;
15. echte Invoice-Zeile blockiert eine weitere Korrektur mit `CONFLICT`,
    ohne zweiten Korrektur-Write;
16. Kundenkarte zeigt denselben Auftrag als `Ware im Haus`;
17. Accounting-Snapshot vor und nach dem Leistungsabschluss bleibt identisch;
18. L2-Receipt- und Zustandsviews bestaetigen die echten Login-Schreibvorgaenge.

**Ergebnis:** 1/1 Playwright-Test PASS mit einem Worker in 5,0 Minuten.
**DB-/Command-Integration:** 2/2 Dateien und 12/12 Tests PASS.
**Supabase Reset und Migrationen:** PASS.
**Produktionspfad-Mocks:** keine; finales No-Fake-Produktionsgate PASS mit
`REACHABLE_PRODUCTION_MOCKS=0`,
`UNREGISTERED_VISIBLE_CAPABILITIES=0` und
`ACTIVE_CAPABILITY_REAL_E2E=PASS`.
**Abnahmepfad-Mocks:** keine; der Nachweis lief gegen echte lokale
Auth/DB/Storage/Commands/UI.

## 4. Vertragstest-Matrix

| Nachweis | Datei | Ergebnis |
|---|---|---|
| L4 leer, gefuellt, fremder Tenant | `src/test/f1_3_foundation_ports.integration.test.ts` | PASS |
| L2 Write, Receipt, Readback, Replay | `src/test/f1_3_foundation_ports.integration.test.ts` | PASS |
| L2 Fremdsession ohne Zustand/Event | `src/test/f1_3_foundation_ports.integration.test.ts` | PASS |
| Live-Karte, Zuweisung und Mehrarbeit | `src/test/f1_3_live_card.integration.test.ts` | PASS |
| Kundenkarte leer/gefuellt/fremd | `src/test/f1_3_live_card.integration.test.ts` | PASS |
| Freeze, Replay und Post-Freeze-Guard | `src/test/f1_3_live_card.integration.test.ts` | PASS |
| L6 Korrektur, Historie und Refreeze | `src/test/f1_3_live_card.integration.test.ts` | PASS |
| L6 Rechnungssperre | `src/test/f1_3_live_card.integration.test.ts` | PASS |
| Readonly und Versionskonflikt | reale Integration plus Browser | PASS |
| kompletter Auth/DB/Storage/UI-Pfad | `e2e/f1-3-leistungsabschluss.real.spec.ts` | PASS, 1/1 |

Die fokussierten Integrationstests isolieren ihren Session-Port. Sie sind kein
Ersatz fuer den realen Browser-/Auth-Abnahmepfad; dieser bestand separat.

## 5. Auftrag, Receipts und Endzustand

| Feld | Belegter Wert |
|---|---|
| Auftrag | `A-2026-0002` |
| Kunde | `F1.3 E2E GmbH` / sichtbare Kundenkarte `F1.3 Kunde 1787297245186-5104` |
| Order-ID | im realen Lauf dynamisch gebunden; nicht separat in das Text-Receipt ausgegeben |
| Tenant | `galvanik-kreile` |
| Endstation / Endstatus | `fertig / fertig` |
| Endversion | `9` aus bestaetigtem DB-Readback |
| Mehrarbeit final | eine Position, 90 Minuten, 180,00 EUR |
| Accounting vor/nach | identischer DB-Snapshot; keine F1.3-Accounting-Mutation |

### Erstes Write-Receipt

| Feld | Wert |
|---|---|
| Event-/Receipt-ID | `db69c6ad-457e-4b0b-8aba-4ba154677d59` |
| Eventtyp | `ORDER_TASK_ASSIGNED_V1` |
| Aggregate-Version | `3` |
| Correlation-ID | `769e1d4d-0638-4f9d-a32e-cf7d601bb4e6` |

### Finales Readback-Receipt

| Feld | Wert |
|---|---|
| Event-/Receipt-ID | `f5b3dcda-726e-452e-8a45-c0ae59ff8963` |
| Eventtyp | finales `ORDER_FROZEN_V1` |
| bestaetigte Order-Version | `9` |
| Quelle | echte lokale Datenbank nach Reload/Readback |

Die reale Eventabfolge wurde vollstaendig und in dieser Reihenfolge geprueft:
`ORDER_TASK_ASSIGNED_V1`, `ORDER_TASK_HANDED_BACK_V1`,
`ORDER_ITEM_EXTRA_WORK_CHANGED_V1`, `ORDER_FROZEN_V1`,
`ORDER_FREEZE_CORRECTED_V1`, `ORDER_ITEM_EXTRA_WORK_CHANGED_V1`,
`ORDER_FROZEN_V1`. Die Einzel-IDs ausser erstem und letztem Receipt wurden
nicht separat in das Text-Receipt ausgegeben und werden deshalb hier nicht
erfunden.

## 6. Positive und negative Browsernachweise

- **Empty:** frisch zurueckgesetzte Galvanik-Liste ohne Auftrag.
- **Data:** echte Live-Auftragskarte auf Tablet und Desktop.
- **Zuweisung/Rueckgabe:** Admin weist zu, Werkstatt gibt denselben Auftrag
  zurueck; gemeinsamer Zustand nach Reload.
- **Mehrarbeit:** Katalogposition, Minuten, Betrag, Receipt und Readback.
- **Version:** stale Admin-Kontext zeigt `Auftrag wurde bereits geaendert.`;
  kein zweiter Write.
- **Rolle:** echter Readonly-PIN-Login zeigt
  `Fertig-Abschluss ist mit dieser Rolle nicht erlaubt.`; kein Write.
- **Tenant:** echte Fremdmandanten-Auth erzeugt keine App-Session.
- **Session:** fehlende und manipulierte Session leiten fail-closed nach
  `/start`.
- **Freeze:** `galvanik -> fertig`, gefrorene Mehrarbeit, Reload/Readback.
- **L6:** Pflichtbegruendung, historischer Freeze bleibt erhalten, Rueckkehr
  nach Galvanik, korrigierte Mehrarbeit und Refreeze.
- **Invoice-Konflikt:** nach realer Invoice-Zeile bleibt Version 9 und die
  Anzahl Korrekturereignisse unveraendert.
- **Kundenkarte:** derselbe Auftrag ist nach Reload als `Ware im Haus`
  sichtbar.

## 7. Browser-Artefakte

Alle Dateien liegen unter `docs/evidence/f1/artifacts/f1-3/`.

| Datei | Zustand | SHA-256 |
|---|---|---|
| `01-intake-storage-receipt.png` | echtes Intake-/Storage-Receipt | `19C7CC7EB6F088F41C2040BE90CB33F217DA917BA4A89619FD474F84E52E0DA0` |
| `02-galvanik-empty.png` | echter Leerzustand | `454DF3F5BC769916C4ECCB6CE078B16CBD904282764E8A901B29314E36A93FE0` |
| `03-live-card-data-tablet.png` | Live-Karte Tablet | `D4A5E76679864FC1110CAB3A7292F94B73964234E53011A3383D1A49DD33F539` |
| `04-assignment-admin-confirmed.png` | Admin-Zuweisung | `EAE18FC2D4F6D6F01078D5D9A2C69886B768685A37F2B0F4BE49CB6398713DBD` |
| `05-handback-workshop-confirmed.png` | Werkstatt-Rueckgabe | `D51E7EB88CF8DA29AF9E8C6B1C90B4A4AFDCB73853C1F403150F63F991A48B23` |
| `04-live-card-data-desktop.png` | Live-Karte Desktop | `FC26121B6CAF98650898B40D9DE83B2C8689B298802067904D24090A5AE8A0C1` |
| `05-extra-work-receipt-readback.png` | Mehrarbeit Receipt/Readback | `E3DD850C44A71E277B016E45CAC4FB9D8E90C187C52F166E91F499777E6CC22A` |
| `06-version-conflict.png` | sichtbarer Versionskonflikt | `97F93A11E0112B67FCCB3ACD557B145AE0CB722444E9819F602267893EF2E18C` |
| `07-readonly-denial.png` | echte Rollen-Ablehnung | `FAF7834860AD5E980B0B79B326BDDFA59F6DA384D167E98E186C8914FDE00E20` |
| `08-foreign-tenant-denial.png` | echte Tenant-Ablehnung | `E260DECE6A02C31FE4024B42B1A853FF5055D9C662C50446C43CB07FFA5776C1` |
| `09-freeze-confirmed.png` | Leistungsabschluss | `DFC48B0A8D5BA7643AD702386B7A94B1804A793A77BA22C27FF4F5C6AAC08587` |
| `10-customer-ware-im-haus.png` | Kundenkarte nach Reload | `70F7BE8876F1F2DE0DA5D4E3DD52B635BA1DE6617C730DD39C7128B2EABAA5BC` |
| `11-freeze-correction-confirmed.png` | L6-Rueckkehr zur Galvanik | `3C07D7FF16B6C0D61A6CA1314E114E0F091A7A7FCBE90832F234D9D6792C4585` |
| `12-refreeze-confirmed.png` | erneuter Freeze | `44670D96F95E7E2818E8B0F74411E0A2802F78CCB50296571C804A029B9B4755` |
| `13-invoice-conflict.png` | Rechnungssperre ohne Korrektur-Write | `96354B10DF54BD788F2856C79FE6E1C3EB0DB419A558C69AD21C8F29DEF73FD3` |

Die doppelte Nummerierung 04/05 ist Bestandteil des tatsaechlichen
Laufartefakts und wird nicht nachtraeglich umbenannt.

## 8. Serielle Paketgates

| Gate | Ergebnis |
|---|---|
| fokussierte Unit-/UI-Tests | PASS, 23/23 vor dem Realitaetslauf |
| frisches lokales Supabase und Migrationen | PASS |
| reale DB-/Command-Vertragsintegration | PASS, 12/12 |
| realer Browser-E2E | PASS, 1/1, ein Worker, 5,0 Minuten |
| TypeScript `--noEmit` | PASS nach letzter Testanker-Korrektur |
| fokussiertes ESLint | PASS nach letzter Testanker-Korrektur |
| `git diff --check` | PASS nach letzter Testanker-Korrektur |
| F1-R0 No-Fake-Production-Gate | PASS, `0 / 0 / PASS` |
| finaler Build | NOT_RUN |
| CI am eingefrorenen SHA | NOT_RUN |
| unabhaengige Exact-SHA-Abnahme | NOT_RUN |

Unit-/RTL-Mocks bleiben ausschliesslich `TEST_ONLY` und sind kein
Abnahmebeleg. Die Abnahme beruht auf dem realen Auth/DB/Storage/Command/UI-Pfad.

## 9. Maschinenlesbarer Kandidatenblock

```text
REAL_E2E_PATH=e2e/f1-3-leistungsabschluss.real.spec.ts; fresh local Supabase -> real migrations -> real Auth/Tenant/Roles -> F1.1 UI intake A-2026-0002 -> real Storage -> F1.2 handoff -> live card -> assignment/handback -> extra-work mutation/receipt/readback -> stale conflict/no write -> readonly/foreign/missing/manipulated denial/no write -> ORDER_FROZEN_V1 -> reload/readback -> L6 correction -> extra-work correction -> refreeze V9 -> real invoice conflict/no correction write -> customer Ware im Haus; PASS 1/1
SUPABASE_RESET_AND_MIGRATIONS=PASS
PRODUCTION_PATH_MOCKS=NONE
ACCEPTANCE_PATH_MOCKS=NONE
WRITE_RECEIPT=db69c6ad-457e-4b0b-8aba-4ba154677d59, Version 3, Correlation-ID 769e1d4d-0638-4f9d-a32e-cf7d601bb4e6
READBACK_RECEIPT=f5b3dcda-726e-452e-8a45-c0ae59ff8963, Order-Version 9, Quelle echte lokale Datenbank nach Reload/Readback
BROWSER_PROOF=http://localhost:3001/warendurchlauf/wareneingang und /warendurchlauf/galvanik; Empty, Data, Assignment, Handback, Conflict, Denial, Freeze, Correction, Refreeze, Invoice-Conflict, Customer-Readback
NEGATIVE_PROOF=Tenant fremd/no app session/no write; Rolle readonly/FORBIDDEN/no write; Version stale/CONFLICT/no second write; Session missing/manipulated/fail-closed redirect; Invoice vorhanden/CONFLICT/no correction write
COMMIT_SHA=PENDING_FREEZE_IN_EXTERNAL_REVIEW_PACKAGE
INDEPENDENT_REVIEW=NOT_RUN
F1_3_STATUS=CANDIDATE_FREEZE_PENDING_INDEPENDENT_REVIEW
F1_4_STARTED=NO
```

F1.3 bleibt bis zum eingefrorenen Commit-SHA, CI und unabhaengigen
Read-only-PASS ein interner Kandidat. Kein Merge und kein F1.4 sind Teil dieses
Belegs.
