# Abgabe F1 · Neuer Eingang

Status: **fertig für Owner-Klicktest**

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Preview (Branch-Alias): <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>

Spec-Stand: `45238792dd0f` · Screens `eingang`, `kundeneu`, `kamera`, `beleg`, `mailein`, `entwurf`

## Geändert

- „Neuer Eingang“ folgt der Endversion als große Erfassungsseite mit Kunde, Positionen, Termin/Übergabe, Belegen und Prüfung; auf kleinen Geräten bleibt der Ablauf schrittweise.
- Neukunde und Auftrag werden in einer Datenbanktransaktion angelegt. Scheitert der Auftrag, bleibt kein verwaister Neukunde zurück.
- Foto und Dokument werden vor der Buchung privat gespeichert, durch die vorhandene Azure-Anbindung ausgewertet und nach erfolgreichem Buchen dem Auftrag zugeordnet.
- Outlook-Eingänge werden über die vorhandene Graph-Anbindung geladen und können Kunde oder Auftrag zugeordnet beziehungsweise in den Eingang übernommen werden.
- Abbrechen/Escape bietet „Entwurf behalten?“. Der Entwurf wird serverseitig genau je Tenant und Login gespeichert, auf anderen Geräten wieder aufgenommen oder verworfen.
- Kundennotizen werden über einen tenant- und rollenbegrenzten Schreibweg gespeichert; die Änderung erzeugt einen idempotenten Ereignisnachweis.
- Fehler lassen die Eingaben sichtbar. Nach „Weiter bearbeiten“ kann der Dialog erneut korrekt geschlossen werden.
- Capability-Register wurde für die bereits vorhandenen und neuen realen Actions/Routes nachgezogen; keine Mock- oder stille Erfolgsfunktion wurde ergänzt.

## Owner-Klickweg

1. Als Rolf in der Preview anmelden und `+ Anlegen` öffnen. Erwartung: „Neuer Eingang“ mit Kunde, Positionen, Termin/Übergabe und Prüfung; DB unverändert.
2. `Neukunde anlegen` wählen, einen eindeutig mit `TEST F1` benannten Kunden vollständig erfassen, eine Freitext-Position und Liefertermin eintragen und die gemeinsame Prüfung bestätigen.
3. Optional Foto oder PDF hinzufügen. Erwartung: Original bleibt privat, erkannte Vorschläge müssen bestätigt werden; vor dem Buchen gibt es noch keinen Auftrag.
4. `Wareneingang buchen` einmal auslösen. Erwartung: Erfolg mit Auftragsnummer; DB enthält genau einen neuen `customers`- und einen neuen `orders`-Datensatz sowie mindestens eine passende Position, gemeinsam über `customer_id` verbunden. Kein Kunde ohne Auftrag.
5. Einen zweiten Eingang beginnen, Angaben machen, schließen und `Entwurf behalten` wählen. Eingang erneut öffnen. Erwartung: Werte sind wieder da; DB enthält für Rolfs `actor_id` genau eine offene Zeile in `private.intake_drafts` und keine für einen anderen Login.
6. `Aus Mail` öffnen. Erwartung bei weiterhin bestehendem Graph-Fehler: ehrlicher Fehlercode/„In Klärung“, kein erfundener Posteingang und keine DB-Zeile. Nach externer Freischaltung muss eine echte Mail zuordenbar sein und eine Zeile in `communication_messages` erzeugen.

## Prüfschritt

```text
SPEC_CHECK screens=eingang,kundeneu,kamera,beleg,mailein,entwurf expected=19 found=19 missing=0
```

- Fokussierte Command-/Render-Tests: 2 Dateien, 21/21 PASS.
- TypeScript (`npx tsc --noEmit --incremental false`): PASS.
- `npm run quality:module-gates`: PASS.
- `npm run quality:no-fake-production`: PASS.
- `npm run lint:full`: PASS ohne Fehler (zwei bestehende A11y-Warnungen in `Befehlspalette.tsx`).
- Dev-Datenbank: Migration `20261027193000_f1_intake_drafts.sql` lokal = remote; kein Reset, kein Löschen und keine fachliche Testdatenmutation durch Codex.

## Ehrliche Grenzen

- Microsoft Graph bleibt extern `invalid_client` und damit **In Klärung**. F1 zeigt diesen Zustand, behauptet aber keinen erfolgreichen Mailzugriff.
- Der Terminstatus „Wunsch/bestätigt“ verwendet in Stufe 1 dasselbe bestehende Auftrags-Datumsfeld; es wurde keine zweite Terminwahrheit eingeführt.
- „KV gültig bis“ wird bis zu einem späteren strukturierten KV-Feld nachvollziehbar in der KV-Notiz gespeichert.
- Kein Codex-Klicktest und kein Screenshot: Ab Q11 ersetzt Regel 4d diese Nachweise durch den Owner-Klickweg und den statischen Spec-Check. Deployment- und CI-Status werden nach dem Push am exakten Commit bewertet.
