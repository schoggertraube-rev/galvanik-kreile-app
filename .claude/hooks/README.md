# Hooks

## guard-destructive.mjs

Blockiert typische Befehle, die uncommittete Arbeit, Git-Historie oder Datenbankobjekte zerstören können.

## Stop-/Task-Hooks

Sind in `.claude/settings.json` als Prompt-/Agent-Hooks konfiguriert.

Prüfung in Claude Code:

```text
/hooks
```

Wichtig:

- Hook-Konfiguration vor Einsatz mit der installierten Claude-Code-Version prüfen.
- Ein Stop-Hook ist kein Ersatz für Tests.
- Externe Blocker müssen ehrlich dokumentiert werden; sie dürfen keine Endlosschleife erzeugen.
