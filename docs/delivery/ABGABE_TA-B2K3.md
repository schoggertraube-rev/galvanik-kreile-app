# TA-B2k3 · Additive Verträge für neue Server-Actions

Anker auf `codex/ta-b2k3`, gebunden an Main `cc541f80e0d28d2ab52ba5b2396bafff172fa874` nach P86.

Der Scope-Wächter erlaubt Produkt-PRs ausschließlich:

- neue, getestete Einträge in `scripts/quality/h18-server-actions.json`, mit aktualisiertem Inventar-Hash;
- neue exportierte Funktionen in bestehenden Einträgen der F1-Fähigkeitsregistrierung.

Er weist jede Änderung, Entfernung oder Umklassifizierung bestehender H18-Tests, Overrides, F1-Einträge oder F1-Metadaten zurück. Damit bleibt die H18-Inventarpflicht für jede neue Server-Action erhalten, ohne pro Paket einen zusätzlichen Pfad-Anker zu benötigen.

DB-Soll: keine Datenänderung. Kein Produktcode, kein Merge und kein Production-Deploy durch Codex.
