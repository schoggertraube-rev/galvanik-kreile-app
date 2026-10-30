# Abgabe Korrektur Mail-Eingang 01

## Befund

> „Neuer Eingang aus Mail“ legt immer einen Neukunden an, obwohl der Absender-Kunde gefunden wurde (Dubletten).

Beleg aus dem Bauplan: `src/components/layout/F1SourceDialogs.tsx:108–112,212`; `src/components/layout/GlobalCreateFlow.tsx:1771–1779`.

## Neu gemacht

- Der Mail-Dialog übergibt beim Start eines neuen Eingangs nicht mehr nur die Mail, sondern den dort eindeutig ausgewählten oder vorgeschlagenen vollständigen Bestandskunden (`src/components/layout/F1SourceDialogs.tsx:19`, `:48`, `:244`).
- Der Bestandskunde wird direkt aus derselben realen Kundenabfrage übernommen. Der Eingang ist dadurch unabhängig davon, ob die parallele Kundenliste des darunterliegenden Dialogs bereits geladen ist (`src/components/layout/GlobalCreateFlow.tsx:2161`).
- Ein automatischer Vorschlag entsteht nur, wenn die normalisierte Absenderadresse genau einem Kunden gehört. Bei zwei Kunden mit derselben E-Mail bleibt die Auswahl bewusst leer; es wird nichts geraten (`src/components/layout/F1SourceDialogs.tsx:140`).
- Der Eingang setzt bei eindeutigem Treffer Bestandskunden-ID, Kundendaten und Zahlungsmodus. Nur ohne ausgewählten Treffer wird Name und E-Mail des Absenders als Neukunde vorbelegt.
- Der reale Render-Test belegt beide Fälle: eindeutiger Treffer bleibt Bestandskunde; doppelte E-Mail wird nicht automatisch einem Kunden zugeschlagen (`src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx:311`, `:346`).

## Datenbank-Nachweis

- Dieses Paket ändert kein Schema und keine bestehenden Daten.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: lokale und entfernte Migrationsliste sind unverändert und bis einschließlich `20261028014500` identisch.
- Beim Owner-Klick muss der neue Auftrag die ID des bereits vorhandenen Kunden tragen. Für die Absenderadresse darf dabei keine weitere Kundenzeile entstehen.

## Klickweg für den Owner

Branch-Preview: `https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app` · Rolle Rolf.

1. **Anlegen → Aus Mail** öffnen und eine Mail wählen, deren Absenderadresse genau einem vorhandenen Dev-Kunden gehört. Beim Kundenfeld muss dieser Bestandskunde vorgeschlagen sein.
2. **Neuer Eingang aus Mail** wählen. In Schritt 1 muss die Kundenkarte des vorgeschlagenen Bestandskunden erscheinen; der Absender darf nicht als Neukunde vorbelegt sein.
3. Fehlende Pflichtdaten und eine Position ergänzen, dann den Eingang prüfen und buchen. Die Auftragskarte muss den neuen Auftrag für genau diesen Kunden öffnen.
4. Datenbank prüfen: `orders.customer_id` des neuen Auftrags entspricht der vorhandenen Kunden-ID; die Anzahl der Kundenzeilen mit dieser normalisierten E-Mail ist gegenüber Schritt 1 unverändert; die Graph-Nachrichten-ID ist dem Vorgang zugeordnet.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der drei betroffenen Produkt-/Testdateien: **0 Fehler**.
- Gezielter realer Render-Test: **1 Datei / 21 Tests grün**.
- `npm run quality:module-gates`: **grün**.
- `node scripts/ui/spec-check.mjs --screens=mailein`: **8 erwartet / 4 gefunden / 4 fehlend**. Die korrigierte Hauptaktion `mailein.neuer-eingang-aus-mail` ist vorhanden. Offen sind die nicht zu dieser einzelnen Hoch-Korrektur gehörenden BAUPLAN-Aktionen `andere-mail`, `nicht-zuordnen`, `spaeter` und `uebernehmen`; es wurden keine falschen Platzhalter-IDs ergänzt.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Dieses Paket behebt ausschließlich den hoch priorisierten Dublettenbefund. Fehler-/Erfolgszustände und der Einstieg „Zuordnen“ aus „Der Tag“ bleiben die getrennten mittleren Mail-Korrekturen im BAUPLAN.
- Keine Migration, keine Echtdatenänderung, kein Merge und kein Production-Deploy.
