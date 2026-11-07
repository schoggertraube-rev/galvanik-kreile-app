# Review P3 – Termintreue und Der Tag

Geprüft: 26.10.2026 22:30 Berlin (21:30 UTC), Claude (Prüfer)
Branch: `kreile/s1-p3-termine` (nur lokal, nicht gepusht), Kopf `c97d01da`, Produkt-SHA `adac117a`, Basis P2 `5c9d31da`.

## Urteil: keine Blocker – noch kein PASS

Grund kein PASS: Preview, CI und Owner-Kernweg fehlen absichtlich (Reihenfolge Owner: erst PR #154 mergen, dann P3 pushen). Nach Push nur prüfen: CI grün, Preview-Link, 3 Screenshots, Kernweg Rolf Schritte 1–5.

## Geprüft ohne Befund

- Verbotene Dateien: keine (36 Dateien, nur src/, eine neue Migration, ABGABE_P3).
- Alte Migrationen unverändert; neue Migration `20261026200000` nur CREATE OR REPLACE VIEW mit `security_invoker = true`, kein DELETE/DROP/TRUNCATE.
- DB: Remote 34 = Branch 34 (bis `20261026200000`). Synchron mit P3-Branch.
- Rechte: Lesen `perm_view_leitstand`, Schreiben `perm_data_orders`, Server Action prüft Session neu.
- Ohne Microsoft Graph: „In Klärung“, kein Erfolgsclaim, kein aktiver Speichern-Knopf (fail-closed).
- Outlook-Schreiben idempotent per Anfragekennung, ungeklärter Ausgang wird als „nicht erneut anlegen“ gemeldet.
- Farben: CalendarWeekView.module.css nur `var(--…)`; keine neuen Hex/RGB im Diff.
- Keine Demo-Daten im Produktpfad gefunden.

## Hinweis (kein Blocker)

- Migration ist im gemeinsamen Entwicklungsprojekt bereits angewandt, im Repo origin aber noch nicht vorhanden (origin 33, Remote 34). Solange P3 nicht gepusht ist, darf niemand von origin eine weitere Migration mit älterer Zeitmarke anwenden. → DEZEMBER_LISTE.
