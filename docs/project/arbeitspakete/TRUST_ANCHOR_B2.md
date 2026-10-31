# Trust-Anchor B2 — Gates von erledigtem B1 auf B2 stellen (Vorbedingung für AP-01)

Fassung 2 vom 31.10.2026 (nach Codex-Befund: zweiter Checker `check-delivery-contracts.mjs` hat B1 fest eingebaut).
Owner-Autorisierung: Siglinder, 31.10.2026 (an den Planungschat delegiert: „den besten und sichersten Weg"). Muster: Trust-Anchor PR154 (`ed0c6e33`).

## Warum
Mission, Scope-Gate und Delivery-Gate stehen auf Block **B1** (`kreile/b1-shell`). B1 ist über #154 erledigt. Der Lieferplan `docs/delivery/KREILE_VERKAUFSSTUFE_1.md` sieht als nächsten Block **B2** vor; der Eingang (F1, spec 403d1b31ad24) beginnt dort mit AP-01. Kein Gate wird gelockert: B2 erhält exakt dieselben festen Prüfungen wie B1, nur mit B2-Werten.

## Vollständige B1-Verdrahtung auf main (Planungschat-Suche 31.10.)
- `missions/F1_ORDER_TO_CASH_PILOT_001.yml` (Zeilen 8, 10, 15)
- `scripts/quality/check-live-package-scope.mjs` (101, 132–133, 263–273, Selbsttest 892–901)
- `scripts/quality/check-delivery-contracts.mjs` (553, 558)
- `scripts/quality/check-authoritative-sources.mjs` (263, erlaubte Dateien in `docs/delivery`) → wird **nicht** geändert (zusätzlich per Hash im Workflow gepinnt). Stattdessen heißt die B2-Übergabe `docs/delivery/ABGABE_B2.md` und passt auf das bereits erlaubte Muster `ABGABE_*.md`.

## Genau diese Änderungen in EINEM PR, sonst nichts
1. **Mission** `missions/F1_ORDER_TO_CASH_PILOT_001.yml`: `active_block: B2`, `phase: WRITING`, `branch: kreile/b2-eingang`, `started_from_sha` = main-SHA zum Anker, `handoff_path: docs/delivery/ABGABE_B2.md`, `next_block: B3`, Termine nach Lieferplan B2 (02.11.–08.11.2026). Geschlossenes Schema (gleiche Schlüssel), übrige Felder unverändert.
2. **Scope-Gate** `scripts/quality/check-live-package-scope.mjs`: B1-Konstanten/-Prüfung durch B2 ersetzen (`SALES_STAGE_B2_BRANCH = "kreile/b2-eingang"`, `SALES_STAGE_B2_ALLOWLIST`, Prüfung wie bisher über `mission.active_block`), Selbsttest auf B2 umstellen; PR154-Prüfung unverändert. Allowlist (eng, nur AP-01; weitere B2-Pakete erweitern sie je Paket im gleichen Verfahren):
   - `docs/delivery/ABGABE_B2.md`, `docs/delivery/ABGABE_AP-01.md`, `docs/project/arbeitspakete/**`, `docs/evidence/live-line/b2/**`
   - `src/modules/eingang/**`, `src/app/actions/eingang.actions.ts`
   - `src/app/GlobalCreateAppAdapter.tsx`, `src/app/layout.tsx`, `src/components/layout/GlobalCreateFlow.tsx`, `src/components/layout/globalCreateRequest.ts`
   - `src/lib/server/intakeDraft.ts`, `src/app/actions/intakeDraft.actions.ts`, `src/components/home/OfficeHome.tsx`, `src/lib/server/todayDashboard.ts`
   - `src/test/**`, `e2e/**`
   - Datenmodell: genau EINE neue Datei `supabase/migrations/<Zeitstempel>_ap01_intake_item.sql`; bestehende Migrationen nicht änderbar (DATA_MODEL_FORBIDDEN gilt sonst weiter).
3. **Delivery-Gate** `scripts/quality/check-delivery-contracts.mjs`: Mission-Erwartung von B1 auf B2 (`active_block "B2"`, `phase "WRITING"`, `branch "kreile/b2-eingang"`, `handoff_path "docs/delivery/ABGABE_B2.md"`, `next_block "B3"`). Alle anderen Prüfungen (Schema, Identität, Plan-Bindung, Review-Trennung, Owner-Regeln, Claude-Settings) unverändert und gleich streng.
4. **Beleg** `docs/evidence/live-line/b2/TRUST_ANCHOR.json` analog `docs/evidence/live-line/pr154/REBASELINE.json` (`package: "B2-EINGANG-AP01"`, `headBranch: "kreile/b2-eingang"`, `mainBaseSha`, `authorizedBy: "Siglinder"`, `authorizedAt: "2026-10-31"`).
5. **Tests** `src/test/live_package_scope.test.ts` und der Test des Delivery-Gates: B2 grün; Pfad außerhalb rot; zweite/geänderte Migration rot; B1-Mission/Branch für neue Arbeit rot; PR154-Fall unverändert grün.
6. **Planungsdateien** unverändert übernehmen (`_review/AKTUELLE_ANWEISUNG.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `docs/project/arbeitspakete/**` inkl. dieser Fassung 2).

## Verboten im Anker
Kein Produktcode unter `src/` außer Tests (Punkt 5); keine Änderung an `check-authoritative-sources.mjs`, `quality/authoritative-sources.json`, `.github/workflows/**`, `check-module-gates.mjs`, `orderIntakeCommand.ts`, bestehenden Migrationen; kein Lockern irgendeiner Regel.

## Erwarteter CI-Stand vor dem Merge (einmalige Owner-Ausnahme)
- Rot erlaubt: **nur** der Ratchet-Job am Schritt „Delivery checker hash is not the protected-base checker" (und damit unerreichbar dahinter der Scope-Hash). Nachweis per Log-Zeile.
- Grün Pflicht: quality, agentur-gate, Fresh-Supabase-Replay, h16-schema, sowie lokal: Selbsttests beider neuen Checker, `live_package_scope`-/Delivery-Tests.
- Planungschat prüft Diff und Logs vor dem Owner-Merge. Owner merged mit Übersteuerung. Direkt danach Lauf auf main: muss vollständig grün sein (beide Checker), sonst Revert-PR.
