# ABGABE H15 · Live erreichbaren Müll entfernen

Stand: `855961db8c55b3869897c378e924557a6ee6e776`
Branch: `kreile/s1-p2-eingang` · PR #154
Preview: <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>

## Befund und Ergebnis

Ausgangsbefund: Neben dem freigegebenen Kern waren Stub-Endpunkte, ein zweiter Erfassungsfluss, Fake-Lizenz-/Quota-Code, Demo-Shortcuts sowie drei kaputte Altbereiche vorhanden (`_review/SAUBERKEIT_AUDIT_2026-10-28.md:37`, `_review/AKTUELLE_ANWEISUNG.md:61`). H15 wurde ausschließlich auf diese feste Liste begrenzt; der übrige tote Code blieb unangetastet.

- `d68a6164f0fb91b7ddbed646b66eb642cfd13d4a`: 17 quarantänisierte API-Routen und ihre zwei reinen Alt-Tests entfernt. Die entfernten URLs liefern `404`.
- `b698281c9afb4023bbff5b306a1b4feebe7b21ec`: `/api/users`, `quarantine.ts`, Fake-Lizenz/Quota, die Demo-Shortcut-Einhängung sowie getrackte Sicherungs-/Logdateien entfernt.
- `cd88abf463315d1c960788794dbe2e676d79f489`: elf unverbundene Blätter des zweiten Erfassungsflusses entfernt.
- `ab589286e8a10ee699385043718445885f457f5c`: den restlichen zweiten Erfassungsfluss `src/components/erfassung/**` entfernt. Seine zwei noch vorhandenen Aufrufer verwenden jetzt den kanonischen Eingang (`src/components/layout/KreileHeader.tsx:12,124,147`; `src/components/kommunikation/kommandozentrale/Kommandozentrale.tsx:12,684`).
- `6c03e45cc891736550c1108f6e2abba646ebfc44`: die Altbereiche `/lager`, `/kontrolle`, `/performance` und die ausschließlich von ihnen verwendeten Drizzle-Einträge `lager_artikel`/`qs` entfernt. Die Verkaufsstufen-Sperre liefert für diese Direkt-URLs `404` (`src/proxy.ts:11,28,79`).
- `855961db8c55b3869897c378e924557a6ee6e776`: sechs nur noch durch Alt-Tests gehaltene Stub-Actions und die zugehörigen Testverträge entfernt. Eine mechanische Skriptreferenz wurde im selben Block mit entfernt.

Jeder Produktcommit umfasst höchstens 20 Dateien. Suche nach `src/components/erfassung/**`, `license.config`, `AppShortcutOverlay`, `lager_artikel` und dem Drizzle-Export `qs` ergibt im Produktpfad keinen Treffer. Getrackte `*.bak`, `*.disabled` und `*.log` sind nicht mehr vorhanden.

## Prüfung

- Fokussierte Erfassungsprüfung: 4 Testdateien, 18 Tests grün.
- Fokussierte Stub-Action-Prüfung: 2 Testdateien, 5 Tests grün.
- TypeScript: `tsc --noEmit --incremental false` grün.
- Produktions-Build nach jedem aktuellen H15-Unterpunkt grün; letzter Build kompiliert und erzeugt 9 statische Seiten ohne Fehler.
- Authentifizierter HTTP-Smoke gegen den letzten lokalen Produktions-Build: 12 verbleibende Seiten `200`.
- Direkt-URLs `/buchhaltung`, `/lager`, `/kontrolle`, `/performance`, `/api/users` sowie alle 17 entfernten Stub-API-Routen: `404`.
- UI-Spec-Check `login,tag,auftrag,kunde,einstellungen`: `expected=4`, `found=4`, `missing=0`.
- `knip` wurde nur als Bericht ausgeführt: **362 ungenutzte Dateien**. Sie wurden gemäß H15 nicht massenhaft gelöscht.
- CI am Produkt-SHA: Agentur-Gate und Vercel liefen bei Erstellung dieser Abgabe noch. Nach Regel 4c wurde nicht gewartet; ein späteres rotes Ergebnis hat Vorrang.

## Datenbank-Soll

H15 schreibt keine Fachdaten und enthält keine Migration. Kunden, Aufträge, Rechnungen, Zahlungen, `app_users` und `app_user_rights` bleiben unverändert. Die entfernten Drizzle-Einträge `lager_artikel` und `qs` hatten laut Audit keine entsprechende Tabelle in der Dev-Datenbank; es wurde keine Remote-Tabelle gelöscht.

## Owner-Abnahme (5 Minuten)

Rolle: Rolf · Preview-Link oben, sobald Vercel den Abgabe-SHA als READY zeigt.

1. Auf `/start` als Rolf anmelden. Erwartung: **Der Tag** lädt ohne Demo-/WIP-Hinweis; DB unverändert.
2. Einen vorhandenen Auftrag öffnen. Erwartung: Auftragskarte mit echten Daten lädt; DB unverändert.
3. Aus der Auftragskarte den Kunden öffnen. Erwartung: Kundenkarte mit echten Daten lädt; DB unverändert.
4. **Einstellungen** öffnen. Erwartung: Personen und Rechte laden; DB unverändert.
5. `/lager`, `/kontrolle` und `/performance` direkt aufrufen. Erwartung: jeweils ehrliche `404`, keine Ersatz- oder Demoseite; DB unverändert.
