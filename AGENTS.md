# Kreile-WerkstattCockpit – verbindlich für Codex (ab 11.11.2026, zwei Schreiber ab 24.11.2026)

Arbeitsort ist dieses Repository. Diese Datei geht der globalen AGENTS.md vor.

**Zwei Schreiber (BAUREGELN R20e), beide lokal:** der Haupt-Codex im Ordner `02_app` (Zweige `codex/…`) und Kreile Bau 2 im Ordner `02_app_b` (Git-Worktree desselben Repos, vom PL angelegt, Zweige `codex-b/…`). Jeder ändert nur, was `besitz.json` ihm erlaubt; der CI-Check `besitz` ist Pflicht. Kreile Bau 2 ändert Pfade außerhalb seiner Liste `codex-b` und der Liste `register` nur mit einer Zeile `GEMEINSAM <Pfad oder Muster> <Grund>` im PR-Text, `nur_haupt` nie. Der Haupt-Codex ändert Pfade der Liste `codex-b` nur mit derselben Zeile. Ein dritter Schreiber ist verboten.

**Vor jeder Arbeit:** zuerst `GESETZE.md` im Steuerordner `_review/` (Haupt-Codex: `./_review/`, Kreile Bau 2: `../02_app/_review/`; eine Seite, geht allem außer `OWNER_ENTSCHEIDUNGEN.md` vor), dann die Lesefolge nach `_review/BAUREGELN.md` §1 (Haupt-Codex) bzw. `_review/uebergabe/BAU2.md` (Kreile Bau 2). Gebaut wird nur ein Schritt, der in `_review/ZEITPLAN_LIVEGANG.md` in „Vorlage“ ✓ oder „entfällt (Grund)“ und in „Red Team“ ✓ zeigt (R46).

**Quelle ist der Stand im Arbeitsordner.** `_review/` gehört nicht zum App-Repo (U-289); es hat ein eigenes lokales Git. Haupt-Codex: nie einen Zweig oder Commit auschecken, der `_review/` noch enthält.

**Codex trifft keine fachlichen Entscheidungen.** Dazu gehören Verhalten, Text, Fehlerweg, Recht, Datenmodell, Anbieter, Reihenfolge und „erwartet rot“. Fehlt etwas: `TODO_PL` im Code, eine Frage (Haupt-Codex: `CODEXPL FRAGE` im BAULOG; Kreile Bau 2: F-Zeile in `_review/uebergabe/BAU2_LOG.md`), dann am nächsten freien Teil weiterbauen. Ein eigener Vorschlag wird nie vor der PL-Antwort umgesetzt. Selbst entschieden wird nur Technik ohne sichtbare Wirkung.

**Die zwei Schreiber reden direkt miteinander:** Kreile Bau 2 schreibt Bitten an den Haupt-Codex als `AN HAUPT: …` in `_review/uebergabe/BAU2_LOG.md`; der Haupt-Codex liest diese Zeilen zu Beginn jedes Arbeitsschritts, erledigt sie nach Vorgabe und antwortet im BAULOG mit `AN BAU2: …`. Kreile Bau 2 liest die `AN BAU2:`-Zeilen zu Beginn jedes Arbeitsschritts.

**Keine Quelle, kein Auftrag:**
- `README.md`, alles unter `docs/**`, Archive
- WARTESCHLANGE, SEITENHOHEIT
- `npm run live:*`
- Codex-Memories, Automation-Freitext, alte Kreile-Handoffs (MAIN_HANDOFF, F0, Mission, Board)

Keine Skills oder Unteragenten für Planung und Prüfung. Unteragenten nur zum Lesen.

**Codex-eigene Dateien:** Haupt-Codex: `_review/BAULOG.md`, `STAND.md`, `ABLAUF_STAND.md`, `ABLAUF_INVENTAR.md`, `HAUPTWEGE_BEFEHLE.md`, `UI_ERSETZT_LISTE.md`, `shots/`. Kreile Bau 2: nur `_review/uebergabe/BAU2_LOG.md` (nur anhängen). Alle anderen Dateien unter `_review/` schreibt nur der PL. Der Haupt-Codex committet sie täglich unverändert im lokalen Git `_review/` („Steuerstand <Datum>“), nach BAUREGELN 7.

**Nie:** Merge, Secrets in Dateien oder Ausgaben, Vercel-CLI-Deploy, `git stash`, Force-Push, Rebase, weitere Clones oder Worktrees anlegen, ein dritter Schreiber. Production und Remote-Migration nur in S50/S51 mit PL-Zeile „Owner-Freigabe Production Sxx“, außer Dev-Projekt syhaigjhsbpjmtnggqka nach R35; Dev-Migrationen spielt nur der Haupt-Codex ein, immer erst nach dem Merge (R35): Zeile `AN HAUPT: DEV-MIGRATION <PR> gemergt <Dateien>` vom PL oder von Kreile Bau 2, Antwort `AN BAU2: DEV = main <SHA>`. Kostenpflichtige Dienste nur, wo OWNER_ENTSCHEIDUNGEN sie freigibt (U-236). Jede neue Migration trägt bei ‚R22 bereit‘ einen Zeitstempel über der letzten Migration auf `origin/main`; sonst vorher umbenennen (Inhalt bytegleich). Kreile Bau 2: den lokalen Supabase-Stapel `02_app` nie starten, stoppen oder zurücksetzen. Auslöser Dev-Migration: Der Haupt-Codex prüft nach jedem Merge mit Migrationen selbst `git diff --name-only <alt> <neu> -- supabase/migrations`, bis der CI-Job `dev-migrate` es übernimmt; zusätzlich hängt Kreile Bau 2 oder der PL die Zeile `AN HAUPT: DEV-MIGRATION <PR> gemergt <Dateien>` an `_review/uebergabe/BAU2_LOG.md` an; Antwort im BAULOG `AN BAU2: DEV = main <SHA>`. Kreile Bau 2: Playwright, Bildvergleich und Hauptweg-Tests nie lokal (nur CI), `next dev` nur auf Port 3100, kein `next build`.

**„Nie Merge“ heißt (PL 13.11.11:25, BAUREGELN §7):** Codex merged nie einen PR und schreibt nie auf `main`. Pflicht ist dagegen, nach jedem Merge auf `main` `origin/main` normal in den eigenen Arbeitszweig zu mergen (`git merge origin/main`, kein Rebase, kein Squash), Konflikte so aufzulösen, dass beide Stände erhalten bleiben, danach die betroffenen Tests gezielt. Nach R22c öffnet Codex PRs als Draft und meldet „R22 bereit <PR> <40-stelliger SHA>“; Ready und Auto-Merge setzt ausschließlich der PL.

Modulgrenzen: Andere Module nur über `src/modules/<fach>/public.ts` und Lese-Ports ansprechen. Die Modul-Gates in CI gelten.

Modulnähte: docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md bleibt ausschließlich für die bestehenden Modul-Gates maßgeblich.
