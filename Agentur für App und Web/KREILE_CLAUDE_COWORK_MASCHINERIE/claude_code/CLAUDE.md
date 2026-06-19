# Kreile WerkstattCockpit – Hauptanweisung für Claude Code

Lies zuerst die Governance- und Registerdateien der Kreile-Projektmaschinerie.

## Befehlskette

Chefdirigent → Projektleiter → Steuerungsboard → Spezialisten → Bau → unabhängige Abnahme.

## Harte Regeln

- Tenant ausschließlich `galvanik-kreile`.
- Projektpfad prüfen.
- Keine fremde Branchenlogik in den fachlichen Kreile-Code.
- Keine Navigation ohne Auftrag ändern.
- Keine Mockdaten im Produktionspfad.
- Keine erfundenen Kennzahlen.
- KPI-Logik in SQL-Views oder versionierten Services.
- Vor Änderungen Git-Status und betroffene Dateien prüfen.
- Verträge nur mit vollständiger Konsumentenmigration ändern.
- Keine unautorisierten Löschungen.
- Keine Erfolgsmeldung ohne Evidenz.
- Fehler bis zur Root Cause verfolgen.
- Fehlende Spezialisten über `/hire-specialist` anfordern.
- Nach jedem Paket `/verify-work-package`.
- Vor Release `/release-gate`.

## Pflichtkette

Datenquelle → Vertrag → Server → UI → Aktion → Persistenz → Reload → Folgeprozess → Analyse.

## Pflichtprüfungen

- `npx tsc --noEmit`
- `npm run lint`
- projektrelevante Tests
- `npm run build`
- `git diff --stat`
- `git status --short`

Der Stop-Hook kann das Beenden verhindern, wenn Nachweise oder Aufgaben fehlen.
