# TA-B2k1b · enger Smoke-Test-Pfad-Anker

Basis: `origin/main` `5e9d5f4626f88f321982866686b4536ad47377a4`. Dieser Anker enthält ausschließlich den Scope-Checker, dessen Test, den Ankerbeleg und diese Abgabe. Er enthält keinen Produktcode, keine Migration und keine Runde-53-Bindung.

P78 gibt genau einen Pfad frei:

- `e2e/path1-v5-shell-smoke.real.spec.ts`

Der Scope-Test erlaubt ausschließlich diesen Testpfad für die Ergänzung der `/nachrichten`-Überschrift und weist einen benachbarten Smoke-Test-Pfad ab. Der Anker selbst ist auf seine vier Nachweisdateien, den Branch `codex/ta-b2k1b` und die oben genannte Main-Basis festgelegt.

DB-Soll: keine Datenänderung. Kein Merge und kein Production-Deploy durch Codex.
