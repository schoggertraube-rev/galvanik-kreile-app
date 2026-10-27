# Abgabe F2 · Der Tag

Status: **fertig für Owner-Klicktest**

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Preview (Branch-Alias): <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>

Spec-Stand: `84acb8bd8e8d` · Screens `tag`, `spaeter`, `hbmehr`

## Geändert

- `/` zeigt für Rolf, Meister, Büro und Werkstatt nur die heute tatsächlich zu bearbeitenden Einträge statt einer allgemeinen Auftragsliste oder Verlaufsschau.
- Handlungsbedarf, Heute fällig, Zuordnen, Geld einfordern und Bündel-Vorschlag werden aus realen Aufträgen, offenen Rechnungen, dem eigenen Eingangsentwurf und – soweit extern erreichbar – echten Microsoft-Graph-Nachrichten gebildet.
- Jeder Eintrag wird genau einer sichtbaren Gruppe zugeordnet. Ausgeblendete Gruppen fallen in Handlungsbedarf zurück, sodass Arbeit nicht unsichtbar wird.
- `Anpassen` speichert die sichtbaren Gruppen je Tenant und Login serverseitig.
- `Später` speichert die gewählte Wiedervorlage je Tenant, Login und Eintrag serverseitig.
- `Weitere` kann einen realen Auftrag an den aktiven Phillip-Login delegieren; der vorhandene Auftrags-Schreibweg und dessen Ereignisnachweis bleiben maßgeblich.
- Ein offener F1-Eingangsentwurf erscheint als fortsetzbare Aufgabe. Verwerfen löscht nur diesen eigenen Entwurf über den bestehenden F1-Schreibweg.
- `Zuordnen` bei einer echten Mail öffnet den F1-Eingang mit der Mail als Quelle. Es gibt keinen erfundenen Posteingang und keinen stillen Ersatzdatensatz.
- Additive Migration `20261027203000_f2_today_actions.sql`; keine bestehende Migration geändert.

## Owner-Klickweg (maximal 6 Schritte)

1. Als Rolf in der Preview anmelden und `/` öffnen. Erwartung UI: nur konkrete Aufgaben in den fünf Arbeitsgruppen, keine vollständige Auftragsliste und kein „zuletzt bearbeitet“-Verlauf. Erwartung DB: durch das reine Öffnen keine fachliche Mutation.
2. `Anpassen` öffnen, eine Gruppe ausblenden und speichern. Erwartung UI: die Gruppe verschwindet; ihre vorhandenen Aufgaben stehen unter Handlungsbedarf. Erwartung DB: genau eine passende Zeile in `private.today_preferences` für Tenant und Rolfs `actor_id`.
3. Bei einem Auftrag `Später` öffnen und `Morgen früh` wählen. Erwartung UI: Bestätigung und aktualisierte Lage. Erwartung DB: genau eine passende Zeile in `private.today_reminders` mit Tenant, Rolfs `actor_id`, Eintragsschlüssel und Wiedervorlage.
4. Über `+ Anlegen` einen F1-Eingang beginnen, mit `Entwurf behalten` schließen und zu `/` zurückkehren. Erwartung UI: der eigene Entwurf erscheint in Handlungsbedarf und lässt sich fortsetzen. Erwartung DB: genau eine offene Zeile in `private.intake_drafts` für Rolfs `actor_id`.
5. Bei einem realen Auftrag `Weitere` und `An Phillip delegieren` wählen. Erwartung UI: Bestätigung. Erwartung DB: aktive Zuordnung zum realen Phillip-Login im vorhandenen Auftrags-Zuordnungszustand plus vorhandener Auftrags-Ereignisnachweis.
6. Falls Microsoft Graph weiter `invalid_client` liefert, die Meldung auf `/` prüfen. Erwartung UI: ehrlicher Hinweis „In Klärung“, keine erfundene Mail. Erwartung DB: keine durch den Fehler erzeugte Nachricht. Nach externer Freischaltung muss eine echte unzugeordnete Mail unter Zuordnen erscheinen.

## Prüfschritt

```text
SPEC_CHECK screens=tag,spaeter,hbmehr expected=7 found=7 missing=0
```

- Fokussierte Unit-/Render-Tests: 2 Dateien, 15/15 PASS.
- TypeScript (`npx tsc --noEmit --incremental false`): PASS.
- `npm run quality:module-gates`: PASS.
- `npm run quality:no-fake-production`: PASS.
- ESLint auf den F2-Dateien: PASS.
- Dev-Datenbank: Migration `20261027203000_f2_today_actions.sql` lokal = remote; kein Reset, kein Löschen und keine fachliche Testdatenmutation durch Codex.

## Ehrliche Grenzen

- Microsoft Graph bleibt extern `invalid_client` und damit **In Klärung**. F2 zeigt den Zustand, behauptet aber weder erfolgreichen Mailzugriff noch Maildaten.
- Die Owner-Abnahme erfolgt über den obigen Klickweg. Gemäß Regel 4d wurden kein Codex-Klicktest und keine neuen Bildpaare erzeugt.
- Deployment- und CI-Status werden nach dem Push am exakten Paket-SHA ausgewiesen; es wird nicht auf CI gewartet.
