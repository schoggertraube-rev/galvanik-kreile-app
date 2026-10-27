# Abgabe H4 · Mock aus Git entfernt

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

## Geändert

- Git verfolgt unter `docs/project/endversion/` nur noch `codex/BAUPLAN.json`.
- Der beim Commit aktuelle Bauplan ist mit `spec_sha: 6a25817bb8bf` eingecheckt.
- Mock-HTML, Spec, Musterdaten, Prüfskripte und Prüfbilder wurden nur aus dem Git-Index genommen. Die lokalen Dateien liegen unverändert weiter an ihren bisherigen Pfaden.
- `.gitignore` hält den gesamten Mock-Ordner lokal und erlaubt ausschließlich `docs/project/endversion/codex/BAUPLAN.json` als Repository-Inhalt.
- `scripts/ui/spec-check.mjs` liest Screen-, Feld- und Aktions-IDs ausschließlich aus `codex/BAUPLAN.json`.

## Prüfergebnis

- `git ls-files docs/project/endversion`: **PASS**, genau `docs/project/endversion/codex/BAUPLAN.json`.
- Lokaler Erhalt stichprobenartig belegt: `index.html`, `spec.json`, ein Prüfbild und `codex/BAUPLAN.json` existieren weiterhin.
- `node scripts/ui/spec-check.mjs --screens=login`: **PASS**, `expected=3 found=3 missing=0`.
- `node scripts/ui/spec-check.mjs --screens=mailein`: **PASS**, `expected=5 found=5 missing=0`.
- `npm run quality:module-gates`: **PASS**.
- `npm run quality:authority-gate`: **PASS**.
- `npm run quality:delivery-contracts`: **PASS**.
- Kein Produktcode, keine Migration, keine Datenbankänderung, kein Deployment und keine Löschung lokaler Mock-Dateien.

## Owner-Abnahme

Kein Produkt-Klickweg: H4 ändert ausschließlich Repository-Tracking und den statischen Checker. Erwarteter Datenbankzustand: **unverändert**.

Prüfweg:

1. Im PR die H4-Dateiliste öffnen. Erwartung: Mock-/Spec-/Bilddateien erscheinen als aus Git entfernt; `codex/BAUPLAN.json`, `.gitignore`, Checker und diese Abgabe werden hinzugefügt beziehungsweise geändert.
2. Lokal `git ls-files docs/project/endversion` ausführen. Erwartung: genau eine Zeile, `docs/project/endversion/codex/BAUPLAN.json`.
3. Lokal `docs/project/endversion/index.html` prüfen. Erwartung: Datei ist weiterhin vorhanden, aber ignoriert und nicht mehr getrackt.
