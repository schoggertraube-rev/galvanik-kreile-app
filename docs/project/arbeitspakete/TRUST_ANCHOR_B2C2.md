# Trust-Anchor B2c2 – ein Pfad für AP-01 Fassung 4.3 (einmalig, minimal)

Owner-Autorisierung: Siglinder, 02.11.2026 (U-231, delegiert). Muster: TA-B2c (#159).

## Warum
AP-01 Fassung 4.3: Buchen scheiterte auf Dev, weil `createOrderIntake` Privatkunden ohne Ansprechpartner abweist. Laut `formulare.kunde.vollstaendigkeit` gilt „Ansprechpartner“ nur für Firmen. Die Regel muss **in** `orderIntakeCommand.ts` korrigiert werden; ein Ausweichen davor würde eine zweite Regel erzeugen (eine Wahrheit). Die Datei fehlt in der B2-Allowlist.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2c2` von main, sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um exakt `src/lib/server/commands/orderIntakeCommand.ts` und `src/lib/server/commands/__tests__/orderIntakeCommand.test.ts`.
2. Anker-Ausnahme TA-B2c2 nach Muster TA-B2c (Branch `codex/ta-b2c2`, Basis fest auf main-SHA beim Anlegen; Allowlist `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2C2.json`, Checker, `src/test/live_package_scope.test.ts`).
3. Selbsttest: beide Pfade erlaubt; Datei außerhalb abgelehnt.
4. Planungsdateien aus dem Arbeitsbaum unverändert mitnehmen (alle uncommitteten Änderungen unter `docs/project/arbeitspakete/**` und `_review/**`).
5. Probe vor Push: geänderter Checker lokal gegen den kompletten AP-01-4.3-Stand (6bca5f68) → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

Verboten: Workflows, h18-JSON, andere Checker, tsconfig, Mission, Migrationen, Produktcode, BAUPLAN.json.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.
