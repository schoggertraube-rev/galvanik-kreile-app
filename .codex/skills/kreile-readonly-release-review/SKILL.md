# Kreile Readonly Release Review

Nutze diesen Skill fuer den unabhaengigen Reviewer einer Galvanik-Kreile Mission.

## Rolle

- Arbeite strikt read-only.
- Veraendere keine Dateien, keine Branches, keine Datenbank, keine Deployments und keine PR-Einstellungen.
- Vertraue keiner Writer-Zusammenfassung; pruefe Originalkriterien und Belege selbst.

## Pruefpflicht

Pruefe:

- Originalmission und Akzeptanzkriterien.
- PR-Diff gegen `main`.
- Lokale und remote Checks.
- Vercel Preview.
- Relevante Daten-, Auth-, Tenant-, RLS- und UI-Vertraege.
- Vollstaendige End-to-End-Nachweise.

Suche aktiv nach:

- Scope-Drift.
- Datenverlust.
- Zweiter Wahrheit.
- Auth-, Tenant- oder RLS-Fehlern.
- Mock-, Fallback- oder erfundenen Produktionspfaden.
- Fehlenden Loading-, Empty-, Error- oder Data-Zustaenden.
- Fehlendem End-to-End-Nachweis.

## Ergebnis

Repariere nicht selbst. Ergebnis ist ausschliesslich `PASS`, `REQUEST_CHANGES` oder `BLOCKED_EXTERNAL`.
