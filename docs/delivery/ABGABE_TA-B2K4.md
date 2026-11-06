# TA-B3 – Prüfablauf vereinfachen

Stand: in Prüfung. Der Anker ändert keine Produktfunktion und führt keine Datenbankmigration aus.

- Die Scope-Prüfung schützt bestehende Migrationen sowie die gebundenen Planungs- und Referenzquellen. Neue Migrationen, Produktcode, Workflows und Prüfscripte benötigen keine einzelnen Pfadanker. Gebundene Quellen bleiben bis zu einer ausdrücklich gebundenen Aktualisierung gesperrt.
- Der separate Ratchet-Job bleibt als nicht blockierende Warnung bestehen; aus `quality` wurde der Ratchet-Schritt entfernt. Der Judge-Hash ist nur noch Hinweis. Lint, Typen, Unit, Replay, H18, Akzeptanz und generierte Wege bleiben bestehen.
- Ein Erfolg eines bisher erwarteten Fehlerfalls wird als `XPASS` gemeldet, ohne die Suite rot zu färben. Fehler regulärer Fälle bleiben Fehler; Fixture-Vorbereitung bleibt außerhalb der Ausnahmebehandlung.
- PR-Läufe können über `_pr_scope.json` auf die eigenen Seiten und den ersten Fall aller übrigen Seiten begrenzt werden. Main und Nachtlauf prüfen alle Wege. Die Browser laufen im gebundenen Playwright-Container.
- H18 vergleicht neu exportierte Actions mit der Basis und fordert ihre Einordnung; ein statischer Inventar-Hash wird nicht mehr als Sperre verwendet. Bestehende Testnachweise und die Regel, dass Ausnahmen nur schrumpfen, bleiben erhalten.

CI, SHA und READY-Preview des endgültigen Kandidaten werden nach dem Push im PR und im Nachtlauf protokolliert. Der Anker ist bis zu diesen Nachweisen nicht als merge-reif belegt.
