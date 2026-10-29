# ABGABE H16 · Abschluss nach Prüfer-Halt

Branch: `kreile/s1-p2-eingang` · PR #154  
H16.1: `971276713a89b0638c2c5f4442d30db7c6dfb1aa`  
H16.3: `a05eb82dd1fe5134c89ae85e77c5ce17ac996a14`

## Befund und Änderung

- Die unzulässige H16-Kette einschließlich `895ebb87`, `d2ff0f28`, `b6d9044d`, `cce36629`, `8d5573f3`, `af8bbf22`, `8668d930` und `2d6e367f` wurde einzeln zurückgenommen. Weil H16.2 danach nicht allein grün war, wurde auch `5d669e17` zurückgenommen. Der Rücknahmekopf `f33e6deb` war im Agentur-Gate grün.
- H16.1 wurde ohne Rollenvergleichs-Trick neu gebaut. Der ESLint-Wächter erkennt direkte Vergleiche sowie Umgehungen über `Set.has(role)` oder `includes(role)` (`scripts/quality/eslint-h16-plugin.mjs:52`). Er verbietet außerdem `ROLE_PERMISSIONS` und fest codierte Personennamen im Produktcode (`scripts/quality/eslint-h16-plugin.mjs:78,82`).
- Die ausdrücklich erlaubten H11c-Stellen tragen eine lokale `eslint-disable-next-line`-Begründung mit `erlaubt H11c`; Tests sind getrennt ausgenommen (`eslint.config.mjs:93-113`). Es gibt keine Eingang-Freeze-Ausnahme.
- Anzeigenamen werden nicht mehr aus Rolle oder Produktkonstante ersetzt. Die aufgelöste Autorisierung mit `app_users.full_name` wird unverändert weitergegeben (`src/lib/server/productActorReadiness.ts:204`).
- H16.3 enthält keinen generischen SQL-Scanner. Der aktive CI-Job replayt alle Migrationen auf einer leeren lokalen Datenbank und führt danach ausschließlich die benannten H12-Verträge für F0/F2 samt Negativ-Selbsttest aus (`.github/workflows/agentur-gate.yml:56-83`).
- H16.2 ist nach der angeordneten Rücknahme nicht aktiv und wurde gemäß Prüfer-Halt vor H16b nicht erneut eingeführt.

## Prüfung

- `quality:h16-eslint-contracts:selftest`: **PASS**, einschließlich absichtlicher `new Set(["developer"]).has(role)`-Umgehung.
- `quality:h16-eslint-contracts`: **PASS** über `src/**/*.{ts,tsx}`.
- `grep new Set(["developer"])` in `src/`: **0 Treffer**.
- `npx tsc --noEmit --incremental false`: **PASS**.
- Fokussierte Rechte-, Identitäts-, Home- und Werkstattprüfung: **49/49 Tests PASS**.
- Der unveränderte Eingang-Test erreichte isoliert sein bestehendes 5-Sekunden-Zeitlimit. Die lokale Gesamtsuite wurde nach der verbindlichen 10-Minuten-Grenze beendet; gemäß Regel 7 entscheidet die CI.
- Lokaler Leer-DB-Replay: **Umgebung blockiert**, weil Docker Desktop nicht erreichbar ist. Workflow-YAML: **PASS**. Der reale Replay und der H12-SQL-Selbsttest laufen im CI-Job `h16-schema`; solange dieser Job nicht grün ist, wird kein PASS dafür behauptet.
- `scripts/ui/spec-check.mjs`: nicht anwendbar, da H16 keine Screen-/DOM-Spezifikation ändert.

## Datenbank-Soll

H16 enthält keine Migration und schreibt keine Dev- oder Production-Daten. Die isolierte CI-Datenbank wird leer aufgebaut und nach der Prüfung verworfen. Fach-, Stamm- und Rechtezeilen bleiben unverändert.

## Owner-Klickweg

1. In der Preview mit einem vorhandenen aktiven Zugang anmelden; der sichtbare Name muss dem Namen unter **Einstellungen → Personen & Rechte** entsprechen.
2. **Der Tag** und anschließend **Einstellungen → Personen & Rechte** öffnen; beide Seiten müssen ohne Berechtigungsfehler laden.
3. In PR #154 am exakten Kopf prüfen: `agentur-gate` und `h16-schema` sind grün. Durch den Klickweg dürfen keine Datenbankzeilen entstehen oder geändert werden.
