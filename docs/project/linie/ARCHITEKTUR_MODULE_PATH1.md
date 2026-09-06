# KREILE — ARCHITEKTUR „PATH 1": Modulbauweise (verbindliche Bauanleitung)

Status: Owner-Entscheid 2026-09-06 = **Path 1** (forkbare Module sind echte Anforderung). Diese Datei erzwingt und konkretisiert AGENTS.md / D-ARCH-007. **Sie ist die Bauanleitung: Ein neuer Chat liest sie ZUERST und weiß WAS / WIE / WARUM — ohne Rückfrage an den Owner.** Bei Widerspruch gilt diese Datei über ältere UI-/Struktur-Notizen.

## 0. Warum (P1-Architektur-Drift, siehe LINIE D-ARCH-008)
Belegter Ist-Zustand (02_app, 1341 Dateien): keine Modul-Einheit — eine Domäne ist über `src/app/<route>` + `src/components/<fach>` + `src/lib/<fach>` (+ teils `src/features/`) verschmiert. Modul-Manifest ~3 % adoptiert (genau 1 von ~30 Domänen: `erfassung` v0.1.0). Grenzen nur negativ (ESLint no-import) und nur auf `lib/`, als Ratsche „0 bestehende Verstöße" — Isolation, keine Komponierbarkeit. Tenant-Literal `'galvanik-kreile'` 65× in 23 Dateien (verletzt D-ARCH-007 „tenant-neutral"). Folge: aus diesem Stand entstehen KEINE wiederverwendbaren Module; „stabilisieren, später extrahieren" wird pro Woche teurer. Entscheid: **Nähte JETZT, inkrementell, naht-zuerst.** Kein Neustart — die korrekte Domänen-Logik bleibt und bekommt Nähte, während wir sie anfassen.

## 1. Definition „Modul" (verbindlich)
Ein Modul = EIN Ordner `src/modules/<fach>/`, der ALLES seines Fachs besitzt:
`ui/` · `server/` (commands/actions) · `api/` (route-handler) · `db/` (Migrations-Referenzen + `v_*`-View-Verträge) · `<fach>.manifest.json` · `public.ts` (Fassade).
Nichts vom Fach liegt außerhalb. Keine Parallel-Ablage in `components/<fach>` / `lib/<fach>` / `app/<fach>` mehr.

## 2. Die fünf Nähte — jede CI-ERZWUNGEN, nicht Prosa
1. **Manifest je Modul** (nicht 1 total): `publicExports`, `events`, `migrations`, `views` nach `MODULE_MANIFEST.schema.json`. CI: jedes Modul MUSS ein valides Manifest haben, sonst FAIL.
2. **Positive Fassade:** Quer-Zugriff NUR über `src/modules/<fach>/public.ts`. Tiefimport von außen (`modules/x/server/...`) = **BUILD-FEHLER** via `dependency-cruiser` / `import/no-internal-modules`.
3. **Tenant injiziert:** ein `TenantProvider`/Context; das Literal `'galvanik-kreile'` per ESLint VERBOTEN (Fehler); die 65 Fundstellen auf `useTenant()`/Injektion migriert.
4. **Cross-Modul-Fakten NUR über `v_*`-Views + TS-Typen + Props.** Kein Fremd-Tabellen-Direktzugriff.
5. **UI-Vertrag:** Startseite/Werkstatt = Phillip V4 (Heute-sichern-Kontroll-Home) + Aktionsleiste. Stationsband/Transport-Home = CI-FAIL. Referenz: `docs/project/linie/ui/` (kanonisch, siehe `00_UI_REFERENZ_KANONISCH.md`).

## 3. Kanon / Löschliste (aus Inventar 2026-09-06; vor Löschung je Verlinkungs-Check)
- **KANON (behalten → in Module überführen):** orders, customers, erfassung/intake, buchhaltung (rechnungen), quotes, kalender, admin, settings, telefonnotiz, api, actions, `ui/`-Primitive.
- **HOME (falsch → neu gegen Mock):** `warendurchlauf` (Stationsmodell) → `modules/werkstatt` (Phillip V4); `start` → Login/Einstieg; „Der Tag" (Rolf V8). Wiederverwenden: `components/home/*` (ImportantTodayPanel, DayTimeline, HomeKpiCard).
- **TOT/PARALLEL (nach Check löschen):** cockpit, kontrolle, performance, status, analyse, baeder; Leichen finanzen (06.), kunden-auftraege (06.); Falsch-Nav WorkflowStrip, TabletTopFlowNav, TopWorkflowBar, WarendurchlaufStationNav; zweites Theme ThemeProvider/ThemeToggle („Dunkel").

## 4. Baureihenfolge (naht-zuerst)
- **S0 Tenant-Fix (zuerst):** `TenantProvider` + Lint-Verbot des Literals + 65 Stellen migriert. Bounded, mechanisch.
- **S1 Gate:** Manifest-CI, `dependency-cruiser` build-fail, UI-Contract-CI, AGENTS-Verweis auf diese Datei. **Vor S1 kein Feature-Bau.**
- **S2 Löschung Eimer 3** nach Verlinkungs-Prüfung.
- **S3 Muster-Modul:** `erfassung` (hat schon Manifest) vollständig nach `src/modules/erfassung/` inkl. `public.ts` — Vorlage für alle.
- **S4 Home neu:** `src/modules/werkstatt` gegen Phillip V4; `warendurchlauf`-Stationsmodell gelöscht.
- **S5 restliche Domänen** Modul für Modul, jeweils Naht mitbauend.
- **F1.5 bleibt geparkt, bis S1 steht** (sonst wird weiter ins Loch gebaut).

## 5. Abnahmetest = „sauber"
Ein frischer Chat mit NUR diesem Repo kann widerspruchsfrei sagen: welches Modul, welche Naht, welcher nächste Schritt — ohne Owner-Rückfrage. CI lässt NICHT grün: einen Tiefimport, ein Tenant-Literal, ein Stationshome, ein manifestloses Modul, eine Domäne mit Ablage außerhalb ihres Modulordners.
