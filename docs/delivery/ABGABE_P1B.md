# Abgabe P1b – Kernweg Kunde & Auftrag

Stand: 26.10.2026, 15:48 Uhr (Europe/Berlin)

## Kandidat

- Branch: `kreile/s1-p1-daten`
- Exakter Produkt-SHA: `4d655c39e65aaf56f63dbf663a0ad571b8a68a44`
- Pull Request: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/153> (Draft, nicht gemergt)
- Preview: <https://galvanik-kreile-werkstatt-cxlmyg9np.vercel.app>
- Datenbank: Entwicklungsprojekt `syhaigjhsbpjmtnggqka`; Repository und Remote stehen auf Migration `20261026180000_p1b_prospect_customer.sql`. Kein Reset, keine Löschung und keine Änderung an einer Produktionsdatenbank.

## Gebaut

| Ergebnis | Stand | Sichtbar |
|---|---|---|
| `+ Anlegen` öffnet die V5-Auswahl „Kunde anlegen“ / „Auftrag / KV anlegen“ | ja | globale Shell |
| „Neuer Eingang“ führt in drei Schritten durch Kunde, Positionen und Abschluss | ja | Schnellaktion und Mehr-Menü |
| Neukunden und Interessenten laufen über `createCustomerCommand` und erhalten eine Kundennummer | ja | Kundenanlage und Neuer Eingang |
| Interessent lässt sich nur mit Name und Telefon speichern | ja | Kundenanlage |
| Unvollständiger Interessent wird sichtbar markiert und kann noch keinen KV/Auftrag starten | ja | Speichern-Erfolg und Kundenkarte |
| Auftrag verlangt weiterhin Ansprechpartner, Telefon, E-Mail, Anschrift und Zahlungsbedingung | ja | Neuer Eingang |
| Startstation und Ortskette verwenden `angenommen → Galvanik → fertig → Zahlung → abgeholt/verschickt` | ja | Auftragskarte |
| Kundenkarte zeigt aktive Aufträge, Schnellaktionen und fehlende Auftragsdaten | ja | Kundenkarte |
| Einstellungen werden über Rollen statt Personennamen freigegeben | ja | `/settings` |
| Vier gebundene CSS-Dateien enthalten 0 feste Hex-Farben und 0 Verläufe | ja | Shell, Auftrag, Kunde, Einstellungen |
| Vercel-Funktionen laufen in `fra1` | ja | Preview-Build `dpl_9CygS8chCvUb8Y8awqKEQ3UkapCD` |

## Abweichungen und offene Belege

- Der im Auftrag übermittelte Rolf-Code wurde der Ausführung nur als maskierter Platzhalter `[CODE]` bereitgestellt. Er wurde weder gespeichert noch in Repository/Abgabe übernommen. Deshalb fehlen der authentifizierte Rolf-Kernweg und die Rolf-Screenshots weiterhin; dies blockiert nach der Klarstellung vom 26.10. den Beginn von P2 nicht.
- Das exakte Preview wurde geschützt und ohne Abschalten des Vercel-Schutzes geöffnet. Login-Screenshots liegen lokal für 1914×917, 1220×880 und 390×844 unter `output/playwright/p1b-4d655c39/`; der Browserwert bis zur bedienbaren Rolf-Auswahl betrug 0,794 s.
- Die Auftragskarten-Ladezeit konnte ohne authentifizierten Rolf- oder Gregor-Zugang nicht neu gemessen werden.
- Fresh-Replay der neuen Migration war lokal durch den belegten Portkonflikt auf `54322` blockiert. Nach 8,2 s wurde nicht weiter am Werkzeugproblem gearbeitet. Das Remote-Schema wurde vor und nach dem Push abgeglichen; `20261026180000` ist beidseitig vorhanden.
- Der lokale TypeScript-Lauf sowie der kombinierte Lint-/Modulgate-Lauf überschritten jeweils das 30-Sekunden-Limit ohne Fehlerausgabe. Der Vercel-Build am exakten SHA hat TypeScript und den Produktions-Build erfolgreich abgeschlossen; GitHub CI ist grün.
- Der Service-Worker auf geschützten Previews bleibt als Nicht-Blocker auf der Dezember-Liste.

## Prüfstand am exakten SHA

- Gezielte P1b-Tests: 20/20 grün (`createCustomerCommand` und real gerenderter globaler Anlagefluss).
- `git diff --check`: grün.
- GitHub `agentur-gate`: grün.
- Vercel: `Ready`; Funktionen in `fra1`.
- Entwicklungsdatenbank: Migrationen lokal/remote identisch bis `20261026180000`.
- Kein Merge nach `main`, kein Production-Deployment.

## Owner-Abnahme (5 Minuten)

1. Preview öffnen, **Rolf** wählen und den bestehenden Rolf-Code eingeben – erwartet: „Der Tag“ erscheint.
2. **Anlegen → Kunde anlegen** öffnen, nur Name und Telefon eintragen und speichern – erwartet: Interessent erhält eine Kundennummer und wird „unvollständig für Auftrag“ markiert.
3. **Stammdaten vervollständigen** öffnen – erwartet: Kundenkarte nennt die fehlenden Auftragsdaten.
4. Fehlende Pflichtdaten ergänzen und **Neuer Auftrag** öffnen – erwartet: „Neuer Eingang“ startet in Schritt 1/3 mit dem vollständigen Kunden.
5. Zwei Katalogleistungen ergänzen und speichern – erwartet: Auftragskarte öffnet sich mit Station „angenommen“.

## Nächster Schritt

C und D sind belegt abgeschlossen. P2 beginnt gestapelt auf dem P1-Stand mit Stufen-Schalter und Anbieter-Register; M365/Azure bleiben nur aktiv, wenn die Preview-Zugänge real vorhanden sind. Owner-Schritt: keiner vor P2; Merge bleibt ausschließlich beim Owner.
