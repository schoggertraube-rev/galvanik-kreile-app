# Trust-Anchor B2f – Bauplan 21d0347a für AP-EIN + Pfade AP-EIN + Wege-Test-Schritt ohne Bedingung (einmalig)

Owner-Autorisierung: Siglinder, 02.11.2026 (U-234, U-236, U-237; „löse die offenen Punkte“, delegiert). Muster: TA-B2d2 (#162). Erst nach Merge von AP-G + AP-R.

## Warum
1. AP-EIN baut nach Bauplan spec `21d0347a3319` (SHA-256 `361F8085F38C7883055FBDC03368B1AB144DA39BC25945E41048D260DC6780F8`); er muss als `BAUPLAN.json` auf main, damit die erzeugten Wege-Fälle aller 13 Paket-Seiten in CI laufen.
2. AP-EIN ändert sechs Seitenbereiche; damit nicht je Teil ein Anker nötig ist, erlaubt dieser Anker die Paketgrenzen als Modul-Globs und jeden übrigen Pfad exakt aus der Inventur.
3. Auflage aus P22: Der Schritt „Generated BAUPLAN flows against replay DB“ läuft ab jetzt **immer** (ohne `if: hashFiles(...)`).

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2f` von main, sonst nichts
1. `docs/project/endversion/codex/BAUPLAN.json` = Inhalt von `BAUPLAN.next.json` mit genau der SHA oben (weicht sie ab: nicht übernehmen, in C melden).
2. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um:
   - `src/modules/eingang/**`, `src/modules/customers/**` und je ein Glob für jedes **neue** Modul, das die Inventur für 3.7, 3.9, 3.4, 2.3, 2.4, 4.8, 3.8 vorsieht (`src/modules/<name>/**`);
   - `supabase/migrations/*_b2_kunde_k1.sql` und `supabase/migrations/*_ein[2-5]_*.sql` (je Teil eine neue Datei; bestehende bleiben gesperrt);
   - App installierbar: `src/app/manifest.ts` (oder `public/manifest.webmanifest`) und `public/icons/**`;
   - jeden weiteren Pfad aus der AP-EIN-Inventur (NACHTLAUF C) **exakt**, insbesondere die Leser von `contact_person`, `country`, `rechnung_`, `shipping_preference`, `last_handover_mode`, `pickup_weekday`, die Der-Tag-Zeile (Zeilenklick) und das Fehlerprotokoll.
3. `.github/workflows/agentur-gate.yml`: am Schritt „Generated BAUPLAN flows against replay DB“ die Zeile `if: ${{ hashFiles(...) ... }}` entfernen; sonst nichts.
4. Anker-Ausnahme TA-B2f nach Muster TA-B2d2 (Branch `codex/ta-b2f`, Basis fest auf main-SHA beim Anlegen; Allowlist `.github/workflows/agentur-gate.yml`, `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/MELDUNG_ENDVERSION_CHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, `docs/project/endversion/codex/BAUPLAN.json`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2F.json`, Checker, `src/test/live_package_scope.test.ts`; Bauplan-Hash fest geprüft).
5. `e2e/generated/**` neu erzeugt gegen den neuen Bauplan (Generator unverändert aus AP-G; Erweiterung kommt mit Teil 0) und `_erwartet_rot.json`: jeder rote Fall der 13 Paket-Seiten mit seinem Teil (`AP-EIN-1` … `AP-EIN-5`), Fälle mit noch nicht unterstützten Platzhaltern mit `AP-EIN-0`; Fälle anderer Seiten wie bisher.
6. Selbsttest: neue Muster erlaubt; Datei außerhalb abgelehnt; Bauplan nur in diesem Anker.
7. Probe vor Push: Checker lokal gegen die vollständige Inventur-Pfadliste und gegen den lokalen Vorbau von Teil 0/1 → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

Verboten: andere Workflow-Änderungen, h18-JSON, andere Checker, tsconfig, Mission, bestehende Migrationen, Produktcode.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.
