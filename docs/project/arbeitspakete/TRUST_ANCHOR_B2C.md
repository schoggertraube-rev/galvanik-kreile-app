# Trust-Anchor B2c – Bauplan 6b782924 + B2-Allowlist für AP-01 F4 und Folgepakete (einmalig)

Owner-Autorisierung: Siglinder, 01.11.2026 (U-225, delegiert: „den besten und sichersten Weg“). Muster: TA-B2b (#157). Ersetzt die Fassung vom 01.11. nachts.

## Warum
1. Bauplan spec `6b782924134c` (BAUPLAN.json SHA-256 `225B7FB5D3503522D8BC972E535CE53827E4047F75932B18E52E7B905CB35305`) muss vor AP-01 F4 auf main.
2. AP-01 F4 braucht einen zweiten Akzeptanztest und eine Prüffunktion im Kundenmodul; beide Pfade fehlen in der B2-Allowlist.
3. Jedes Folgepaket bringt einen Akzeptanztest und eine Abgabe – dafür zwei enge Muster statt eines Ankers je Paket.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2c` von main, sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um exakt:
   - `src/test/acceptance/*.integration.test.ts`
   - `docs/delivery/ABGABE_AP-*.md`
   - `src/modules/customers/orderReadiness.ts`
   - `src/modules/customers/__tests__/orderReadiness.test.ts`
   - `src/modules/customers/public.ts`
   - `src/components/communication/CommunicationPanel.tsx` (nur falls der Mail-Einstieg aus „Der Tag“ dort andockt; sonst weglassen)
   - jeden weiteren Pfad aus `git diff --name-only main` des **lokal fertig gebauten** AP-01 F4 (Probe wie bei #157), exakt.
   - Anker-Ausnahme TA-B2c nach Muster TA-B2b: Branch `codex/ta-b2c`, Basis fest auf den main-SHA beim Anlegen; Allowlist exakt `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, `docs/project/endversion/codex/BAUPLAN.json`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2C.json`, Checker, `src/test/live_package_scope.test.ts`; Bauplan-Hash fest geprüft.
2. Selbsttest: Muster erlauben `src/test/acceptance/ap01b_….integration.test.ts` und `docs/delivery/ABGABE_AP-K1.md`; lehnen `src/test/acceptance/x.test.ts`, `src/test/x.integration.test.ts`, `docs/delivery/ABGABE_B3.md` ab; Bauplan nur im TA-B2c-Anker erlaubt; Datei außerhalb der Anker-Allowlist abgelehnt.
3. Bauplan bytegleich (SHA oben), Planungsdateien aus dem Arbeitsbaum unverändert (AP-01 PAKET Fassung 4 + `ap01b_…ts.txt`, AP-02-Ordner, WORKQUEUE, dieser Anker, `_review`).
4. Probe vor Push: geänderter Checker lokal gegen den kompletten AP-01-F4-Stand → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

Verboten: Workflows, h18-JSON, andere Checker, tsconfig, Mission, Migrationen, Produktcode.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt („Package-scope checker is not the protected-base checker“).
