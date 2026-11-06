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
   - jeden weiteren Pfad aus der AP-EIN-Inventur (NACHTLAUF C, 02.11. 21:00, Teile 1–5 und Konflikte 9–10) **exakt**, insbesondere die Leser von `contact_person`, `country`, `rechnung_`, `shipping_preference`, `last_handover_mode`, `pickup_weekday`, die Leser von Einheit und Oberfläche (Karte, PDF, Rechnung; Entscheidung 2), die Der-Tag-Zeile (Zeilenklick), `src/modules/complaints/**`, `src/modules/tasks/**`, `src/modules/communications/**`, `src/modules/supplier-invoices/**` und `src/db/schema.ts` (Entscheidung 7).
3. `.github/workflows/agentur-gate.yml`: am Schritt „Generated BAUPLAN flows against replay DB“ die Zeile `if: ${{ hashFiles(...) ... }}` entfernen; sonst nichts.
4. Anker-Ausnahme TA-B2f nach Muster TA-B2d2 (Branch `codex/ta-b2f`, Basis fest auf main-SHA beim Anlegen; Allowlist `.github/workflows/agentur-gate.yml`, `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/MELDUNG_ENDVERSION_CHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, `docs/project/endversion/codex/BAUPLAN.json`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2F.json`, Checker, `src/test/live_package_scope.test.ts`; Bauplan-Hash fest geprüft).
5. `e2e/generated/**` neu erzeugt gegen den neuen Bauplan (Generator unverändert aus AP-G; Erweiterung kommt mit Teil 0) und `_erwartet_rot.json`: jeder rote Fall der 13 Paket-Seiten mit seinem Teil (`AP-EIN-1` … `AP-EIN-5`), Fälle mit noch nicht unterstützten Platzhaltern mit `AP-EIN-0`; Fälle anderer Seiten wie bisher.
6. Selbsttest: neue Muster erlaubt; Datei außerhalb abgelehnt; Bauplan nur in diesem Anker.
7. Probe vor Push: Checker lokal gegen die vollständige Inventur-Pfadliste und gegen den lokalen Vorbau von Teil 0/1 → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

Verboten: andere Workflow-Änderungen, h18-JSON, andere Checker, tsconfig, Mission, bestehende Migrationen, Produktcode.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.

## Fassung 2 (03.11. 15:30) – gilt vor Punkt 1–7, wo abweichend (ersetzt Nachtrag 12:45)
- **Bauplan:** SHA **AFB3D838967A2D1D3E21AF3C8E09AD91A288CB391CB975AFDE342F829B426B2E** (spec `9cd72e53bc69`) statt 361F8085; `e2e/generated/**` gegen diesen Stand neu (306 Fälle), Rot-Liste je Fall mit `AP-EIN-0b` … `AP-EIN-6`.
- **UI-Wahrheit im Anker (U-239), unverändert aus dem Arbeitsbaum:** `docs/project/endversion/ui/**` (inkl. `pruefbilder/`), `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` (= `CURRENT_DESIGN_REFERENCE.endversion.json`, 7D7B1FCA). Pinnt ein Quellenregister/Authority-Checker die alte Design-Referenz: Pin im selben Anker auf die neue Datei umstellen, sonst nichts daran.
- **Allowlist zusätzlich exakt:** `supabase/migrations/*_ein[0-6]_*.sql` (ersetzt `*_ein[2-5]_*`), `src/app/layout.tsx`, `src/app/globals.css`, `src/styles/**`, `src/ui/kr/**`, `docs/project/endversion/ui/routen.json` (einzige Datei im ui-Ordner, die Codex schreibt), die Seitenbereiche von Teil 6 (10.1 Warenausgang, Werkstatt, 8.1 Firmendaten, appweite Ebenen/Auto-Mail/Sperrkatalog) exakt nach Inventur – die Inventur dafür vor dem Push in C, Pfad für Pfad.
- **Probe:** Checker gegen den obersten AP-EIN-Branch inkl. Teil 0b → PASS; jede nicht erlaubte Datei in C, nicht still ergänzen.

## Fassung 3 (03.11. 16:30) – geht Fassung 2 vor
- **Kein Bauplanwechsel in TA-B2f** (Punkt 1 und Bauplan-Punkt aus Fassung 2 entfallen; neuer Bauplan mit Runde 51 als TA-B2g).
- Zusätzlich exakt: Neu-Pin `DESIGN_POINTER_SYSTEM_BINDING`/`_FLOW_BINDING`/`_PAGE_BINDING` auf `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` (neu); Hash-Pins in `.github/workflows/eslint-ratchet.yml`; `scripts/spec/generate-flow-tests.mjs`; ESLint-Ignore nur `docs/project/endversion/ui/**`.
- Basis: main nach Owner-Merge #163 und #164.

## Fassung 4 (03.11. 17:45) – geht Fassung 2/3 vor
- Bauplan **888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8** (spec `a9474e3f73c3`, Runde 51) **doch in TA-B2f** (kein eigener TA-B2g): `BAUPLAN.json` = `BAUPLAN.next.json` mit genau dieser SHA, `e2e/generated/**` neu, Rot-Liste je Fall mit `AP-EIN-0b` … `AP-EIN-6`.
- Sonst wie Fassung 3 (UI-Ordner + `CURRENT_DESIGN_REFERENCE.json` DE0FC765 unverändert, DESIGN_POINTER-Neupin, eslint-ratchet-Pins, Generator-Pfad, ESLint-Ignore nur `docs/project/endversion/ui/**`) und Allowlist aus Fassung 2.

## Fassung Runde 52 (03.11., 19:07) – geht allen früheren Fassungen vor
Bauplan **DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4** (spec `ee64f8882bb7`) als `BAUPLAN.json`, `e2e/generated/**` neu, Rot-Liste je Teil. UI-Ordner + `CURRENT_DESIGN_REFERENCE.json` (1509BE93) unverändert aus dem Arbeitsbaum. Sonst wie Fassung 3/4 (DESIGN_POINTER-Neupin, eslint-ratchet-Pins, Generator-Pfad, ESLint-Ignore nur `docs/project/endversion/ui/**`, Allowlist Fassung 2).

## Freigabe 03.11. 19:30 (Runde 52)
Zusaetzlich erlaubt: `quality/eslint-baseline.json` - **ausschliesslich** `judgeContractHash` von `d322170885867420ca489927b5ad52522206e06009c5afb619d5159d4147752b` auf `f02832e8e3da8367b3604c5f356b6df95fe61310a2c24d04d5b8105b582aab88` (Diff `.git/kreile-ta52-judge-migration.patch`, vom Planungschat geprueft: genau diese eine Zeile). Fehlerzahlen, Regeln, lintContractHash, Ausnahmen unveraendert; der Selbsttest muss jede weitere Aenderung an der Datei ablehnen.

## Fassung Runde 53 (05.11., 15:48) – geht allen früheren Fassungen vor
Bauplan **9491009F79E306370AD4DAC3886080E4B9AEAB9A2D8BD14AAAFBB0A31411C6DA** (spec `b6132498f47a`) als `BAUPLAN.json`, `e2e/generated/**` neu, Rot-Liste je Teil. UI-Ordner + `CURRENT_DESIGN_REFERENCE.json` (12288CE7) unverändert aus dem Arbeitsbaum. Sonst wie Fassung 3/4 (DESIGN_POINTER-Neupin, eslint-ratchet-Pins, Generator-Pfad, ESLint-Ignore nur `docs/project/endversion/ui/**`, Allowlist Fassung 2).
