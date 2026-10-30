# Abgabe Korrektur Login 01

## Befund

> developer (developer) wird hart nach /settings geleitet; Start laut Spec = Wartung, Der Tag muss für developer erreichbar sein (K17).

Beleg aus dem Bauplan: `src/app/page.tsx:21`; `src/app/actions/auth.ts:88`.

## Neu gemacht

- Die gemeinsame Startseite leitet nur die historische Rolle `admin` weiter nach Einstellungen. Ein Login mit Vorlage `developer` rendert gemäß aktueller `login.start_regel` **Der Tag** (`src/app/page.tsx:21–23`).
- Die E-Mail-Anmeldung endet wie die PIN-Anmeldung am gemeinsamen Startziel `/`, statt einen eigenen Developer-Sonderweg nach `/settings` zu verwenden (`src/app/actions/auth.ts:88`).
- Der serverseitige Tages-Adapter und sein Clientvertrag akzeptieren `developer` als erlaubte Rolle (`src/components/home/RolfHome.tsx:33`; `src/components/home/RolfHomeClient.tsx:12`).
- Einstellungen bleiben für Developer über die normale Navigation erreichbar; lediglich der harte Start-Redirect entfällt.
- Die fokussierten Tests trennen den historischen Admin-Fall vom Developer-Fall und prüfen beide Loginwege (`src/app/__tests__/w2cB2m5u.homeDueTruth.realRender.test.tsx:60–71`; `src/app/start/__tests__/start-page-payload.test.tsx:153`).

## Datenbank-Nachweis

- Dieses Paket ändert weder Schema, Migrationen noch fachliche Daten.
- Eine erfolgreiche Anmeldung schreibt weiterhin über den unveränderten Loginvertrag genau den aktuellen Blick in `private.user_last_seen` und das Ereignis `USER_LAST_SEEN_RECORDED_V1`; nur das anschließende Ziel ändert sich.
- Rollen, Bereiche und Sitzungsinhalt werden nicht verändert.

## Klickweg für den Owner

Branch-Preview: `https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app` · Login Gregor.

1. Abmelden, Gregor wählen und mit dem vorhandenen Code anmelden. Nach der vierten Ziffer muss `/` mit **Der Tag** öffnen; keine automatische Umleitung nach `/settings`.
2. Über die Navigation **Einstellungen** öffnen. Der Bereich muss weiterhin erreichbar sein.
3. Falls die E-Mail-Anmeldung für Gregor eingerichtet ist: erneut abmelden und per E-Mail anmelden. Auch dieser Weg muss auf `/` mit **Der Tag** enden.
4. In der Dev-Datenbank prüfen: Gregors Zeile in `private.user_last_seen` hat einen aktuellen `last_seen_at`-Wert und das jüngste zugehörige Event hat `event_type = 'USER_LAST_SEEN_RECORDED_V1'`; Rolle und Bereiche bleiben unverändert.

## Prüfergebnis

- Fokussierte Tests: **3 Dateien / 24 Tests grün**.
- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der sechs betroffenen Produkt-/Testdateien: **0 Fehler**.
- `npm run quality:module-gates`: **grün**.
- `git diff --check`: **grün**.
- `node scripts/ui/spec-check.mjs --screens=login,tag`: **4 erwartet / 3 gefunden / 1 fehlend**. Offen bleibt die bereits bekannte, getrennte Login-ID `login.email-anmelden`; die Routingkorrektur ergänzt dafür keinen falschen Platzhalter.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Solange Wartung nicht gebaut ist, verlangt die aktuelle `login.start_regel` ausdrücklich **Der Tag** für Developer. Eine spätere Umschaltung auf Wartung gehört nicht in dieses Paket.
- Keine Migration, keine Echtdatenänderung, kein Merge und kein Production-Deploy.
