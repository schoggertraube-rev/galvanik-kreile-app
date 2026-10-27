# Abgabe Q6b Rest · Eingehende Mail zuordnen

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Preview nach erfolgreichem Vercel-Check: <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>

## Geändert

- Der vorhandene Graph-Posteingang wird in „Neuer Eingang → Aus Mail“ gelesen.
- Jede sichtbare Mail hat jetzt eine eigene Kunden- und Auftragsauswahl. Ein exakt passender Absender wird als vorhandener Kunde vorausgewählt; ohne Treffer bleibt die Auswahl ehrlich leer.
- „Kunde zuordnen“ und „Auftrag zuordnen“ schreiben weiterhin ausschließlich über den vorhandenen transaktionalen Kommunikations-Port. Mail und unterstützte Anhänge landen am gewählten Vorgang.
- Die bestehende Zugangsfläche `mails` ist jetzt im Client und im Server die gemeinsame Freigabe. Kundenrechte oder die Rolle `developer` öffnen den Mailweg nicht mehr ersatzweise.
- Keine Migration, keine neue Tabelle, keine Provideränderung und keine Mutation der Entwicklungsdatenbank durch Codex.

## Prüfergebnis

- `node scripts/ui/spec-check.mjs --screens=mailein`: **PASS**, `expected=5 found=5 missing=0`
- Gezielter bestehender Vitest-Lauf: **PASS**, 4 Dateien / 43 Tests
- `npx tsc --noEmit --incremental false`: **PASS**
- ESLint auf allen geänderten Produkt- und Testdateien: **PASS**
- `git diff --check`: **PASS** für die Paketdateien
- Live-Graph-Eingang und Datenbankzeilen: gemäß Regel 4d erst durch den folgenden Owner-Klick belegt; bis dahin kein Live-Erfolgsclaim.

## Owner-Abnahme (höchstens 6 Schritte)

Rolle: **Rolf** · Preview-Link oben

1. Zwei neue Mails mit eindeutigen Betreffzeilen `TEST Q6b Kunde <Zeit>` und `TEST Q6b Auftrag <Zeit>` an das verbundene Testpostfach senden. Erwartung: Beide Mails liegen im Postfach; in der App ist noch keine neue Kommunikationszeile entstanden.
2. Preview öffnen, als Rolf anmelden und `Anlegen → Aus Mail` wählen. Erwartung: Beide Betreffzeilen erscheinen mit Absender und Vorschau.
3. Bei der ersten Mail einen vorhandenen Kunden wählen – bei exakt passender Kunden-E-Mail ist er bereits vorausgewählt – und `Kunde zuordnen` klicken. Erwartung: „Mail und unterstützte Anhänge sind am Vorgang abgelegt.“
4. Bei der zweiten Mail einen vorhandenen Auftrag wählen und `Auftrag zuordnen` klicken. Erwartung: dieselbe Erfolgsmeldung.
5. Prüfer liest die Entwicklungsdatenbank. Erwartung: genau zwei neue eingehende `communication_messages` zu den beiden TEST-Betreffzeilen; der erste Thread hat `customer_id` und kein `order_id`, der zweite hat `order_id` und den zugehörigen `customer_id`. `direction='IN'`, Graph-Quellkennung und Tenant-Zuordnung sind gesetzt.

## Offen / ehrlich abgegrenzt

- Die Preview des neuen Branch-Kopfs und deren CI/Vercel-Status entstehen erst durch den Push dieses Commits. Regel 4c verbietet das Warten; ein später roter Check wird vor der nächsten Reservefähigkeit behoben.
- Kein Screenshot: Regel 4d verbietet Codex-Klicktests und Screenshots ab Q11+ beziehungsweise für diese Reservearbeit ausdrücklich.
- Eine einzelne Graph-Mail wird wegen der vorhandenen idempotenten Quellkennung nur einmal fachlich importiert. Für den Nachweis von Kunden- und Auftragszuordnung werden deshalb zwei verschiedene TEST-Mails verwendet.
