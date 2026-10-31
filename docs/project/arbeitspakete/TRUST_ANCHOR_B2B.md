# Trust-Anchor B2b — vollständiger AP-01-Scope + H18-Inventar + Akzeptanztests in CI (einmalig, dauerhaft)

Owner-Autorisierung: Siglinder, 31.10.2026 (delegiert: „den besten und sichersten Weg"). Muster: TA-B2 (#156).

## Warum (vollständige Ursachenanalyse des Planungschats, nicht nur der erste Fund)
1. Jede neue Server-Action muss im H18-Inventar `scripts/quality/h18-server-actions.json` stehen (sonst H18 rot). Die Datei fehlt in der B2-Allowlist.
2. **Kein CI-Schritt führt Akzeptanztests aus.** DB-Tests laufen nur aus fest verdrahteten Listen. Ohne diesen Schritt würde kein Akzeptanztest je wirklich in CI laufen — grün wäre vorgetäuscht.
3. Der Akzeptanztest wurde deshalb vom Planungschat neu gefasst: H18-Harness (echte signierte Sitzung, gleicher Umgebungsschutz wie im CI-Job), Endung `.integration.test.ts` (der Unit-Lauf schließt ihn so aus), Aufruf in der von H18 erkannten Form. **Er ist zugleich der H18-Nachweis** — kein zusätzlicher Test durch Codex (Prüfer ≠ Bauer, eine Wahrheit).
4. Der vollständige lokale AP-01-Diff zeigt zusätzliche bestehende Konsumenten-, UI- und Regressionstest-Pfade. Die B2-Allowlist nennt jeden davon exakt; nur das neue Modul behält `src/modules/eingang/**` als Paketgrenze.
5. Endversion spec `5ac4d4b5ea34` ersetzt nur die Beschriftung von Seite 3.0 durch „Neu erfassen“ und das Symbol der Foto-Anschlussstelle. Der Bauplan wird bytegleich mit SHA-256 `6E5E4EA663783F28C7A6ED1A8EF2017FAD1F8DA0458CC8A2670E6F1863453F77` geliefert.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2b`, sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`:
   - `SALES_STAGE_B2_ALLOWLIST` auf den vollständigen, lokal belegten AP-01-Diff fortschreiben: jeder bestehende Pfad exakt, nur `src/modules/eingang/**` als Modulglob.
   - Anker-Ausnahme TA-B2b nach Muster TA-B2: Branch `codex/ta-b2b`, Basis fest auf den main-SHA beim Anlegen (`ac6c1d2a…`), Allowlist zusätzlich exakt `docs/project/endversion/codex/BAUPLAN.json`; Pflichtdateien, Bauplan-Hash und Belegwerte fest geprüft.
   - Selbsttest ergänzen: jeder AP-01-Pfad im B2-Scope erlaubt; Bauplan nur im TA-B2b-Anker erlaubt; Datei außerhalb der TA-B2b-Allowlist abgelehnt. Mission bleibt unverändert B2. Bestehende TA-B2-/PR154-Prüfungen unverändert.
2. `.github/workflows/agentur-gate.yml`, im Replay-DB-Job direkt nach „H18 real Server Actions against replay DB" ein neuer Schritt mit **exakt demselben env-Block**:
   ```yaml
         - name: Acceptance tests against replay DB (all packages)
           env:
             DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
             H18_EXPECTED_DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
             SUPABASE_SERVICE_ROLE_KEY: ""
           run: npx vitest run src/test/acceptance/ --passWithNoTests --maxWorkers=1 --no-file-parallelism
   ```
   Damit läuft jeder künftige Akzeptanztest unter `src/test/acceptance/` automatisch gegen die Replay-DB — keine weitere Workflow-Änderung pro Paket.
3. Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2B.json` (Schema wie `TRUST_ANCHOR.json`, `package: "B2-EINGANG-AP01-INFRA"`, `headBranch: "codex/ta-b2b"`, `mainBaseSha`, `authorizedBy: "Siglinder"`, `authorizedAt: "2026-10-31"`).
4. `src/test/live_package_scope.test.ts` entsprechend erweitern.
5. Planungsdateien übernehmen (`docs/project/arbeitspakete/**` inkl. neuem Akzeptanztest `ap01_eingang_paket_persoenlich.integration.test.ts.txt`, PAKET.md Fassung 3, WORKQUEUE.json, dieser Datei; `_review/*` des Planungschats) und `docs/project/endversion/codex/BAUPLAN.json` bytegleich mit dem gebundenen Hash liefern.

## Verboten im Anker
Kein Produktcode; keine Änderung an `h18-server-actions.json` selbst (die kommt mit der Action in AP-01), `check-h18-server-actions.mjs`, `check-delivery-contracts.mjs`, `check-authoritative-sources.mjs`, `quality.yml`, `eslint-ratchet.yml`, `tsconfig.json`, Mission, Migrationen. Der Bauplan ist reine gebundene Endversion-Dokumentation. Kein Lockern einer Regel.

## Erwarteter CI-Stand vor dem Merge (einmalige Owner-Ausnahme wie TA-B2)
- Rot erlaubt: **nur** der Ratchet-Job, und nur an einem Schritt, der Byte-Gleichheit geschützter Governance-Dateien mit main verlangt (erwartet: „Package-scope checker is not the protected-base checker"). Log-Zeile beilegen. Jede andere rote Stelle → stopp.
- Grün Pflicht: quality, agentur-gate (inkl. neuem Akzeptanz-Schritt mit „no tests"), Fresh-Supabase-Replay, h16-schema; lokale A11-Strecke.
- Planungschat prüft Diff + Logs vor dem Owner-Merge; danach main vollständig grün, sonst Revert-PR.
