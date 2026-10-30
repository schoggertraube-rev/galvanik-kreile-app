# Abgabe H3 · Code ändern mit sichtbarem Fehlerpfad

Status: **fertig für Owner-Klicktest**

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Preview (Branch-Alias): <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>

## Ursache

- `SettingsAdminClient.report()` und drei weitere Action-Aufrufe in derselben Oberfläche behandelten nur erfolgreich aufgelöste Promises. Wurde der Server-Action-Request auf Transport-/Deployment-Ebene verworfen, blieb die Promise-Ablehnung ohne sichtbare Meldung.
- Der Preview-Nachweis passt dazu: Vercel protokollierte am 27.10.2026 um 20:07:31 Uhr einen `POST /settings` mit HTTP 200, aber in der Dev-Datenbank entstanden weder `own_pin_changed` noch ein aktualisiertes `app_users.updated_at`. Der Schreibbefehl wurde damit nicht erfolgreich ausgeführt; die Oberfläche verschluckte den Fehler.
- Ein genauerer Provider-Unterfehler ist in den historischen Vercel-Logs nicht enthalten. Deshalb wird kein nicht belegter Action-ID-Fehler behauptet.

## Geändert

- Gemeinsamer Client-Helfer `runServerAction` fängt verworfene Action-Requests ab, protokolliert sie und zeigt stabil `Fehlercode: ACTION_REQUEST_FAILED` mit der Aufforderung zum Neuladen.
- Alle Server-Action-Aufrufe in `SettingsAdminClient` nutzen den gemeinsamen Fehlerpfad: eigener Code, Nutzerstammdaten/neuer Nutzer-Code, Firmendaten, Login anlegen, Stundensatz, Leistung und Rechtematrix.
- Ein globaler Client-Rückfall zeigt denselben sicheren Fehlercode, wenn ein anderer Action-Aufruf in der App unerwartet ohne lokalen Fehlerpfad abgelehnt wird; die Ablehnung bleibt zusätzlich in der Browserkonsole sichtbar.
- Eigener Code und Nutzer-Code haben zusätzlich einen serverseitigen Catch mit den sicheren Codes `SETTINGS_OWN_PIN_ACTION_FAILED` beziehungsweise `SETTINGS_USER_ACTION_FAILED`. Erreicht der Request den Server und scheitert dort unerwartet, bleibt der Fehler ebenfalls sichtbar und steht im Serverlog.
- Optimistische Rechteänderungen werden auch bei einem Transportwurf zurückgesetzt.
- Es wurden weder Codes gespeichert noch Daten in der Dev-Datenbank verändert.

## Owner-Klickweg (maximal 6 Schritte)

1. Mit einem bestehenden Login anmelden, `/settings` öffnen und unter `Mein Code ändern` einen neuen vierstelligen Code zweimal eingeben. `Code speichern` klicken. Erwartung UI: `Neuer Code gespeichert.` Erwartung DB: genau ein neues `ui_events.event_type = 'own_pin_changed'` für den Login und dessen `app_users.updated_at` ist aktuell.
2. Abmelden und denselben Login mit dem neuen Code wieder anmelden. Erwartung UI: Anmeldung nach vier Ziffern erfolgreich; der vorherige Code funktioniert nicht mehr.
3. Als Gregor `Einstellungen` → `Logins & Rechte` öffnen, bei einem anderen bestehenden Login im Feld `Neuer Code` einen neuen vierstelligen Code eintragen und `Ändern` klicken. Erwartung UI: `<Name> gespeichert.` Erwartung DB: genau ein neues `ui_events.event_type = 'login_updated'` für diesen Nutzer und dessen `app_users.updated_at` ist aktuell.
4. Abmelden und den geänderten Nutzer mit seinem neuen Code anmelden. Erwartung UI: Anmeldung erfolgreich und Rollen-Home unverändert passend.
5. Falls ein Action-Request nicht ankommt, darf die Oberfläche nicht still bleiben. Erwartung UI: Meldung mit `Fehlercode: ACTION_REQUEST_FAILED` oder einem der beiden sicheren `SETTINGS_*_ACTION_FAILED`-Codes; Erwartung DB: bei dieser Fehlermeldung keine behauptete erfolgreiche Codeänderung.

## Prüfschritt

```text
SPEC_CHECK screens=rechte,meincode expected=5 found=5 missing=0
SETTINGS_UNHANDLED_THEN=0
```

- Fokussierter Render-/Interaktionstest: 1 Datei, 10/10 PASS; eigener Code und Nutzer-Code zeigen bei verworfenem Action-Request den Fehlercode.
- TypeScript (`npx tsc --noEmit --incremental false`): PASS.
- ESLint auf allen H3-Dateien: PASS.
- `npm run quality:module-gates`: PASS.
- `npm run quality:no-fake-production`: PASS.
- Kein Codex-Klicktest und kein Screenshot: Regel 4d bindet stattdessen den obigen Owner-Klickweg und den statischen Spec-Check.
