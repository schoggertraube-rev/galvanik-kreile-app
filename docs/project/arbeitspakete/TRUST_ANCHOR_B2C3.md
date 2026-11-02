# Trust-Anchor B2c3 – Lesepfad Wareneingangsbeleg für AP-01 Fassung 4.3 (einmalig, minimal)

Owner-Autorisierung: Siglinder, delegiert (U-223/U-231: „den besten und sichersten Weg“); Planungschat 02.11.2026 nachts. Muster: TA-B2c2 (#160).

## Warum
Prüfbefund 4.3 (3df3f72c, Preview l4gd7grs4, Dev A-2026-0009): Die Buchung schreibt korrekt (Auftrag, `intake_item.vorgang_id`, verwaiste weiter 4). Danach scheitert das Lesen des Belegs mit `ORDER_INTAKE_RECEIPT_INVALID`, die Auftragskarte öffnet nicht. Ursache (Planungschat gegen Code und Dev belegt): `readOrderIntakeReceipt` in `src/lib/server/orderIntakeRead.ts` selektiert `intake_term_status` und `intake_source` nicht, `mapReceipt` prüft sie aber (`undefined !== null` → ungültig). Die View `private.v_order_intake_receipts_v1` hat beide Spalten. Der Fehler liegt im kanonischen Lesepfad; ein Ausweichen davor wäre eine zweite Wahrheit. Die Datei fehlt in der B2-Allowlist.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2c3` von main, sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um exakt `src/lib/server/orderIntakeRead.ts` und `src/lib/server/__tests__/orderIntakeRead.test.ts`.
2. Anker-Ausnahme TA-B2c3 nach Muster TA-B2c2 (Branch `codex/ta-b2c3`, Basis fest auf main-SHA beim Anlegen; Allowlist `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2C3.json`, Checker, `src/test/live_package_scope.test.ts`).
3. Selbsttest: beide Pfade erlaubt; Datei außerhalb abgelehnt.
4. Planungsdateien: nur diese Datei. `_review/NACHTLAUF_2026-11-02.md` und die Änderung an `_review/AKTUELLE_ANWEISUNG.md` im Arbeitsbaum **nicht** mitnehmen.
5. Probe vor Push: geänderter Checker lokal gegen den kompletten AP-01-4.3-Stand mit Fix → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

## Fix in AP-01 4.3 (auf `kreile/b2-eingang`, erst nach Merge dieses Ankers pushen)
- SELECT in `readOrderIntakeReceipt` um `intake_term_status, intake_source` ergänzen; sonst nichts am Lesepfad.
- Regressionstest in `orderIntakeRead.test.ts`: jede von `mapReceipt` geprüfte Spalte steht im SELECT (fehlt eine → rot).
- Echter Lauf auf Dev: A-2026-0009 öffnet; neue Buchung mit K-2026-0013 → Meldung „Wareneingang gebucht · {auftrag}“, Karte öffnet direkt; verwaiste `intake_item` bleiben 4.

Verboten: Workflows, h18-JSON, andere Checker, tsconfig, Mission, Migrationen, Produktcode im Anker, BAUPLAN.json.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.
