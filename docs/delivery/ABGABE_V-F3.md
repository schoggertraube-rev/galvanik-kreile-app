# Abgabe V-F3 · Backend-Vorarbeit Auftragskarte

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

## Fähigkeit 1 · Aufträge und KVs gemeinsam lesen

Quelle: `ABGLEICH_SPEC_CODE.md` · F3 / Screen `auftraege` · `Filter KV` · `INHALT_NEU` · Stufe 1.

Der spätere F3-UI-Bau erhält mit `getOrderRegisterDb({ filter })` einen stabilen Serververtrag:

- `filter: "ALL"` liefert Aufträge und offene KVs als gemeinsame, nach Änderungszeit sortierte Liste.
- `filter: "ORDER"` liest ausschließlich Aufträge.
- `filter: "QUOTE"` liest ausschließlich offene KVs.
- Jeder Eintrag kennzeichnet `kind`, Kennung, Nummer, Kunde, Titel, Termin, Status und Änderungszeit.
- Tenant und Nutzer kommen ausschließlich aus der serverseitigen Autorisierung. Der Client kann keine Tenant-Kennung einspeisen.
- Beide Quellen starten nach demselben Rechte-Gate parallel. Fällt eine benötigte Quelle aus, liefert der Vertrag keinen unvollständigen Teilstand.

## Prüfergebnis Fähigkeit 1

- Bestehende Testsuite `w4OperationalOrdersRead.test.ts`: **PASS**, 11/11 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint auf Produktdatei und erweitertem Bestandstest: **PASS**.
- `npm run quality:module-gates`: **PASS**; die KV-Quelle wird ausschließlich über ihre öffentliche Server-Fassade konsumiert.
- Keine Migration, keine Datenänderung, keine neue Tabelle, kein Provider und kein UI-Code.
- `scripts/ui/spec-check.mjs`: **nicht anwendbar**. Regel 4e erlaubt für F3 derzeit ausschließlich Backend-Vorarbeit; F3 ist nicht `bau-frei`, daher wurden keine `data-spec-id` und keine Oberfläche gebaut.

## Was der spätere UI-Bau nutzt

Die Auftragsliste kann den Filter `KV` direkt gegen `filter: "QUOTE"` schalten und für `Alle` denselben Vertrag mit `filter: "ALL"` verwenden. Sie muss keine zwei Serveraktionen aufrufen, Ergebnisse nicht clientseitig zusammenführen und keine zweite fachliche Wahrheit aufbauen.

## Owner-Abnahme

Kein Klickweg in diesem Reservepaket: Eine Oberfläche ist bis `bau-frei` ausdrücklich gesperrt. Der Nachweis ist der tenantgebundene Read-Vertrag mit grünem Bestandstest. In der Datenbank muss nach dem Read **keine neue oder geänderte Zeile** stehen.
