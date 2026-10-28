# Abgabe Korrektur Der Tag 06 · K13

## Befund

> Bündel ohne Statusfilter, Ziel /warendurchlauf?bundle=1 statt Dialog 11.1.

Beleg aus dem Bauplan: `src/lib/server/todayDashboard.ts:142–151`; `src/components/home/RolfHomeClient.tsx:59`.

## Neu gemacht

- Für den Bündel-Vorschlag zählen nur noch Aufträge im Wareneingang oder in Galvanik. KV, fertige, abgeholte und versendete Aufträge können kein Bündel mehr auslösen (`src/lib/server/todayDashboardPolicy.ts:28–33`; `src/lib/server/todayDashboard.ts:142–149`).
- Der Tages-Eintrag trägt die konkrete Oberfläche als Objekt und die eindeutige Hauptaktion **Bündel öffnen** (`src/lib/server/todayDashboard.ts:151`).
- Bis Dialog 11.1 mit F3/F4 gebaut wird, öffnet die Aktion den bestehenden Werkstattpfad und übergibt die konkrete Oberfläche URL-kodiert (`src/components/home/RolfHomeClient.tsx:59`).
- Keine Migration und keine Datenmutation.

## Klickweg für den Owner

1. Als Rolf **Der Tag** öffnen.
2. Prüfen: Ein Bündel-Vorschlag erscheint nur, wenn mindestens zwei offene Aufträge derselben Oberfläche im Wareneingang oder in Galvanik liegen.
3. Einen gleichartigen fertigen oder abgeholten Auftrag prüfen: Er erhöht die Bündel-Anzahl nicht.
4. **Bündel öffnen** wählen.
5. Der bestehende Werkstattpfad öffnet mit `bundle=1` und der Oberfläche als `surface`-Parameter; bis F3/F4 wird noch kein Dialog 11.1 behauptet.
6. Datenbank-Nachweis: Der reine Lese-/Öffnungsweg legt keine Zeile an und ändert keinen Auftrag oder Status.

## Prüfergebnis

- Fokussierte Tests: **2 Dateien / 19 Tests grün**.
- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der fünf betroffenen Produkt-/Testdateien: **0 Fehler**.
- `npm run quality:no-fake-production`: **grün**.
- `npm run quality:module-gates`: **grün**.
- `node scripts/ui/spec-check.mjs --screens=tag`: **1 erwartet / 1 gefunden / 0 fehlend**.
- `git diff --check`: **grün**.
- CI am vorigen Steuerstand ist nicht rot; `agentur-gate` läuft. Gemäß Regel 4c wurde nicht darauf gewartet.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d.

## Abgrenzung

- Dialog 11.1 bleibt gemäß BAUPLAN bis F3/F4 zurückgestellt. Diese Korrektur baut nur Datenfilter, Aktionsbezeichnung und Objektübergabe.
- Login und Eingang wurden nicht verändert. Kein Merge und kein Production-Deploy.
