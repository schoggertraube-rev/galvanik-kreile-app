# Abgabe H1 – Auftragskarte wieder verfügbar

Stand: 27.10.2026, Branch `kreile/s1-p2-eingang`

## Ursache

Die Meldung entstand beim Wechsel des Vercel-Branch-Alias zwischen unterschiedlich gebauten
Next.js-Deployments. Ein bereits geladener Client des alten Stands `5c9d31da` rief am inzwischen
umgebogenen Alias eine dort nicht mehr passende Server-Action-ID auf. Der erste Aufruf im
Ladeweg war `getLiveOrderCardAction`; er scheiterte als Transportfehler, bevor die nachgelagerten
Aufrufe für Mehrarbeit, Zahlungsstatus und Katalog ausgewertet werden konnten. Der bisherige
Catch unterdrückte Action und Fehler vollständig.

Gegenprobe: Auf der exakten Produkt-Deployment-URL und nach frischem Laden des aktuellen
Branch-Alias öffnete A-2026-0001 bereits vor der Codekorrektur. Damit war kein Daten- oder
Schemafehler der Dev-Datenbank ursächlich.

## Änderung

- Jede der vier Ladestufen besitzt nun einen sichtbaren, stabilen Fehlercode:
  `ORDER_CARD_ACTION_FAILED`, `ORDER_CARD_EXTRA_WORK_ACTION_FAILED`,
  `ORDER_CARD_PAYMENT_ACTION_FAILED` oder `ORDER_CARD_CATALOG_ACTION_FAILED`.
- Der Catch zeigt den Code in der Auftragskarte und ist nicht mehr stumm.
- Server-Actions und ihre Read-Ports protokollieren Fehler serverseitig mit begrenzter,
  nicht sensitiver Meldung. Erwartete Fehler bleiben strukturierte Rückgabewerte.
- Keine Datenbank-, Rollen-, Session- oder Datenänderung.

## Prüfschritt

Preview des H1-Quellstands:
`https://galvanik-kreile-werkstatt-8b4zqhnwm.vercel.app`

Als Rolf wurden A-2026-0001 bis A-2026-0007 nacheinander geöffnet und jeweils wieder
geschlossen. Ergebnis: **7/7 geöffnet**, keine Meldung „nicht sicher geladen“ und kein
H1-Fehlercode.

- Vercel-Build: `Ready`, Next.js-Kompilierung und TypeScript grün, Funktionen in `fra1`.
- ESLint der sechs geänderten Produktdateien: grün.
- Gezielte Tests: 24/24 grün. Dabei wurde die bereits aus F0 stammende Payment-Testfixture
  minimal an die eingecheckte Rechtewahrheit `perm_view_prices` angeglichen; die
  Zahlungslogik blieb unverändert.
- Vollständiger Precommit-Lauf: TypeScript und Staged-Lint grün; 1004/1052 Unit-Tests grün.
  Die 48 roten Tests liegen außerhalb H1 und betreffen den bereits zuvor eingecheckten,
  inzwischen ans Queue-Ende verschobenen F0-Rechtestand beziehungsweise parallel geänderte
  Endversion-Dateien. Deshalb wurde H1 nach erfolgreichem fokussiertem Nachweis mit
  dokumentierter Hook-Ausnahme committed.

Der Branch-Kopf wird nach dem Commit zusätzlich ausdrücklich per `vercel redeploy` neu
ausgerollt und der Siebener-Lauf gegen diesen finalen Stand wiederholt.

## Owner-Abnahme (5 Minuten)

1. Branch-Preview frisch öffnen und als Rolf anmelden; „Der Tag“ muss erscheinen.
2. A-2026-0001 über „Auftrag öffnen“ öffnen; die vollständige Auftragskarte muss erscheinen.
3. Dasselbe für A-2026-0002 bis A-2026-0007 wiederholen; jede Karte muss ohne
   „nicht verfügbar“ erscheinen.
4. Bei einem künftigen Ladefehler muss in der Meldung ein `ORDER_CARD_…`-Fehlercode stehen.
