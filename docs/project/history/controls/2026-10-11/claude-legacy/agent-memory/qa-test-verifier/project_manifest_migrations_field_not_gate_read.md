---
name: manifest-migrations-field-not-gate-read
description: Modul-Manifest-Feld `migrations` wird von keinem Gate gelesen und ist rein dokumentarisch; werkstatt.manifest.json ist aber KEIN Praezedenzfall fuer eine unvollstaendige Liste.
metadata:
  type: project
---

Streitpunkt, der in PR #115 (Paket B2) mehrfach wiederkam: ob eine `migrations`-Liste
im Modul-Manifest Eigentum "ratifiziert" und ob eine unvollstaendige Liste blockiert.

Nachgemessener Enforcement-Stand (2026-09-28):

- `scripts/quality/check-module-gates.mjs` enthaelt NULL Vorkommen von `migrations`.
  Das Feld wird von diesem Gate nicht gelesen.
- `docs/architecture/MODULE_MANIFEST.schema.json:37` definiert `migrations` als
  optionales Array mit `default: []`; `required` ist nur
  `["moduleId", "version", "owner"]`. Beschreibung: "Filenames under
  supabase/migrations/ that this module owns and is responsible for evolving."
  Also Dokumentation, kein Vertrag, keine Vollstaendigkeitspruefung.
- Gate-relevant ist stattdessen `viewsFunctions`: check-module-gates akzeptiert nur
  `v_*`-Views, die irgendein Manifest deklariert (Naht 4). `ownsTables` wird gelesen
  (Eindeutigkeit, Fremdtabellen-Zugriff).
- `scripts/quality/check-w4-candidate-schema.mjs` liest zwar `*.migrations`, aber das
  ist der W4-Runtime-Contract, NICHT das Modul-Manifest. Sein `EXPECTED_LEDGER` ist auf
  13 Migrationen bis `20260812103446` gepinnt — neue Migrationen von Ende September
  liegen strukturell ausserhalb und koennen W4 nicht brechen.

**Wichtige Korrektur an einem wiederkehrenden Argument:** `werkstatt.manifest.json`
taugt NICHT als Praezedenz fuer eine unvollstaendige `migrations`-Liste. Ihre Liste ist
vollstaendig — `public.v_werkstatt_kpis_v1` wird ausschliesslich in
`20260908101500_werkstatt_kpi_view.sql` definiert, und genau die ist gelistet.
Praezedenziert ist dort nur das Muster `ownsTables: []` / `events.emits: []` bei
gefuelltem `viewsFunctions`.

**Why:** Ein Reviewer hat daraus "Manifest formalisiert Eigentum trotz offener Frage"
als P1 gemacht, ein Architekt hat mit "identisches Muster existiert auf main"
gegengehalten. Beide Haelften stimmen nur teilweise: die Nicht-Enforcement-Seite
traegt, die Praezedenz-Seite traegt nicht.

**How to apply:** Eine fehlende Migration in `migrations` ist kein CI-Blocker und kein
Eigentumsakt — aber auch nicht durch Praezedenz gedeckt, also vor Merge zu schliessen
statt als "gibt es schon so" wegzuwinken. Zonen-/Zeitkontext siehe
[[b2-fixture-timezone-artifact]].
