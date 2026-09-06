# KREILE — ARCHITEKTUR „PATH 1": Modulbauweise (verbindliche Bauanleitung)

Status: Owner-Entscheid 2026-09-06 = **Path 1** (forkbare Module sind echte Anforderung). Diese Datei erzwingt und konkretisiert AGENTS.md / D-ARCH-007. **Sie ist die Bauanleitung: Ein neuer Chat liest sie ZUERST und weiß WAS / WIE / WARUM — ohne Rückfrage an den Owner.** Bei Widerspruch gilt diese Datei über ältere UI-/Struktur-Notizen.

## 0. Warum (P1-Architektur-Drift, siehe LINIE D-ARCH-008)
Belegter Ist-Zustand (02_app, 1341 Dateien): keine Modul-Einheit — eine Domäne ist über `src/app/<route>` + `src/components/<fach>` + `src/lib/<fach>` (+ teils `src/features/`) verschmiert. Modul-Manifest ~3 % adoptiert (genau 1 von ~30 Domänen: `erfassung` v0.1.0). Grenzen nur negativ (ESLint no-import) und nur auf `lib/`, als Ratsche „0 bestehende Verstöße" — Isolation, keine Komponierbarkeit. Tenant-Literal `'galvanik-kreile'` 65× in 23 Dateien (verletzt D-ARCH-007 „tenant-neutral"). Folge: aus diesem Stand entstehen KEINE wiederverwendbaren Module; „stabilisieren, später extrahieren" wird pro Woche teurer. Entscheid: **Nähte JETZT, inkrementell, naht-zuerst.** Kein Neustart — die korrekte Domänen-Logik bleibt und bekommt Nähte, während wir sie anfassen.

## 1. Definition „Modul" (verbindlich)
Ein Modul = EIN Ordner `src/modules/<fach>/`, der ALLES seines Fachs besitzt:
`ui/` · `server/` (commands/actions) · `api/` (route-handler) · `db/` (Migrations-Referenzen + `v_*`-View-Verträge) · `<fach>.manifest.json` · `public.ts` (Fassade).
Nichts vom Fach liegt außerhalb. Keine Parallel-Ablage in `components/<fach>` / `lib/<fach>` / `app/<fach>` mehr.

