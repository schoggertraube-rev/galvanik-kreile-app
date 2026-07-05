# Hooks

## guard-destructive.mjs (SSG-14-Guard, gehärtet in Mission M4+M5, 2026-07-05)

PreToolUse-Guard mit Matcher `*` — prüft ALLE Tools (Bash, PowerShell, jedes Tool
mit `command`-Feld, Datei-Tools, MCP), nicht nur Bash.

Blockierte Klassen (fail-closed):

| Klasse | Regel |
|---|---|
| GIT_PUSH | `git push` immer — auch ohne `--force` |
| GIT_COMMIT | `git commit` ohne Missionsfreigabe; `--no-verify` immer |
| GIT_REMOTE | `git remote add/set-url/remove/rename` |
| DB_PUSH | `npm run db:push`, `drizzle-kit push` |
| SUPABASE_CLI | supabase-CLI in jeder Aufrufform (auch `npx supabase`) |
| VERCEL_CLI | vercel-CLI in jeder Aufrufform |
| SEED_AUTOCONFIRM | Seeds/Resets mit `--yes/--force/--confirm/-y/-f` oder `echo y \|` |
| ENV_ACCESS | `.env*` über Shell UND Read/Edit/Write/Glob/Grep/Notebook |
| MCP_DB / MCP_DEPLOY | Supabase-MCP komplett, Vercel-Deploy-Tool (zusätzlich `permissions.deny` in settings.json) |
| DESTRUKTIV / SQL_DESTRUKTIV | rm -rf, git reset --hard, git clean, DROP/TRUNCATE/DELETE … (Bestand) |

### Missionsfreigabe für `git commit`

Der Auftraggeber legt **außer-Band** die Datei `.claude/state/MISSIONSFREIGABE`
mit nicht-leerem Inhalt (Missions-ID) an und entfernt sie nach dem Commit.
Kein Agent erstellt diese Datei. Ohne Datei: deny.

### Tests

`node .claude/hooks/guard-tests.mjs` — Ablehnungstest je Kommandoklasse
(Direkttest gegen den Guard, Bash- und PowerShell-Payloads, plus
Positivkontrollen). Exit 0 = alle Erwartungen erfüllt.

### Rollback

Alt-Zustand vor M4+M5: `.claude/_snapshots/2026-07-05_pre_M4M5/` (Copy-Back genügt).

## Stop-/Task-Hooks

Sind in `.claude/settings.json` als Prompt-/Agent-Hooks konfiguriert.

Prüfung in Claude Code:

```text
/hooks
```

Wichtig:

- Hook-Konfiguration vor Einsatz mit der installierten Claude-Code-Version prüfen.
- Neue Matcher/Permission-Denies lädt Claude Code beim Sessionstart — nach Änderungen Session neu starten.
- Ein Stop-Hook ist kein Ersatz für Tests; „Hook-Datei existiert" ≠ „Hook greift" (SSG-14).
- Der unabhängige Prüfer wiederholt den Ablehnungstest in eigener Session (V6 Abschnitt 6.0).
- Externe Blocker müssen ehrlich dokumentiert werden; sie dürfen keine Endlosschleife erzeugen.
