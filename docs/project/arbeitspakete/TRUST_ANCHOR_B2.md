# Trust-Anchor B2 — Gates von erledigtem B1 auf B2 stellen (Vorbedingung für AP-01)

Owner-Autorisierung: Siglinder, 31.10.2026 (delegiert an den Planungschat: „den besten und sichersten Weg"). Muster: Trust-Anchor PR154 (`ed0c6e33`), der am 30.10. erfolgreich lief.

## Warum
Die geschützten Gates auf main stehen noch auf Mission-Block **B1** (`kreile/b1-shell`). B1 ist über #154 erledigt und auf main. Der Lieferplan `docs/delivery/KREILE_VERKAUFSSTUFE_1.md` sieht als nächsten Block **B2** vor (u. a. „KV → Auftrag, Foto/Dokument"). Der Eingang (Owner-Freigabe F1, spec 403d1b31ad24) beginnt dort mit AP-01. Ohne Fortschreibung lehnen die Gates jede neue Arbeit ab (BLOCKER.md AP-01). Kein Gate wird gelockert — es wird nur der erledigte Block durch den nächsten ersetzt, mit expliziter Pfadliste.

## Genau diese Änderungen, sonst nichts
1. `missions/F1_ORDER_TO_CASH_PILOT_001.yml`: `active_block: B2`, `branch: kreile/b2-eingang`, `started_from_sha:` = main-SHA zum Anker, `handoff_path: docs/delivery/AENDERUNGEN_B2.md`, `next_block: B3`, Termine nach Lieferplan B2 (02.11.–08.11.2026). Übrige Felder (writer_count, reviewer, merge/production/cost_rule) unverändert.
2. `scripts/quality/check-live-package-scope.mjs`: Block B2 analog zu B1 einführen — `SALES_STAGE_B2_BRANCH = "kreile/b2-eingang"`, `SALES_STAGE_B2_ALLOWLIST`, Prüfung analog `checkSalesStageB1Scope`, gewählt über `mission.active_block`. Der B1-Zweig gilt nicht mehr für neue Arbeit. Die PR154-Prüfung bleibt unverändert.
   `SALES_STAGE_B2_ALLOWLIST` (eng, nur AP-01; weitere B2-Pakete erweitern sie je Paket per gleichem Verfahren):
   - `docs/delivery/AENDERUNGEN_B2.md`, `docs/project/arbeitspakete/**`, `docs/evidence/live-line/b2/**`
   - `src/modules/eingang/**`, `src/app/actions/eingang.actions.ts`
   - `src/app/GlobalCreateAppAdapter.tsx`, `src/app/layout.tsx`, `src/components/layout/GlobalCreateFlow.tsx`, `src/components/layout/globalCreateRequest.ts`
   - `src/lib/server/intakeDraft.ts`, `src/app/actions/intakeDraft.actions.ts`, `src/components/home/OfficeHome.tsx`, `src/lib/server/todayDashboard.ts`
   - `src/test/**`, `e2e/**`
   - Datenmodell: genau EINE neue Datei `supabase/migrations/<Zeitstempel>_ap01_intake_item.sql`; bestehende Migrationen dürfen nicht geändert werden (B1-Regel „DATA_MODEL_FORBIDDEN" gilt für alles andere weiter).
   - Falls `check-module-gates.mjs` eine Modul-Registrierung braucht, die zugehörige Registry-Datei für `eingang` hier mit aufnehmen.
3. Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR.json` analog `docs/evidence/live-line/pr154/REBASELINE.json`: `schemaVersion: 1`, `package: "B2-EINGANG-AP01"`, `headBranch: "kreile/b2-eingang"`, `mainBaseSha`, `authorizedBy: "Siglinder"`, `authorizedAt: "2026-10-31"`, `scope: "AP-01 laut docs/project/arbeitspakete/WORKQUEUE.json"`.
4. Planungsdateien des Planungschats unverändert übernehmen: `_review/AKTUELLE_ANWEISUNG.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`.
5. `src/test/live_package_scope.test.ts` erweitern: B2-Branch mit Allowlist grün; Pfad außerhalb rot; zweite/geänderte Migration rot; B1-Branch für neue Arbeit rot; PR154-Fall unverändert grün.

## Verboten im Anker
Kein Produktcode unter `src/` (außer Tests aus Punkt 5), keine Änderung an `orderIntakeCommand.ts`, kein Lockern anderer Gates (quality, ratchet, agentur-gate, replay, module-gates-Regeln), keine Änderung bestehender Migrationen.

## Verfahren
Wie beim PR154-Anker: Anker-Änderungen als eigener, vom Produktcode getrennter Schritt **vor** AP-01; Codex wählt die technisch belastbare Form (eigener Anker-PR oder erster Commit des B2-PR) und begründet sie in der Abgabe. CI vollständig grün. **Merge nur durch die Owner.** Danach AP-01 auf `kreile/b2-eingang` frisch von main.
