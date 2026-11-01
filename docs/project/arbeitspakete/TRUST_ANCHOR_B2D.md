# Trust-Anchor B2d – Bauplan c82bf2d6 + B2-Allowlist für AP-K1 (einmalig)

Owner-Autorisierung: Siglinder, 01.11.2026 (U-227, delegiert). Muster: TA-B2b/TA-B2c. Erst nach Merge von AP-01 F4 (#158).

## Warum
1. AP-K1 baut nach Bauplan spec `c82bf2d6d880`. Der Endversion-Chat hat ihn nach U-226 in `docs/project/endversion/codex/BAUPLAN.next.json` abgelegt (SHA-256 `1D2A62680FDCCBE6E40D2802D629972F77747BCAD0ED5FF7101D761FB3FF9DDA`); mit diesem Anker wird er zu `BAUPLAN.json` (bytegleicher Inhalt, Dateiname BAUPLAN.json). `BAUPLAN.next.json` und `BAUPLAN_LIESMICH.next.md` kommen nicht ins Repo.
2. AP-K1 ändert das Kundenmodul und alle Leser von `contact_person`; diese Pfade fehlen in der B2-Allowlist.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2d` von main, sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um exakt jeden Pfad aus `git diff --name-only main` des **lokal fertig gebauten** AP-K1 (Probe wie bei #157), dazu `supabase/migrations/*_b2_kunde_k1.sql`. Keine weiteren Globs.
2. Anker-Ausnahme TA-B2d nach Muster TA-B2c (Branch `codex/ta-b2d`, Basis fest auf main-SHA beim Anlegen; Allowlist `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, `docs/project/endversion/codex/BAUPLAN.json`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2D.json`, Checker, `src/test/live_package_scope.test.ts`; Bauplan-Hash fest geprüft).
3. Selbsttest für die neuen Pfade; Datei außerhalb der Anker-Allowlist abgelehnt.
4. Planungsdateien aus dem Arbeitsbaum unverändert (AP-K1-Ordner, WORKQUEUE, dieser Anker, `_review`).
5. Probe vor Push: geänderter Checker lokal gegen den kompletten AP-K1-Stand → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

Verboten: Workflows, h18-JSON, andere Checker, tsconfig, Mission, Migrationen, Produktcode.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.
