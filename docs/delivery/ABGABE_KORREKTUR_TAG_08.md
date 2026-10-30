# Abgabe Korrektur Tag 08 — K15

## Befund

> Rechte nach Rolle statt Bereich (Mails nach meister/buero, Zugang/Delegieren per Rollenliste); ohne Bereiche ganz gesperrt statt Hinweis (K21, K23).

## Neu gemacht

- `src/lib/server/authorization.ts:29`: eine gemeinsame Bereichsprüfung verwendet bei echten Sitzungen ausschließlich die aus `app_user_rights` aufgelösten Bereiche. Der Rollen-Vorlagen-Fallback gilt nur für ältere isolierte Test-Fixtures ohne `areas`-Feld.
- `src/lib/server/todayDashboard.ts:69`: Aufträge, Mails und Geld werden nur geladen, wenn der jeweilige Bereich `auftraege`, `mails` oder `geld` tatsächlich freigegeben ist. Nicht erlaubte Daten gelangen nicht in das Dashboard-Modell.
- `src/lib/server/todayDashboard.ts:111`: ein Weitergabe-Ziel wird nur aus aktiven Logins mit `app_user_rights.bereich = 'auftraege'` gewählt; die bisherige Rollenbedingung `werkstatt` ist entfernt.
- `src/components/home/RolfHome.tsx:33`: „Der Tag“ wird nicht mehr über Rollen- oder Leitstandlisten geöffnet. Ein Login ohne jeden Bereich erhält den eigenen Zustand `no_areas`.
- `src/components/home/RolfHomeClient.tsx:54`: ohne Bereiche erscheint „Noch keine Bereiche freigegeben“ und es werden keine Tagesfelder gezeigt. „Weitere“ und „Ware raus“ werden im Client zusätzlich gegen `auftraege` geprüft.
- `src/lib/server/commands/orderTaskAssignmentCommand.ts:231`: die Weitergabe lehnt serverseitig jeden Aufrufer ohne Bereich `auftraege` ab; das Ziel muss ebenfalls aktiv sein und diesen Bereich besitzen.
- `src/app/actions/today.actions.ts:10`: Speichern der Tagesanordnung erfordert mindestens einen freigegebenen Bereich, Erinnerungen erfordern ausdrücklich `auftraege`.

## Owner-Klickweg (maximal 6 Schritte)

1. In der Dev-Preview als Login mit Bereich `mails` „Der Tag“ öffnen: Das Feld „Zuordnen“ darf erscheinen; bei einem Login ohne `mails` fehlt es vollständig.
2. Als Phillip oder einen anderen Login mit `auftraege` einen Auftragsfall öffnen: „Weitere“ darf sichtbar sein; das Menü darf nur ein aktives anderes Login mit `auftraege` als Ziel anbieten.
3. In „Einstellungen › Personen & Rechte“ bei einem gewählten Dev-Login alle Bereiche entfernen, abmelden und dieses Login neu anmelden.
4. `/` öffnen: Es steht ausschließlich „Noch keine Bereiche freigegeben“; keine Auftrags-, Mail- oder Geldfelder und kein Schnellknopf sind sichtbar.
5. Dem Login nur `kunden` geben und erneut anmelden: „Der Tag“ öffnet, enthält aber keine Auftrags-, Mail- oder Geldfälle. Anschließend die ursprünglichen Rechte wiederherstellen.
6. Datenbank-Nachweis: `public.app_user_rights` enthält nach der Wiederherstellung exakt die ursprünglichen Zeilen. Falls eine Weitergabe getestet wurde, hat der Empfänger eine aktive `auftraege`-Zeile; ohne diese Zeile muss der Server `FORBIDDEN` liefern. Keine Live-Datenbank wurde durch Codex verändert.

## Nachweise

- Fokustests: 54/54 grün, einschließlich Bereichsprüfung, fehlender Bereiche, Client-Weitergaberecht und Root-Routing ohne Developer-Rollenliste.
- TypeScript und gezieltes ESLint: grün.
- `scripts/ui/spec-check.mjs --screens=tag`: `expected=1 found=1 missing=0`.
- `quality:no-fake-production`, `quality:module-gates`, `quality:authority-gate`, `quality:delivery-contracts`: grün.

## Abgrenzung

Die vollständige M5-Weitergabe mit mehreren Zielpersonen, Rückgängig und Status/Frist gehört zu K25. Daher sind die noch fehlenden statischen IDs `hbmehr.weitergeben`, `hbmehr.auftrag-offnen` und `hbmehr.zuruckholen` nicht Teil dieser K15-Korrektur. K15 bindet bereits Sichtbarkeit, Aufrufer und Ziel server- und clientseitig an `app_user_rights`.
