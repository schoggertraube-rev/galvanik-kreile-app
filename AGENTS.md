# Galvanik-Kreile WerkstattCockpit

## Projekt

- Arbeite ausschliesslich fuer das Galvanik-Kreile WerkstattCockpit.
- Der feste Tenant ist `galvanik-kreile`.
- Stack: Next.js App Router, TypeScript, Supabase, Drizzle, Recharts, Framer Motion und PWA.
- `main` ist die einzige Lieferwahrheit.
- Vor Next.js-Codeaenderungen die relevante Dokumentation unter `node_modules/next/dist/docs/` lesen.

## Arbeitsmodell

- Jede Mission nutzt immer einen isolierten Worktree.
- Pro Mission gibt es genau einen Writer und genau einen unabhaengigen Reviewer.
- Der Writer trifft gewoehnliche technische Entscheidungen selbststaendig im freigegebenen Scope.
- Es gibt hoechstens zwei automatische Reparaturschleifen.
- Rueckfragen sind nur bei echtem externem Blocker oder Produktentscheidung erlaubt.

## Ohne Freigabe verboten

- Merge nach `main`.
- Production-Promotion oder Production-Deploy.
- Remote-Supabase-Migration.
- RLS- oder Policy-Aenderung.
- Daten- oder Dateiloeschung.
- Aktivierung kostenpflichtiger Dienste.

## Architekturregeln

- Stabile Vertraege laufen ueber SQL-Views, TypeScript-Typen und Komponenten-Props.
- Jede fachliche Wahrheit hat genau eine Single Source of Truth.
- KPI-Berechnungen gehoeren in SQL-Views.
- Keine Mockdaten, erfundenen Zahlen oder `Math.random` im Produktionspfad.
- Keine Client-`tenantId`-Autorisierung.
- Keine pauschale Public-RLS-Policy mit `FOR ALL` und `USING true`.
- Keine Secrets oder PIN-Felder im Client-Payload.
- Keine Navigation ohne ausdruecklichen Auftrag aendern.
- Datenkette immer: Datenquelle -> View/Vertrag -> Query/Action -> Komponente -> Loading/Empty/Error/Data.
- Supabase-Fehler immer mit `message`, `details` und `hint` loggen, wenn diese Felder verfuegbar sind.

## Abschluss

- Erlaubte Abschlussstatus: `PASS`, `FAIL_INTERNAL`, `BLOCKED_EXTERNAL_PERMISSION`, `BLOCKED_PRODUCT_DECISION`.
- Kein Abschluss ohne Draft-PR, Checks, Vercel Preview und nummerierte Nachweise.
