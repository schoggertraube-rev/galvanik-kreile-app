# Trust-Anchor B2e – Migrationspfad für AP-R (Einheit je Freitext-Position), einmalig, minimal

Owner-Autorisierung: Siglinder, delegiert (U-223/U-233/U-234); Planungschat 02.11.2026. Muster: TA-B2c3 (#161).

## Warum
AP-R verlangt nach `formulare.position.felder[einheit]` eine Pflicht-Einheit je Freitext-Position (Stück, kg, dm², Satz, Std.). Der Schreibweg nimmt sie an, die Beleg-View `private.v_order_intake_receipts_v1` verlangt bei Freitext-Positionen aber weiterhin `unit IS NULL` → jede solche Buchung wird mit `ORDER_INTAKE_RECEIPT_INVALID` zurückgerollt (Codex-Beleg, Fälle E07, E10, E11, E20). Die Regel muss **in** der View geändert werden; ein Ausweichen in Command oder Leser wäre eine zweite Wahrheit. Ein Migrationspfad dafür fehlt in der B2-Allowlist.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2e` von main, sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um genau das Muster `supabase/migrations/*_ap_r_freitext_einheiten.sql` (eine neue Datei; bestehende Migrationen bleiben gesperrt) **und** (Nachtrag 02.11. 20:40) exakt `src/lib/server/orderCardRead.ts` und `src/lib/server/__tests__/orderCardRead.test.ts` – der zweite kanonische Leser derselben Positionsregel (Auftragskarte), sonst bleiben E07/E10/E11 rot (`ORDER_CARD_INTAKE_ITEM_INVALID`).
2. Anker-Ausnahme TA-B2e nach Muster TA-B2c3 (Branch `codex/ta-b2e`, Basis fest auf main-SHA beim Anlegen; Allowlist `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2E.json`, Checker, `src/test/live_package_scope.test.ts`).
3. Selbsttest: das Muster erlaubt `supabase/migrations/20261103010000_ap_r_freitext_einheiten.sql`, lehnt jede andere neue oder geänderte Migration ab; Datei außerhalb der Anker-Allowlist abgelehnt.
4. Planungsdateien aus dem Arbeitsbaum unverändert mitnehmen (`docs/project/arbeitspakete/**`), **nicht** `_review/NACHTLAUF_2026-11-02.md`, kein Produktcode.
5. Probe vor Push: geänderter Checker lokal gegen den kompletten AP-G/AP-R-Stand mit der neuen Migration → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

Verboten: Workflows, h18-JSON, andere Checker, tsconfig, Mission, bestehende Migrationen, Produktcode, BAUPLAN.json.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.
