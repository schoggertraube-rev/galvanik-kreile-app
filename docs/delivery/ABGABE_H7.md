# Abgabe H7 · neue Aufträge wieder öffnen

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

## Ursache

Der strikte Leser der Auftragskarte akzeptierte bei Eingangsquittungen nur die alte Positionsform und die bisherige aktuelle Form. Seit der bereits vorhandenen Migration `20261028002500_intake_position_execution.sql` enthält eine neu angelegte Position zusätzlich das echte Feld `executionRequested`. Bei A-2026-0008 ist dessen Wert korrekt `offen`; trotzdem verwarf `mapOrderCardIntakeItems` die gesamte Position vor dem eigentlichen Lesen mit:

`ORDER_CARD_INTAKE_ITEM_SHAPE_INVALID`

Der Server protokollierte diesen Code und gab aus Sicherheitsgründen `UNAVAILABLE` zurück. Deshalb blieb die Datenbank korrekt, während die Karte nicht geöffnet werden konnte.

## Änderung

- Der bestehende Leser akzeptiert zusätzlich genau die versionierte Positionsform mit `executionRequested` (`src/lib/server/orderCardRead.ts:15`, `src/lib/server/orderCardRead.ts:283`).
- Zulässig sind ausschließlich die sechs bereits im Schreibvertrag erlaubten Werte; unbekannte Schlüssel und ungültige Werte bleiben fail-closed (`src/lib/server/orderCardRead.ts:326`).
- Alte Quittungen und die vorherige aktuelle Form bleiben unverändert lesbar.
- Keine Oberfläche, kein Eingang, kein Login, keine Datenbank und keine Echtdaten wurden geändert.

## Prüfergebnis

- Reproduktion mit der Positionsform von A-2026-0008 (`Freitext`, Preis `NULL`, `executionRequested=offen`): **PASS** (`src/lib/server/__tests__/orderCardRead.test.ts:31`).
- Leser-Regressionen: **PASS**, 4/4.
- `npx tsc --noEmit --incremental false`: **PASS**.
- Gezieltes ESLint: **PASS**.
- `quality:no-fake-production`, `quality:module-gates`, `quality:authority-gate`, `quality:delivery-contracts`: **PASS**.
- Statischer Spec-Check: für `auftrag` sind im aktuellen Prüfschema keine IDs registriert (`expected=0`, `found=0`); H7 ändert keine Oberfläche.

## Owner-Klickweg

1. Aktuelle Branch-Preview frisch öffnen und anmelden.
2. A-2026-0008 öffnen: Die Auftragskarte muss mit beiden Freitext-Positionen erscheinen.
3. A-2026-0001 bis A-2026-0007 nacheinander öffnen: Jede Karte muss weiterhin erscheinen.
4. Optional einen neuen Auftrag erfassen und unmittelbar über „Auftrag öffnen“ öffnen.

Erwarteter Datenbankzustand: vollständig unverändert. Es wird keine Zeile ergänzt, geändert oder gelöscht; der Fix liest die bereits korrekte Quittung und die bestehenden Positionen.

Der zweite H7-Befund zur Kamera ist gemäß H8 eingefroren und wurde nicht bearbeitet.
