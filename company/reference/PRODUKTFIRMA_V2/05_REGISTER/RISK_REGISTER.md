# RISK_REGISTER

| ID | Datum | Risiko | Quelle | Schwere | Status | Gegenmaßnahme |
|---|---|---|---|---|---|---|
| RISK-001 | _Beispiel_ | 30 Tabellen ohne RLS | Sicherheit | hoch | offen | RLS/Auth Specialist vor Go-Live |
| RISK-002 | _Beispiel_ | inventory_items ohne tenant_id | Architektur | hoch | offen | FK + tenant_id ergänzen |
| RISK-003 | _Beispiel_ | DB-Passwort wurde inline genutzt | Drift/Security | mittel | offen | rotieren vor Go-Live; Hook aktiv |