## 2. Die fünf Nähte — jede CI-ERZWUNGEN, nicht Prosa
**Ausführbar seit S1:** `npm run quality:module-gates` = `scripts/quality/check-module-gates.mjs`. Läuft in `quality.yml` (Kandidatensicht) UND geschützt in `eslint-ratchet.yml` (Basis-Skript + Basis-Baseline + Basis-Schema gegen den Kandidatenbaum — ein PR kann das Gate nicht durch Ändern von Skript/Baseline/Schema umgehen). Beweis, dass jede Naht bei Verstoß rot wird: `src/test/s1_module_gates.test.ts`.
1. **Manifest je Modul** (nicht 1 total): `src/modules/<fach>/<fach>.manifest.json` nach `docs/architecture/MODULE_MANIFEST.schema.json` (`publicExports`, `ownsTables`, `viewsFunctions`, `events`, `migrations`). CI: `moduleId` == Ordnername, `public.ts` vorhanden, jeder `publicExports`-Eintrag = `@/modules/<fach>/public#Symbol` und von `public.ts` exportiert, `dependencies` = existierende Module, **Ablage:** kein `src/{app,components,lib,features,hooks,contexts}/<fach>` mehr, sobald das Modul existiert.
2. **Positive Fassade:** Quer-Zugriff NUR über `src/modules/<fach>/public.ts`. Tiefimport von außen (`@/modules/x/server/...`, relativ `../x/server/...`, `import()`, `export * from`, `vi.mock`) = **CI-FAIL**; im eigenen Modul nur relative Imports. ESLint `no-restricted-imports` (`@/modules/*/*` außer `public`) gibt dasselbe sofort im Editor.
3. **Tenant injiziert:** einzige Quelle `src/lib/tenant.ts` (`KREILE_TENANT_SLUG`, S0); das Literal `'galvanik-kreile'` per ESLint VERBOTEN (Fehler). Spätere Naht je Modul: Injektion statt Konstante.
4. **Cross-Modul-Fakten NUR über `v_*`-Views + TS-Typen + Props.** CI: SQL unter `src/modules/<fach>/` darf `public.`/`private.`-Tabellen nur anfassen, wenn `ownsTables` sie dem Modul zuordnet; Fremdfakten nur über `public.v_*`, die in irgendeinem Manifest (`viewsFunctions`) deklariert sind.
5. **UI-Vertrag:** Startseite/Werkstatt = Phillip V4 (Heute-sichern-Kontroll-Home) + Aktionsleiste. Stationsband/Transport-Home = CI-FAIL: verworfene Bausteine (`WorkflowStrip`, `TabletTopFlowNav`, `TopWorkflowBar`, `WarendurchlaufStationNav`, `ThemeToggle`) und Texte („Station öffnen", „In Galvanik starten", „Als Nächstes") dürfen in keiner NEUEN Datei auftauchen. Die 12 Altlast-Dateien der Kill-Liste stehen in `quality/module-gates-baseline.json` — **shrink-only**, S2/S4 leeren sie. Referenz: `docs/project/linie/ui/` (kanonisch, siehe `00_UI_REFERENZ_KANONISCH.md`). Designtreue darüber hinaus = PL-Review (Prüfer ≠ Autor).

## 3. Kanon / Löschliste (aus Inventar 2026-09-06; vor Löschung je Verlinkungs-Check)
- **KANON (behalten → in Module überführen):** orders, customers, erfassung/intake, buchhaltung (rechnungen), quotes, kalender, admin, settings, telefonnotiz, api, actions, `ui/`-Primitive.
- **HOME (falsch → neu gegen Mock):** `warendurchlauf` (Stationsmodell) → `modules/werkstatt` (Phillip V4); `start` → Login/Einstieg; „Der Tag" (Rolf V8). Wiederverwenden: `components/home/*` (ImportantTodayPanel, DayTimeline, HomeKpiCard).
- **TOT/PARALLEL (nach Check löschen):** cockpit, kontrolle, performance, status, analyse, baeder; Leichen finanzen (06.), kunden-auftraege (06.); Falsch-Nav WorkflowStrip, TabletTopFlowNav, TopWorkflowBar, WarendurchlaufStationNav; zweites Theme ThemeProvider/ThemeToggle („Dunkel").

## 4. Baureihenfolge (naht-zuerst)
- **S0 Tenant-Fix (zuerst):** `src/lib/tenant.ts` + Lint-Verbot des Literals + alle Stellen migriert (Ausnahmen: `src/db/` Seeds, byte-gepinnter W4-Evidence-Test). **Gebaut: PR #75.**
- **S1 Gate:** Manifest-CI, Tiefimport = CI-FAIL, v_*-Daten-CI, UI-Contract-CI (Baseline shrink-only), AGENTS-Verweis auf diese Datei. **Gebaut: PR #75 (gleicher Branch, S0+S1).** **Vor S1 kein Feature-Bau.**
- **S2 Löschung Eimer 3** nach Verlinkungs-Prüfung.
- **S3 Muster-Modul:** `erfassung` (hat schon Manifest) vollständig nach `src/modules/erfassung/` inkl. `public.ts` — Vorlage für alle.
- **S4 Home neu:** `src/modules/werkstatt` gegen Phillip V4; `warendurchlauf`-Stationsmodell gelöscht.
- **S5 restliche Domänen** Modul für Modul, jeweils Naht mitbauend.
- **F1.5** wurde mit Owner-Mandat vor S1 gemerged (#73, 2026-09-06; Red-Team PASS, Tenant-Literale in S0 nachgezogen). Ab S1 gilt ohne Ausnahme: **kein Feature-Bau, der die Naht-Gates rot lässt.**

## 5. Abnahmetest = „sauber"
Ein frischer Chat mit NUR diesem Repo kann widerspruchsfrei sagen: welches Modul, welche Naht, welcher nächste Schritt — ohne Owner-Rückfrage. CI lässt NICHT grün: einen Tiefimport, ein Tenant-Literal, ein Stationshome, ein manifestloses Modul, eine Domäne mit Ablage außerhalb ihres Modulordners.
