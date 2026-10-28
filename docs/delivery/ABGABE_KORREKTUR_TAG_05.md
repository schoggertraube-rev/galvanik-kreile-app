# Abgabe Korrektur Der Tag 05 · K12

## Befund

> „Geld einfordern“ zeigt alle offenen Rechnungen (auch nicht fällige), Vorkasse offen fehlt; Knopf heißt wie die Überschrift und öffnet nur die Rechnung.

Beleg aus dem Bauplan: `src/lib/server/todayDashboard.ts:68–76,127–138`; `src/components/home/RolfHomeClient.tsx:59–60`.

## Neu gemacht

- Der Server lädt für **Geld einfordern** nur noch offene oder teilbezahlte Rechnungen, deren Fälligkeit in Berliner Zeit bereits überschritten ist (`src/lib/server/todayDashboard.ts:68–80`).
- Bei Teilzahlungen zeigt der Eintrag den wirklich offenen Restbetrag statt erneut den Bruttobetrag (`src/lib/server/todayDashboard.ts:130`).
- Fertige inländische Vorkasse-Aufträge ohne vollständigen Zahlungseingang erscheinen zusätzlich. Bereits ausgegebene, bezahlte oder ausländische Vorkasse-Aufträge bleiben ausgeschlossen (`src/lib/server/todayDashboard.ts:81–99,133–138`; `src/lib/server/todayDashboardPolicy.ts:63–79`).
- Die Hauptaktionen heißen konkret **Erinnern** beziehungsweise **Zahlung bestätigen**. Bis die späteren Mail-/Zahlungsziele gebaut sind, öffnet der bestehende Pfad das genaue Rechnungs- beziehungsweise Auftragsobjekt (`src/lib/server/todayDashboard.ts:130,138`; `src/components/home/RolfHomeClient.tsx:59–60`).
- Keine Migration und keine Datenmutation.

## Klickweg für den Owner

1. Als Rolf **Der Tag** öffnen und den Block **Geld einfordern** ansehen.
2. Prüfen: Eine noch nicht fällige offene Rechnung fehlt; eine überfällige offene Rechnung steht mit ihrem offenen Restbetrag und der Aktion **Erinnern** dort.
3. **Erinnern** wählen: Es öffnet sich genau diese Rechnung über den bestehenden Zielpfad.
4. Prüfen: Ein fertiger inländischer Auftrag mit offener Vorkasse steht mit **Zahlung bestätigen** dort.
5. **Zahlung bestätigen** wählen: Es öffnet sich genau dieser Auftrag über den bestehenden Zielpfad.
6. Datenbank-Nachweis: Der reine Lese-/Öffnungsweg hat keine Zeile in `orders`, `invoices`, `payments` oder `events` angelegt oder verändert; die bestehenden Status bleiben unverändert.

## Prüfergebnis

- Fokussierte Tests: **2 Dateien / 17 Tests grün**.
- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der vier betroffenen Produkt-/Testdateien: **0 Fehler**.
- `npm run quality:no-fake-production`: **grün**.
- `npm run quality:module-gates`: **grün**.
- `npm run quality:authority-gate`: **grün**.
- `npm run quality:delivery-contracts`: **grün**.
- `node scripts/ui/spec-check.mjs --screens=tag`: **1 erwartet / 1 gefunden / 0 fehlend**.
- `git diff --check`: **grün**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d.

## Abgrenzung

- Das endgültige Ziel **Mail #erinnerung** beziehungsweise **Zahlung** ist laut BAUPLAN bis zum Bau dieser Zielmodule zurückgestellt; diese Korrektur nutzt deshalb ausdrücklich den vorhandenen Objektpfad.
- Login und Eingang wurden nicht verändert. Kein Merge und kein Production-Deploy.
