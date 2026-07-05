# RISK REGISTER

Stand: 2026-07-05 · Fundament-Audit. Wahrscheinlichkeit/Auswirkung: 1 (gering) – 5 (hoch).

| RISK-ID | Risiko | W | A | Frühindikator | Gegenmaßnahme | Owner | Status |
|---|---|---:|---:|---|---|---|---|
| R-01 | „Grüner Build" wird als „Fundament funktioniert" fehlgedeutet und live gestellt | 4 | 5 | tsc/Build grün, aber kein E2E-Beweis | Livegang-Gate an Laufzeitbeweise (RLS/Storage/Original-Persistenz) koppeln, nicht an Kompiliergates | QA/Release | OFFEN |
| R-02 | DSGVO-Datenabfluss über ungeschützte Routen/öffentliche Storage-URLs vor Livegang | 4 | 5 | F-A5/F-A6/F-A10 offen | Sofort-Blocker P0 schließen, bevor irgendeine Live-Instanz online geht | Security | OFFEN |
| R-03 | Schema-Drift führt bei Neuaufbau/2. Umgebung zu abweichendem Schema → Datenverlust | 4 | 5 | events/current_station_id nur remote | Baseline-Migration aus Remote-Dump, danach kein `db push` | Data Contract | OFFEN |
| R-04 | Tenant-Hardcode + tote RLS blockieren Wiederverwendung (Evas Lerninsel) dauerhaft | 5 | 4 | 136 Hardcodes, keine App-Rolle | Tenant aus Session, App-Rolle + FORCE RLS als Architektur-Fundament | Platform Arch | OFFEN |
| R-05 | Weitere Wochen „Fundamentarbeit" ohne Konvergenz, weil Root-Cause (Datenpfad-Dualität) unadressiert | 4 | 4 | ChatGPT „beißt sich fest", 35% nach 1 Woche | Genau EIN kanonischer Datenpfad festlegen, Mock-Schalter entfernen, dann erst Module | Chefdirigent | OFFEN |
| R-06 | Verworfener `.agents/`-Auth-Clone verfälscht Gates / wird versehentlich reaktiviert | 3 | 3 | 647 Klon-Dateien im tsconfig-Scope | `.agents/` aus Repo entfernen/exkludieren | Platform Arch | OFFEN |
| R-07 | Offline-Fragmentierung (4 Systeme) → stiller Datenverlust im Werkstattalltag | 4 | 4 | useOfflineManager nur RAM | Auf eine IndexedDB-Outbox konsolidieren, andere entfernen | Performance | OFFEN |
| R-08 | Lint-Baseline-Schuld (404 Fehler/370 Warnungen) wächst unbemerkt weiter | 3 | 2 | Ratchet grün trotz Schuld | Schuld sichtbar machen, sukzessive tilgen, Neucode sauber | QA | OFFEN |
| R-09 | Governance-Register bleiben leer → Entscheidungen erneut verloren (wie bisher) | 4 | 3 | Register 4–6 Zeilen | Register-Pflege als Gate jeder Mission; dieser Audit füllt sie initial | Chefdirigent | IN_BEARBEITUNG |
| R-10 | Klartext-PINs + lokal gestreute Prod-Secrets bei Geräteverlust/Malware | 3 | 4 | keine Hashes, 5 .env-Varianten lokal | PIN hashen, Secret-Streuung reduzieren, Keys nach Stabilisierung rotieren | Security | OFFEN |
| R-11 | Externe KI-Ausfälle (Gemini ohne Timeout) hängen Requests bis Plattform-Timeout | 3 | 3 | kein AbortController | Timeouts + async-Queue statt synchroner Blockierung | Performance | OFFEN |
