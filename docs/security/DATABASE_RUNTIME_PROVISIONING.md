# Datenbank-Runtime: Provisionierung und Deployment-Gate

Status: vorbereitet, nicht remote angewendet  
Ziel-Tenant: `galvanik-kreile`  
Mindestversion: PostgreSQL 16

Dieses Dokument beschreibt die Infrastrukturvoraussetzungen fuer die
fail-closed Datenbank-Capability-Gates. Es ist kein Freibrief fuer Aenderungen
an einer gehosteten Supabase-Instanz. Rollen-, Datenbank-ACL-, RLS- oder
Migrationsaenderungen duerfen remote erst nach separater Freigabe und nach dem
unten beschriebenen Plattforminventar erfolgen.

## Verbindlicher Runtime-Vertrag

Die Anwendung meldet sich als unprivilegierter Broker
`kreile_app_runtime` an und wechselt beim Verbindungsaufbau mit `SET ROLE` auf
`service_role`. Ein gruenes Gate beweist gleichzeitig:

- `session_user = kreile_app_runtime` und `current_user = service_role`;
- exakter `search_path = pg_catalog,public,pg_temp`;
- `session_replication_role = origin` und `lo_compat_privileges = off`;
- `service_role` ist `BYPASSRLS`, aber weder Login noch Superuser oder Owner;
- der Broker ist `LOGIN NOINHERIT`, besitzt genau eine sichere, nicht
  administrative `SET`-Membership zu `service_role` und sonst keine
  Rollenpfade;
- der Broker besitzt direkt ausschliesslich ein nicht weitergebbares
  `CONNECT` auf die App-Datenbank, keine Objekt-, Schema-, Tablespace-,
  Parameter-, Default- oder Owner-Rechte;
- der Broker kann keine andere verbindbare Datenbank im Cluster betreten und
  weder dort noch in der App-Datenbank temporaere Objekte erzeugen;
- `PUBLIC` besitzt auf der App-Datenbank weder `CONNECT` noch `TEMPORARY` und
  auf normalen Anwendungsobjekten keine ACL-Eintraege;
- alle normalen `SECURITY DEFINER`-Funktionen entsprechen dem kataloggenauen
  Owner-, Sprache-, `search_path`- und ACL-Inventar.

Der gemeinsame Beweis steht in
`src/lib/server/databaseRuntimeIdentity.ts`. Capture, Inventar und operativer
Kern verwenden denselben Beweis; ein partiell migriertes oder falsch
provisioniertes System bleibt deshalb schreibgesperrt.

## 1. Read-only Plattforminventar

Vor jedem Revoke muessen die tatsaechlichen Supabase-/Pooler-/Dashboard-Rollen
und ihre benoetigten Verbindungen erfasst werden. Insbesondere darf ein
pauschales `REVOKE CONNECT FROM PUBLIC` nicht ausgefuehrt werden, solange nicht
alle legitimen Plattform-Logins explizit bekannt und ersatzweise berechtigt
sind.

Die folgenden Abfragen sind read-only:

```sql
select version(), current_database(), current_user, session_user;

select oid, rolname, rolcanlogin, rolinherit, rolbypassrls, rolsuper,
       rolcreaterole, rolcreatedb, rolreplication, rolconfig
from pg_catalog.pg_roles
order by rolname;

select granted.rolname as granted_role,
       member_role.rolname as member_role,
       grantor_role.rolname as grantor_role,
       membership.admin_option,
       membership.inherit_option,
       membership.set_option
from pg_catalog.pg_auth_members membership
join pg_catalog.pg_roles granted on granted.oid = membership.roleid
join pg_catalog.pg_roles member_role on member_role.oid = membership.member
join pg_catalog.pg_roles grantor_role on grantor_role.oid = membership.grantor
order by granted_role, member_role;

select datname, datallowconn, pg_catalog.pg_get_userbyid(datdba) as owner,
       datacl
from pg_catalog.pg_database
order by datname;

select role_record.rolname, database_record.datname,
       pg_catalog.has_database_privilege(role_record.oid, database_record.oid, 'CONNECT') as can_connect,
       pg_catalog.has_database_privilege(role_record.oid, database_record.oid, 'TEMP') as can_temp,
       pg_catalog.has_database_privilege(role_record.oid, database_record.oid, 'CREATE') as can_create
from pg_catalog.pg_roles role_record
cross join pg_catalog.pg_database database_record
where role_record.rolname in ('kreile_app_runtime', 'service_role', 'authenticator')
  and database_record.datallowconn
order by role_record.rolname, database_record.datname;

select * from pg_catalog.pg_parameter_acl;
select * from pg_catalog.pg_default_acl;

select namespace_record.nspname,
       pg_catalog.pg_get_userbyid(namespace_record.nspowner) as owner,
       namespace_record.nspacl
from pg_catalog.pg_namespace namespace_record
order by namespace_record.nspname;
```

Das Inventar wird zusammen mit einem Backup-/Rollback-Nachweis abgelegt. Jede
unbekannte Plattformrolle, die von `PUBLIC CONNECT` oder `PUBLIC TEMPORARY`
abhaengt, ist ein externer Deployment-Blocker, bis ihr Zweck geklaert ist.

## 2. Zu bestaetigendes Rollenmodell

Die folgenden Befehle zeigen die beabsichtigte Form, sind aber nicht zur
ungeprueften Ausfuehrung bestimmt. `<owner-or-superuser>` und `<app_database>`
muessen aus dem Inventar stammen; Geheimnisse gehoeren in den Secret Store und
nicht in SQL-Dateien oder Logs.

