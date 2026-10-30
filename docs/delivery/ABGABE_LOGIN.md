# Abgabe LOGIN · Endversion Screen 0

Status: **fertig für Owner-Klicktest**

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Preview (Branch-Alias): <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app/start>

Spec-Stand: `84acb8bd8e8d` · Screen `0 login`

## Geändert

- `/start` entspricht dem bau-freien Login-Screen: eine mittige Spalte, Uhrzeit-Begrüßung, aktive Logins als Kreise, vier Codepunkte und runder Ziffernblock.
- Die zuletzt auf diesem Gerät verwendete Person bleibt vorausgewählt; der aktive Kreis ist mit dem Amber-Ring markiert.
- Die Code-Eingabe erhält beim Öffnen Fokus. Ziffern und Rücktaste funktionieren auf der Desktop-Tastatur; nach der vierten Ziffer wird genau einmal automatisch angemeldet.
- Fehler leeren den Code, markieren und schütteln die Punkte und verschwinden mit der nächsten Eingabe.
- Nur beim `developer` erscheint `Mit E-Mail anmelden`. E-Mail und Passwort werden im selben einspaltigen Screen erfasst; `Mit Code anmelden` führt zurück. Der Server lehnt E-Mail-Login für alle anderen Rollen ab.
- Die Darstellung verwendet ausschließlich die eingebundenen Designsystem-Tokens; im Login-CSS stehen keine festen Hex-Farben.

## Owner-Klickweg

1. Preview `/start` auf Desktop öffnen. Erwartung UI: eine Spalte mit Begrüßung, genau den aktiven Logins als Kreise, vier Punkten und rundem Ziffernblock. Erwartung DB: keine Änderung.
2. Rolf auswählen und den vorhandenen vierstelligen Code per Tastatur eingeben. Erwartung UI: automatische Weiterleitung nach Ziffer vier, kein Anmeldeknopf. Erwartung DB: nur Rolfs `last_seen` und Sitzung werden aktualisiert.
3. Abmelden, Gregor auswählen. Erwartung UI: zusätzlich erscheint `Mit E-Mail anmelden`; bei Rolf und Phillip fehlt dieser Link. Erwartung DB: keine Änderung.
4. `Mit E-Mail anmelden` anklicken. Erwartung UI: E-Mail, Passwort, `Anmelden` und `Mit Code anmelden` stehen in derselben Spalte; kein Dialog und kein zweiter Bildschirm. Erwartung DB: ohne Absenden keine Änderung.
5. `Mit Code anmelden` anklicken und einmal einen falschen Code eingeben. Erwartung UI: rote, kurz schüttelnde Punkte und Fehlermeldung; der Code ist leer und die nächste Ziffer entfernt die Meldung. Erwartung DB: fehlgeschlagener PIN-Versuch wird nur in der bestehenden Login-Sperrlogik erfasst.

## Prüfschritt

```text
SPEC_CHECK screens=login expected=3 found=3 missing=0
```

- Login-nahe Unit-/Render-Tests: 3 Dateien, 13/13 PASS.
- TypeScript (`npx tsc --noEmit --incremental false`): PASS.
- ESLint auf allen geänderten TS-/TSX-Dateien: PASS.
- Login-CSS: 0 feste Hex-Farben.
- Keine Migration und keine fachliche Datenänderung.

## Nachweisgrenze

Kein Codex-Klicktest und kein Screenshot: Ab Q11 ersetzt Regel 4d diese Nachweise durch den Owner-Klickweg und den statischen Spec-Check. Deployment- und CI-Status werden erst nach dem Push am exakten Commit bewertet.
