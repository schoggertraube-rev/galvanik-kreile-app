# Abgabe Q12 · Kleinigkeiten aus der Abnahme

Status: **PASS**

Branch: `kreile/s1-p2-eingang`

Basis-SHA: `6e0ff515017e514c86ec416d4861b5845cb9cbe4`

## Neu gemacht

- Die Lageleiste zeigt bei zwei oder mehr Punkten nachweisbar `Konflikte`; für den bereits korrekten Produktcode ist jetzt ein Regressionstest gebunden.
- `Vorkasse` ist in den sichtbaren Auswahlfeldern korrekt großgeschrieben und wird bei Neukunden als kanonische Zahlungsbedingung vorausgewählt.
- Ein Altkunde ohne hinterlegte Zahlungsbedingung erhält keinen stillen Rechnungs-Fallback mehr. Das Pflichtfeld bleibt auf `Bitte auswählen`; die gesperrte Zielrechnung wird nicht vorausgewählt.
- Die Kundenanlage zeigt nur noch ein Namensfeld: `Firmenname` für Firma/Institution und `Name` für Privatkunden. Die bestehende fachliche Übergabe von `name` und `companyName` bleibt erhalten.

## Prüfschritte

- Betroffene echte Renderpfade: 2 Dateien, 24/24 Tests PASS.
- TypeScript: PASS (`npx tsc --noEmit --incremental false`).
- Statischer UI-Prüfschritt: `SPEC_CHECK screens=eingang,kundeneu,tag expected=5 found=5 missing=0`.
- Keine Datenbankmigration, keine Echtdatenänderung und kein neuer Schreibweg.
- Gemäß Regel 4d wurden keine Codex-Screenshots oder Bildpaare erzeugt.

## Owner-Abnahme (höchstens 6 Klicks)

1. Als Rolf `Anlegen` öffnen.
2. `Neukunde anlegen` wählen: Erwartung `Firmenname` genau einmal und `Zahlung = Vorkasse`.
3. Abbrechen und `Anlegen` erneut öffnen.
4. Einen Altkunden ohne Zahlungsbedingung wählen: Erwartung `Bitte auswählen`; `Rechnung auf Ziel (nicht freigeschaltet)` ist nicht auswählbar und nicht vorausgewählt.
5. `Versand` wählen: Erwartung `Vorkasse`.

## Abweichungen / Rest

- Keine neue Abweichung festgestellt.
- Das Vercel-Deployment und die GitHub-Prüfungen des Q12-Commits werden gemäß Regel 4c nicht abgewartet. Ein später roter Pflichtcheck erhält Vorrang.
