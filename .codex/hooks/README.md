# Hooks

## guard-destructive.mjs

Blockiert typische Befehle, die uncommittete Arbeit, Git-Historie oder Datenbankobjekte zerstören können.

## Verifizierter Stand

- Das Schema in `.codex/hooks.json` entspricht der lokal vorhandenen Codex-CLI `0.146.0`.
- JSON- und JavaScript-Syntax sowie die Klassifikation ungefährlicher und destruktiver Testeingaben werden lokal geprüft.
- Die Laufzeitaktivierung ist **NOT_VERIFIED**, bis das Projekt als vertrauenswürdig gilt und der exakte Hook-Hash in Codex über `/hooks` bestätigt und zurückgelesen wurde.
- Bis zu diesem Readback darf der Guard nicht als aktiv oder als vollständige Sicherheitsgrenze bezeichnet werden.

Prüfung in Codex:

```text
/hooks
```

Wichtig:

- Der Guard ist eine zusätzliche Schutzschicht, kein Ersatz für Scope, Git-Prüfung, Tests oder Owner-Freigaben.
- Spezialisierte Ausführungswege können Hooks auslassen; deshalb bleibt die normale Berechtigungs- und Review-Kette verbindlich.
- Externe Blocker müssen ehrlich dokumentiert werden und dürfen keine Endlosschleife erzeugen.
