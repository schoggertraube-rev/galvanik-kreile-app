# Galvanik-Kreile WerkstattCockpit — aktuelles Gate und Designfolge

## Aktives Gate

Der Slice-1-Implementierungsvertrag **V2.4** ist:

`CONTRACT_STATUS: PROPOSAL_ACCEPTED`

Grundlage: unabhängige Fremdprüfung mit Korrekturschleife — V2.3 `CONTRACT_VERDICT: FAIL` (F-38-01) → Korrektur V2.4 → Nachprüfung `CONTRACT_VERDICT_V24: PASS` (2026-07-06).
Autoritative Kopie: `00_AUTORITATIV/05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md` (byte-identisch zur akzeptierten Fassung).
Evidenz: `KREILE_PROJEKT_DOKUMENTATION/M6_EVIDENZ/` (36_, 37_, 38_).

**Noch keine Slice-1-Implementierung** — erst Claude-Design-Gate, dann einzeln freigegebene Baumissionen.

## Nächste Mission: Claude Design

1. Claude Design erhält ausschließlich:
   - akzeptierten Produkt-/Slice-Vertrag (01_PRODUCT_AND_SLICE_CONTRACT.md),
   - akzeptierten Implementierungsvertrag V2.4 (05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md),
   - User Twins Rolf, Philipp, Michael,
   - bestehende CI-/Designreferenzen.
2. Claude Design erstellt den UI-/Interaktionsvertrag für:
   - Capture online/offline,
   - Review nur bei Unsicherheit,
   - Wareneingangsabschluss,
   - routebasierte erste Produktionskarte,
   - Fehler, Retry, Konflikt, Korrektur und Rückkehr.
3. Design entscheidet keine Tabellen, RLS, Transaktionen oder Storage-Policies (die sind in V2.4 fixiert).
4. Erst danach beginnt die erste kleine Baumission.

## Baumissionen (gemäß V2.4 §9 — strikt sequenziell, je einzeln freigegeben und abgenommen)

1. **B1** Daten-/Storage-/Sicherheitsfundament (Migration, Drizzle-Lücken, RLS §7.1, Storage-RLS §7.2 neu, Service-Role-Bypass-Test; Restpunkt F-38-04)
2. **B2** Online-Capture und OCR/KI-Review (ersetzt Altpfade I-1/I-5-Capture, härtet I-3/I-6)
3. **B3** Transaktionale Auftragserstellung (ersetzt BEIDE Alt-Auftragspfade I-2 `convertScanToOrder` und I-5 `createOrderFromScan` — danach genau EIN Pfad)
4. **B4** Routebasierter Produktionsstart (Route statt Hardcode, SQL-Views; Restpunkt F-38-03 in B4-AK3)
5. **B5** Offline-Outbox und Reconnect (IndexedDB, kein TTL, Idempotenz)
6. **B6** Korrektur und Undo (abhängigkeitsbewusst)
7. **B7** Unabhängiger E2E-Verifier (Laufzeitbeweis Foto → Karte gegen Remote)

Verbindlich für jede Baumission: Ist-Pfad-Inventar V2.4 §2a (I-1…I-6, je „ersetzen/härten"), Akzeptanzkriterien inkl. Rollen-Negativtests über alle sechs realen Rollen, Evidenzpflicht (SSG-Referenzen), Remote-Unbelegtes bleibt SSG-00 bis zum Rohlog-Beweis.
