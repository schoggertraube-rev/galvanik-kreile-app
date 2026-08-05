# Produktentscheidung: Datenzugriffs- und Tenant-Grenze

Stand: 2026-08-05 — Korrektur des unvollstaendigen Architekturentscheids

## Korrigierter Befund

Die fruehere Aussage „kein clientseitiger Supabase-Zugriff“ war falsch. Der reale
Code besitzt drei Datenpfade:

| Pfad | Rolle / Schutzwirkung | Konsequenz |
|---|---|---|
| Drizzle ueber `DATABASE_URL` | privilegierter serverseitiger PostgreSQL-Zugriff; RLS kann umgangen werden | Jede Query braucht Autorisierung und Tenant-Filter. |
| Supabase Data API im Server | fuer grantlose Tabellen im Recovery-Kandidaten erst nach App-Autorisierung mit serverseitigem Schluessel; andere RLS-Pfade bleiben sitzungsgebunden | Server-Action ist die Trust-Boundary; privilegierte Zugriffe muessen eng und tenantgebunden bleiben. |
| Supabase Data API im Browser | oeffentlicher Anon-Key; kein Kreile-App-Cookie wird von PostgREST ausgewertet | Kein direkter Zugriff auf fachliche Tabellen zulaessig. |

Production hat 26 Tabellen ohne RLS, auf denen `anon` und `authenticated` jeweils
SELECT, INSERT, UPDATE und DELETE besitzen. Application-Layer-Filter allein koennen
diesen Browser-/Data-API-Pfad nicht schuetzen.

## Entscheidung fuer die Recovery-Phase

1. Direkte Browserzugriffe auf die 26 offenen fachlichen Tabellen werden entfernt.
2. `anon` und `authenticated` verlieren auf diesen Tabellen alle Tabellenrechte.
3. Legitime Serverpfade zu den grantlosen Tabellen werden vor Erstellung eines
   privilegierten Clients ueber die kanonische App-Autorisierung geprueft; es
   erfolgt keine pauschale Umstellung aller Server-Actions auf Service Role.
4. Drizzle- und Service-Role-Zugriffe bleiben fuer jeden fachlichen Pfad zu
   Tenant-Filtern verpflichtet; Service Role ist kein Autorisierungsersatz.
5. Es wird in dieser Mission keine pauschale RLS-Policy erfunden. Tabellen ohne
   bewiesenes Tenant-/Ownership-Modell bleiben fuer Data-API-Rollen grantlos.

## RLS-Status

`RLS-CONTRACT-001` ist **nicht entfallen**. Es folgt relationenweise nach Schliessung
der akuten Grants:

- existierende schwache Policies und Grants inventarisieren,
- pro Relation Eigentuemer, Tenant-Spalte und erlaubte Operationen bestimmen,
- negative Tests fuer anonymen und falschen Tenant-Zugriff,
- erst dann kleine RLS-/Policy-Aenderungen mit separater Freigabe.

Eine spaetere nichtprivilegierte PostgreSQL-App-Rolle bleibt der bevorzugte
Defense-in-Depth-Pfad. Sie ersetzt jedoch weder Server-Autorisierung noch
Tenant-Filter.

## Aktueller Lieferstatus

- Production: akute Grants weiterhin offen; keine Remote-Aenderung erfolgt.
- Recovery-Kandidat: zentral autorisierte Server-Data-API und ausstehende
  Grant-Revoke-Migration.
- RLS-/Policy-Aenderungen: nicht Teil dieses Kandidaten.
