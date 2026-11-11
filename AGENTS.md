# Kreile-WerkstattCockpit – verbindlich für Codex (ab 11.11.2026)

Arbeitsort ist nur dieses Repository `02_app`. Codex ist der einzige Schreiber. Diese Datei geht der globalen AGENTS.md vor.

**Vor jeder Arbeit** `_review/BAUREGELN.md` lesen und deren feste Lesereihenfolge (Abschnitt 1) einhalten. Kurz:
- BAUREGELN → PL_ABLAUF → PLAN_LIVEGANG (Plan-Reihenfolge; bei offener Frage BAUREGELN §4a) → die Pakete, die der Schritt nennt
- dann OWNER_ENTSCHEIDUNGEN, ANFORDERUNGSKATALOG, HAUPTWEGE, LEITFADEN, LEITBILD, ERSTER_BLICK
- Oberfläche: nur V45, `_review/quellen/endversion_V45/`
- dazu `_review/PL_ENTSCHEIDUNGEN.md` und die neuen PL-Zeilen im `_review/BAULOG.md`

**Quelle ist der Stand im Arbeitsordner.** `_review/` gehört nicht zum App-Repo (U-289); es hat ein eigenes lokales Git. Nie einen Zweig oder Commit auschecken, der `_review/` noch enthält.

**Codex trifft keine fachlichen Entscheidungen.** Dazu gehören Verhalten, Text, Fehlerweg, Recht, Datenmodell, Anbieter, Reihenfolge und „erwartet rot“. Fehlt etwas: `TODO_PL` im Code, `CODEXPL FRAGE` im BAULOG, dann am nächsten freien Teil weiterbauen. Ein eigener Vorschlag wird nie vor der PL-Antwort umgesetzt. Selbst entschieden wird nur Technik ohne sichtbare Wirkung.

**Keine Quelle, kein Auftrag:**
- `README.md`, alles unter `docs/**`, Archive
- WARTESCHLANGE, SEITENHOHEIT
- `npm run live:*`
- Codex-Memories, Automation-Freitext, alte Kreile-Handoffs (MAIN_HANDOFF, F0, Mission, Board)

Keine Skills oder Unteragenten für Planung und Prüfung.

**Codex-eigene Dateien:** `_review/BAULOG.md`, `STAND.md`, `ABLAUF_STAND.md`, `ABLAUF_INVENTAR.md`, `HAUPTWEGE_BEFEHLE.md`, `UI_ERSETZT_LISTE.md`, `shots/`. Alle anderen Dateien unter `_review/` schreibt nur der PL. Codex committet sie täglich unverändert im lokalen Git `_review/` („Steuerstand <Datum>“), nach BAUREGELN 7.

**Nie:** Merge, Secrets in Dateien, Vercel-CLI-Deploy, `git stash`, Force-Push, Clones, Worktrees, zweiter Schreiber. Production und Remote-Migration nur in S50/S51 mit PL-Zeile „Owner-Freigabe Production Sxx“. Kostenpflichtige Dienste nur, wo OWNER_ENTSCHEIDUNGEN sie freigibt (U-236).

Modulgrenzen: Andere Module nur über `src/modules/<fach>/public.ts` und Lese-Ports ansprechen. Die Modul-Gates in CI gelten.

Modulnähte: docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md bleibt ausschließlich für die bestehenden Modul-Gates maßgeblich.
