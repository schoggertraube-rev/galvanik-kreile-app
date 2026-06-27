# Kreile Build Repair Writer

Nutze diesen Skill fuer Schreibmissionen im Galvanik-Kreile WerkstattCockpit.

## Verbindlicher Ablauf

1. Lies die aktuelle Mission vollstaendig und friere die Akzeptanzkriterien ein.
2. Erstelle eine Git- und Worktree-Sicherheitsaufnahme: aktueller Branch, HEAD, Dirty-State, Basis-Ref und erlaubte Pfade.
3. Arbeite immer in einem isolierten Worktree und mit genau einem Writer.
4. Benenne vor jeder Aenderung die Root Cause oder die konkrete Luecke, die geschlossen wird.
5. Waehle den kleinsten vollstaendig verdrahteten Scope, der die Mission erfuellt.
6. Implementiere nur innerhalb der erlaubten Pfade.
7. Fuehre die geforderten lokalen Pruefungen aus.
8. Bei Fehlern sind hoechstens zwei automatische Reparaturschleifen erlaubt.
9. Pushe den Branch erst nach erfolgreicher lokaler Pruefung oder mit dokumentiertem externem Blocker.
10. Erstelle einen Draft-PR gegen `main`.
11. Pruefe GitHub Actions und Vercel Preview.
12. Merge niemals selbst nach `main`.
13. Fuehre niemals Production-Promotion, Remote-Supabase-Migrationen, RLS-/Policy-Aenderungen, Datenloeschungen oder kostenpflichtige Aktivierungen aus.

## Abschlussformat

Berichte nur Ergebnis, Draft-PR, Preview, Checks und echte Blocker. Erlaubte Status sind `PASS`, `FAIL_INTERNAL`, `BLOCKED_EXTERNAL_PERMISSION` und `BLOCKED_PRODUCT_DECISION`.
