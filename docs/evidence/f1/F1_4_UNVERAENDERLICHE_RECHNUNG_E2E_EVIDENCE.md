# F1.4 Unveränderliche Rechnung — Evidence

**Datum:** 2026-08-26

**Bauvertrag:** `KREILE_F1_4_BAUVERTRAG_UNVERAENDERLICHE_RECHNUNG_V1_2026-08-21.md`

**Bauvertrag SHA-256:** `B1F4E10ECB0C907085D9BE90E859AAFEF1C9798AE5DEEE2E3CE0DD849AD2634A`

**Basis-SHA:** `f1c34b8f36c05912a094eb163950a24a9710df97`

**Branch:** `f1/immutable-invoice-m4-20260821`

**Kanonischer Arbeitsort:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`

**Paketstatus:** `LOCAL_REAL_GATE_PASS_PENDING_FREEZE_CI` — der unveränderte Realitätslauf wurde lokal ausgeführt und unabhängig anhand von Gate-Log und Receipts geprüft (`PASS`). Der Produktkandidat bleibt `NOT_FROZEN`; die unabhängige Exact-Commit-SHA-Abnahme ist `NOT_RUN`.

**Produktkandidat:** `NOT_FROZEN`

**Unabhängige lokale Gate-/Receipt-Prüfung:** `PASS`

**Unabhängige Exact-SHA-Abnahme:** `NOT_RUN`

Dieses Dokument beschreibt einen bestandenen realen lokalen Gate-Lauf. Es
ist kein Beleg für Commit, Freeze, CI, PR, Merge, Deployment oder
Production. Fehlende Werte werden nicht aus statischen Tests abgeleitet.

## 1. Verbindlicher Umfang

F1.4 erzeugt aus genau einem finalen F1.3-Freeze eine unveränderliche
Rechnung. Die einzige Rechnungswahrheit bleibt die additiv erweiterte Tabelle
`public.invoices`.

Enthalten:

- transaktionaler Nummernkreis je Tenant und Jahr `R-YYYY-NNNN`;
- Snapshot von Verkäufer, Kunde, Auftrag, Basispositionen und gefrorener
  Mehrarbeit;
- konfigurierter USt-Satz 19 % oder 7 %, kaufmännische Rundung auf
  Rechnungsebene;
- Zahlungsziel aus echter Tenant-Konfiguration, bei fehlendem Wert
  fail-closed;
- unveränderliches Original-PDF und separater Stornobeleg;
- Korrektur ausschließlich durch `issued -> cancelled` und Neuausstellung;
- append-only `INVOICE_CREATED_V1` und `INVOICE_CANCELLED_V1`;
- tenantgebundene Receipt-, Summary- und PDF-Readbacks;
- UI für Ausgabe, Liste, Download, Storno und Neuausstellung.

Ausgeschlossen bleiben Zahlungseingang, offener Betrag, Mahnung, DATEV,
Export, E-Mail-Versand, Provideraktivierung und F1.5.

## 2. Architektur- und Datenkette

```text
finaler F1.3-Freeze
-> private.v_invoice_issue_source_v1
-> createInvoice / cancelInvoice
-> public.invoices + private.invoice_number_sequences + public.events
-> private.v_invoice_receipt_v1 / private.v_invoice_summary_v1
-> Server Actions und gespeicherter PDF-Download
-> Auftrags-Overlay / Rechnungsliste
-> Reload- und Receipt-Readback
```

| Vertrag | Implementierung | Status nach realem lokalem Gate |
|---|---|---|
| einzige Rechnungswahrheit | `public.invoices`, additive Migration | real geprüft, `PASS` |
| Nummernkreis | `private.invoice_number_sequences`, transaktionaler Allocator | reale DB-Prüfung `PASS` |
| Ausgabe-Command | `src/lib/server/commands/immutableInvoiceCommand.ts` | Unit `PASS`; reale DB-Prüfung `PASS` |
| Storno-Command | gleiche Command-Datei, Rolle Meister/Admin | Unit `PASS`; reale DB-Prüfung `PASS` |
| Read-Ports | `private.v_invoice_issue_source_v1`, `private.v_invoice_summary_v1`, `private.v_invoice_receipt_v1` | Inventargate `PASS`; reale DB-Prüfung `PASS` |
| Original-/Storno-PDF | `src/lib/pdf/ImmutableInvoiceDocument.tsx`, gespeicherte Bytes + SHA-256 | Unit `PASS`; realer Download `PASS` |
| Server-/UI-Verbraucher | Actions, PDF-Route, Auftrags-Overlay, `/buchhaltung/rechnungen` | Unit/UI `PASS`; realer Browser `PASS` |

Tenant und Rolle werden ausschließlich über `resolveAuthorization()`
fail-closed bestimmt. Weder Action noch UI akzeptieren eine Client-`tenantId`
als Autorisierungsquelle.

## 3. Abnahmekriterien des Bauvertrags

| Kriterium | Verbindlicher Nachweis | Aktueller Stand |
|---|---|---|
| BV-7.1 lückenlos und kollisionsfrei | parallele reale DB-Erstellung, fortlaufende Nummern | `PASS_LOCAL_REAL_GATE` |
| BV-7.2 unveränderlich, Storno, Neuausstellung | direkte Mutationsablehnung, Stornobeleg, unveränderte Originalbytes, nächste Nummer | `PASS_LOCAL_REAL_GATE` |
| BV-7.3 USt und PDF-Pflichtfelder | reale 19-%-Ausgabe, konfigurierte 7-%-DB-Prüfung, PDF-Byte-/Hash-Readback | `PASS_FOCUSED_PDF_TEST_AND_LOCAL_REAL_GATE` |
| BV-7.4 leer, gefüllt, fremder Tenant | reale Contract-/Browser-Matrix | `PASS_LOCAL_REAL_GATE` |
| BV-7.5 Events und Receipts | DB-vertraglich fixierte Events und exakter Receipt-Readback | `PASS_LOCAL_REAL_GATE` |
| BV-7.6 nur finaler Auftrag, Snapshot statt Live-Daten | F1.3-Freeze, Live-Quelldaten nach Ausgabe ändern, alte Liste/PDF bleiben unverändert | `PASS_LOCAL_REAL_GATE` |
| BV-7.7 SHA, CI, unabhängige Abnahme | eingefrorener Commit, CI und unabhängiger Exact-SHA-PASS | `PENDING_FREEZE_CI_EXACT_SHA_REVIEW` |

## 4. Realitätslauf

Der einmalige Real-Gate-Runner ist:

`C:\Users\Traube\.codex\.chatgpt-projects\g-p-6a0ef8bb2b148191b19180a092a23be7\local-artifacts\galvanik-kreile\scripts\KREILE_F1_4_RUN_LOCAL_REAL_GATE.ps1`

Er wurde syntaktisch und unabhängig read-only geprüft und real ausgeführt.
Er verwendet:

- lokales, isoliertes Supabase-Projekt `kreile_f1_4_gate`;
- eigene Ports `56420 / 56421 / 56422`;
- exakt kopierte und per SHA-256 verglichene Migrationen;
- seriell zuerst DB-Vertrag und Command ohne Service-Role-Key;
- danach einen zweiten frischen Reset;
- anschließend echte lokale Auth, Tenant/Rollen, Commands, Mutation,
  Receipts, Reload, PDF-Downloads und Browserzustände;
- einen Worker, keine Retries und abschließendes Stack-Cleanup;
- keine Remote-, Production-, RLS-, Git-, Push- oder Merge-Aktion.

**Receipt-Root:** `C:\Users\Traube\.codex\.chatgpt-projects\g-p-6a0ef8bb2b148191b19180a092a23be7\local-artifacts\galvanik-kreile\receipts\f1-4-local-gate-20260826_215451`

**Vorgate-Manifest:** SHA-256 `0D86E3F5D3327CBE95373F29DEC2F1443DC32948481616AE43AE6ED7A7657030`, 19050 Bytes.

**Quell-Provenienz:** vor und nach dem Lauf bytegleich, 29/29 Quellen geprüft;
Quell-Aggregat SHA-256 `F3694C3E0D6587E4BC2B0C9D0DD9B994C92721C89749342A84D875706B9F2979`;
Repo-only-Aggregat SHA-256 `CBC10654B869D4FE621793DD59EC8CC3FA84F08C4CACC260FA8C8CEBC5B1D798`.

**Supabase Reset und Migrationen:** `PASS` (beide seriellen Resets/Migrationsdurchläufe)

**Reale DB-/Command-Integration:** `PASS`, 2/2 Dateien, 11/11 Tests, 33,74 s

**Realer Browser-E2E:** `PASS`, 1/1 Test, 4,9 min

**Cleanup:** `PASS`

**Outputs:** exakt 9/9, alle frisch und gegenüber der Baseline verändert, keine
fehlenden oder zusätzlichen Dateien; Post-Output-Aggregat SHA-256
`BF317FC1A73AED1A7F9D114856FE171B61A320A664783E8B74ED127438A6B765`; 8 PNG plus
`f1-4-real-e2e-receipt.json`.

**Maschinen-Receipt:** `productionPathMocks=NONE`, `acceptancePathMocks=NONE`,
beide Integritäts-Receipts `true`; Active-Invoice-Konflikt-, Readonly- und
Fremdtenant-Negativbeweise `PASS`.

## 5. Realer Positivpfad

`e2e/f1-4-immutable-invoice.real.spec.ts` hat im realen lokalen Gate-Lauf in
einem durchgängigen Lauf denselben dynamischen Auftrag geprüft (`PASS`):

1. echte lokale Auth-Identitäten für Admin, Büro, Readonly und Fremdtenant;
2. synthetisch erkennbare lokale Geschäftsdaten;
3. echter F1.3-Abschluss über UI und Server-Command;
4. Ausgabe der Rechnung durch Büro;
5. gespeicherte PDF-Bytes und Datenbankhash stimmen mit dem HTTP-Download;
6. ein zweiter Actor erhält einen sichtbaren Active-Invoice-Konflikt ohne
   zweiten Write;
7. Nur Live-Kundenstammdaten werden nach der Ausgabe geändert; die unveränderliche
   Auftragsnummer bleibt unangetastet;
8. die erste Rechnungsliste und das Original-PDF bleiben am Snapshot;
9. Admin storniert; Receipt und Storno-PDF werden nach Reload bestätigt;
10. Original-PDF bleibt bytegleich;
11. derselbe Auftrag wird neu ausgestellt und erhält exakt die nächste Nummer.

Der Realtest hat keine Produktions- oder Abnahmepfad-Mocks eingesetzt.

## 6. Negative Matrix

| Fall | Erwartung | Stand |
|---|---|---|
| Auftrag nicht final | `VALIDATION_ERROR`, kein Write | reale Command-/DB-Prüfung `PASS`; Rechnung, Lifecycle-Event und Nummernzähler unverändert |
| fehlendes Zahlungsziel | `VALIDATION_ERROR`, keine Nummernlücke | reale Command-/DB-Prüfung `PASS`; kein Invoice-/Event-Write, keine Nummernlücke |
| aktive Rechnung | `CONFLICT`, kein zweiter Write | real geprüft, `PASS` |
| veraltete Version | `CONFLICT`, kein Write | reale Command-/DB-Prüfung `PASS`, kein zusätzlicher Write |
| Büro storniert | kein Storno-Control / serverseitig `FORBIDDEN` | fehlendes UI-Control real im Browser geprüft, `PASS`; serverseitiges `FORBIDDEN` bleibt ausschließlich Unit-belegt |
| Readonly | Liste/Commands `FORBIDDEN`, keine Daten | Listen-/Keine-Daten-Verweigerung real im Browser geprüft, `PASS`; Command-Verweigerung fokussiert unit-geprüft, `PASS` |
| Fremdtenant | leer beziehungsweise `NOT_FOUND`, keine Daten | reale Browser-Zulassungsverweigerung plus reale DB-Tenant-Read-Verweigerung, `PASS` |
| fehlende/manipulierte Session | `UNAUTHENTICATED`, kein Write | fokussiert unit-geprüft, `PASS` |
| direkte Invoice-Änderung/-Löschung | DB lehnt ab | realer DB-Contract-Test `PASS`, SQLSTATE 23514 bei Update und Delete |

## 7. Statische und günstige Gates

| Gate | Ergebnis |
|---|---|
| fokussiertes ESLint | `PASS` |
| TypeScript `npx tsc --noEmit --pretty false` | `PASS` |
| `git diff --check` | `PASS` |
| fokussierter PDF.js-Pflichtfeld-Test | `PASS`, 1/1 Datei, 26/26 Tests (separat geprüft, nicht Teil von Receipt 215451) |
| fokussierte Unit-Tests | `PASS`, 2/2 Dateien, 17/17 Tests (separat geprüft, nicht Teil von Receipt 215451) |
| F1-R0 No-Fake-Production | `PASS`: `REACHABLE_PRODUCTION_MOCKS=0`, `UNREGISTERED_VISIBLE_CAPABILITIES=0`, `ACTIVE_CAPABILITY_REAL_E2E=PASS` |
| W4 Cross-Module Read-Port Selftest | `PASS`, 10 Fälle |
| W4 Cross-Module Read-Port Contract | `PASS`, 640 Dateien, 21 Read-Ports |
| unabhängiger P0/P1-Delta-Review vor Realitätslauf | `PASS`, keine offenen P0/P1-, Scope- oder False-Pass-Befunde |
| unabhängiger Runner-Review | `PASS`, kein P0/P1-, False-Pass- oder Ressourcenrisiko |

Die Unit-Tests verwenden ausschließlich isolierte Test-Doubles. Sie sind
kein Abnahmebeleg und werden nicht als Real-E2E ausgegeben.

## 8. Maschinenlesbarer Stand

```text
REAL_E2E_PATH=e2e/f1-4-immutable-invoice.real.spec.ts; PASS
SUPABASE_RESET_AND_MIGRATIONS=PASS
PRODUCTION_PATH_MOCKS=NONE
ACCEPTANCE_PATH_MOCKS=NONE
WRITE_RECEIPT=PASS
READBACK_RECEIPT=PASS
BROWSER_PROOF=PASS
NEGATIVE_PROOF_REQUIRED_REAL_GATE_MATRIX=PASS
BUERO_BROWSER_CONTROL_ABSENT=PASS
BUERO_SERVER_FORBIDDEN_PROOF=FOCUSED_UNIT_PASS
UNAUTHENTICATED_PROOF=FOCUSED_UNIT_PASS
COMMIT_SHA=NOT_FROZEN
INDEPENDENT_LOCAL_GATE_REVIEW=PASS
INDEPENDENT_EXACT_SHA_REVIEW=NOT_RUN
REACHABLE_PRODUCTION_MOCKS=0
UNREGISTERED_VISIBLE_CAPABILITIES=0
ACTIVE_CAPABILITY_REAL_E2E=PASS
F1_4_STATUS=LOCAL_REAL_GATE_PASS_PENDING_FREEZE_CI
F1_5_STARTED=NO
```

F1.4 hat den realen lokalen Gate-Lauf mit unabhängiger Gate-/Receipt-Prüfung
bestanden. Offen bleiben ausschließlich Freeze, CI, PR-/Delivery-Prüfungen und
die unabhängige Exact-SHA-Abnahme.