```sql
-- Nur falls die Rolle noch nicht existiert und die Plattform das erlaubt:
create role kreile_app_runtime
  login noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;

-- service_role ist eine vorhandene Plattformrolle. Flags nur verifizieren;
-- eine verwaltete Supabase-Rolle nicht ohne Plattformfreigabe veraendern.

grant service_role to kreile_app_runtime
  with admin false, inherit false, set true;
```

Vor diesem Grant sind alle anderen Memberships des Brokers zu entfernen oder
als Blocker zu behandeln. `authenticator -> service_role` darf nur bestehen,
wenn die Plattform es benoetigt und auch diese Kante `ADMIN FALSE`,
`INHERIT FALSE`, `SET TRUE` sowie einen vertrauenswuerdigen Grantor besitzt.

## 3. Datenbank-ACL-Delta planen

Zuerst erhalten alle bestaetigten Plattform-Logins ihr minimales explizites
`CONNECT`. Erst danach darf `PUBLIC` auf der App-Datenbank entzogen werden.

```sql
grant connect on database <app_database> to <required_platform_login>;
grant connect on database <app_database> to kreile_app_runtime;

revoke connect, temporary on database <app_database> from public;
revoke create, temporary on database <app_database> from kreile_app_runtime;
revoke create, temporary on database <app_database> from service_role;
```

Fuer jede andere Datenbank mit `datallowconn = true` muss der Broker weder
direkt noch ueber `PUBLIC` oder eine Membership `CONNECT` beziehungsweise
`TEMPORARY` besitzen. Das kann Rechte auf `postgres`, `template1` oder
anbieterinterne Datenbanken betreffen und daher Superuser-/Providerrechte
erfordern. Wenn die Plattform dieses Delta nicht zulaesst, bleibt das Runtime-
Gate absichtlich rot; der Vertrag wird nicht durch eine Code-Ausnahme
aufgeweicht.

Auch die App-Datenbank darf keinen durch `kreile_app_runtime` selbst erteilten
ACL-Eintrag enthalten. Der einzelne Broker-`CONNECT` muss durch den
Datenbankowner oder einen Superuser erteilt und nicht weitergebbar sein.

## 4. Schema-, Objekt- und Funktionsinventar

Vor Anwendung der vorbereiteten Boundary-Migrationen sind mindestens folgende
Driftklassen zu bereinigen:

- `PUBLIC`-ACLs auf normalen Tabellen, partitionierten Tabellen, Views,
  Materialized Views, Foreign Tables, Sequenzen, Spalten und Large Objects;
- direkte Objekt- oder Schema-ACLs fuer `kreile_app_runtime`;
- `CREATE` auf `public`, `extensions` oder anderen Schemas fuer untrusted
  Rollen;
- Parameterrechte fuer `PUBLIC`, Broker oder `service_role`;
- Default-ACLs, die spaetere Objekte fuer `PUBLIC`, Broker oder
  `service_role` automatisch freigeben;
- nicht inventarisierte `SECURITY DEFINER`-Funktionen oder falsche Owner,
  Sprachen, `search_path`-Werte und Grant Options.

Die Migrationen
`20260715001625_operational_core_boundary_prepared_unapplied.sql` und
`20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql`
sind weiterhin **prepared/unapplied**. Ihr Remote-Einsatz benoetigt eine
eigene Freigabe, einen Katalog-Snapshot und einen getesteten Rollbackpfad.

## 5. Verbindungs- und Capability-Abnahme

Der Serverprozess verwendet ausschliesslich die Broker-URL und setzt beim
Start jeder PostgreSQL-Verbindung:

```text
-c role=service_role -c search_path=pg_catalog,public,pg_temp
```

Danach werden Capture-, Inventar- und Operational-Gate getrennt ausgefuehrt.
Alle drei muessen `true` liefern. Zusaetzlich wird katalogseitig bestaetigt:

```sql
select current_user,
       session_user,
       pg_catalog.current_setting('search_path') as search_path,
       pg_catalog.current_setting('session_replication_role') as replication_role,
       pg_catalog.current_setting('lo_compat_privileges') as lo_compat;
```

Erwartung:

```text
current_user             service_role
session_user             kreile_app_runtime
search_path              pg_catalog,public,pg_temp
replication_role         origin
lo_compat                off
```

Ein fehlgeschlagenes Gate wird nicht als leere Datenmenge oder
"voruebergehend nicht verfuegbar" maskiert. Die betroffene Schreibfunktion
bleibt geschlossen und der konkrete Katalog-/Provisionierungsblocker wird
gemeldet.

## 6. Rollback und Betriebsgrenze

Vor dem ACL-Delta werden die bisherigen Rollen-, Membership-, Datenbank-,
Schema-, Objekt-, Parameter- und Default-ACLs kataloggenau gesichert. Ein
Rollback stellt ausschliesslich bestaetigte Plattformverbindungen wieder her;
es vergibt keine pauschalen App-Objektrechte und aktiviert keine alte offene
RLS-Policy.

Ohne ausdrueckliche Freigabe werden nicht ausgefuehrt:

- Remote-Rollen- oder Datenbank-ACL-Aenderungen;
- Supabase-Migrationen oder RLS-Aenderungen;
- Production-Promotion;
- Loeschung oder irreversible Bereinigung von Datenbankobjekten.

Ist eine benoetigte Cluster-ACL in der verwalteten Umgebung nicht aenderbar,
lautet der Status `BLOCKED_EXTERNAL_PERMISSION` und nicht "implementiert".
