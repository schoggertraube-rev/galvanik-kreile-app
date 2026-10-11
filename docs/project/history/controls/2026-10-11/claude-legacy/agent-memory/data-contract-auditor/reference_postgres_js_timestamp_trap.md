---
name: reference-postgres-js-timestamp-trap
description: Why timezone bugs in this repo live in the SQL parameter, not the read - postgres-js re-serializes string params as Date when Postgres infers a timestamp OID
metadata:
  type: reference
---

Der `postgres`-Treiber (porsager, 3.4.9) verwandelt **String-Parameter** in `new Date(x).toISOString()`,
sobald Postgres den Parametertyp als `date`/`timestamp`/`timestamptz` ableitet. Kette im Paket:

- `node_modules/postgres/src/types.js`: `types.date` hat `to: 1184`, `from: [1082, 1114, 1184]`,
  `serialize: x => (x instanceof Date ? x : new Date(x)).toISOString()`. `typeHandlers()` registriert
  den Serializer fuer **jede** OID aus `from`, nicht nur fuer `to`.
- `connection.js:238` `q.describeFirst = parameters.length && !q.prepared` — mit `prepare: false`
  (Projektstandard in `src/db/index.ts` und in jedem Integrationstest) IMMER wahr.
- `connection.js:630` `ParameterDescription` schreibt die vom Server abgeleiteten OIDs zurueck in
  `query.statement.types`.
- `connection.js:958-960` `Bind` wendet danach `options.serializers[type]` an.

Folge: `sql\`... ${"2026-07-10T00:00:00"}::timestamp\`` wird unter `TZ=Europe/Berlin` als
`2026-07-09 22:00:00` **gespeichert**. Ein String OHNE Zonensuffix parst JS in der lokalen
Prozesszone. Der Kalendertag verschiebt sich um einen Tag.

Wichtige Abgrenzungen (alle lokal verifiziert):
- Der `debug`-Callback (`connection.js:243`) feuert VOR der Serialisierung und zeigt deshalb
  harmlose Parameter. Er ist als Beweis untauglich.
- Der Treiber sendet **keinen** `timezone`-Startupparameter. Die PG-Session bleibt UTC; `TZ` wirkt
  ausschliesslich auf JS-`Date`.
- Sicher sind: Strings MIT `Z`-Suffix, reine `YYYY-MM-DD`-Strings (ES-Spec: date-only = UTC), und
  ein erzwungener Textparameter (`${v}::text::timestamp` → OID 25 → `'' + x`).
- Auf der Leseseite ist `to_char(...)` stabil (Text, kein Parser). Roh gelesene
  `timestamp without time zone`-Spalten kommen dagegen als lokal geparstes `Date` zurueck.

**How to apply:** Bei jedem Befund "Kalendertag verschiebt sich" zuerst den **Schreibparameter**
pruefen, nicht die Projektion. Beweis fuehren, indem dieselbe Query einmal mit Parameter und einmal
mit SQL-Literal verglichen wird — weicht nur der Parameter ab, ist es diese Falle. Gegenprobe mit
`TZ=UTC` und `TZ=Europe/Berlin` im selben Lauf. Siehe [[reference-g04-dossier]].
