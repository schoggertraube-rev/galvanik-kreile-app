# Teststrategie Galvanik Kreile App

Diese Dokumentation beschreibt die Struktur, Trennung und Ausführung von Tests im Projekt.

## Testübersicht (Testvertrag)

| Testdatei | Runner | Datenbank nötig | Netzwerk nötig | schreibt Daten | aktuelle Ausführung |
| --------- | ------ | --------------: | -------------: | -------------: | ------------------- |
| `src/test/dummy.test.ts` | Vitest | Nein | Nein | Nein | Pre-Commit (lokaler Unit-Test) |
| `src/test/greeting.test.ts` | Vitest | Nein | Nein | Nein | Pre-Commit (lokaler Unit-Test) |
| `src/lib/license/__tests__/resolveFeatures.test.ts` | Vitest | Nein | Nein | Nein | Pre-Commit (lokaler Unit-Test) |
| `src/test/verify.integration.test.ts` | Vitest | Ja | Nein | Ja | Nur explizite Integrationstests |

---

## Ausführungsebenen

### 1. Pre-Commit Verification
Wird automatisch vor jedem Commit durch den Husky-Hook ausgeführt:
- Befehl: `npm run verify:precommit`
- Führt aus:
  1. TypeScript-Prüfung (`npx tsc --noEmit`)
  2. Linting von ausschließlich gestagten Code-Dateien (`npm run lint:staged` -> `scripts/verify-staged-files.mjs`)
  3. Lokale Unit-Tests (`npm run test:unit`) ohne Datenbank- und Netzwerkzugriff.

### 2. Vollständiger Lint
- Befehle: `npm run lint` oder `npm run lint:full`
- Prüft das gesamte Repository auf Lint-Probleme. Der globale Lint-Bestand (historisch bedingt ca. 856 Probleme) ist derzeit offen und wird nicht als grün deklariert. Nur neue/geänderte gestagte Dateien müssen vollständig sauber sein.

### 3. Integrationstests
- Befehl: `npm run test:integration`
- Erfordert zwingend eine gültige `DATABASE_URL` in der Umgebung.
- Läuft niemals automatisch gegen eine Production-Datenbank.
- Bei fehlender `DATABASE_URL` wird die Ausführung sofort mit einer klaren Fehlermeldung abgebrochen; es gibt keine stillen Übersprünge oder Verwendung von Dummy-URLs.

---

## Regeln & Richtlinien
- **Keine Hook-Umgehung**: Commits dürfen niemals mit `--no-verify` oder `HUSKY=0` erzwungen werden.
- **Datenbank & Secrets**: Lokale Unit-Tests dürfen keine Secrets, Umgebungsdaten oder Datenbankverbindungen benötigen.
