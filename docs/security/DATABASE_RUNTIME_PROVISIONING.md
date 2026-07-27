# Datenbank-Runtime: Provisionierung und Deployment-Gate

Status: Remote-Rollout freigegeben; Broker-/ACL-Cutover weiterhin vorbereitet und nicht angewendet<br>
Ziel-Tenant: `galvanik-kreile`<br>
Mindestversion: PostgreSQL 16

Dieses Dokument beschreibt die Infrastrukturvoraussetzungen fuer die
fail-closed Datenbank-Capability-Gates. Der Remote-Datenbank-Rollout wurde am
2026-07-26 freigegeben. Der Broker-/ACL-Cutover bleibt trotzdem gesperrt, bis
das unten beschriebene Plattforminventar, direkte Ersatzberechtigungen und der
zugehoerige App-Cutover gemeinsam nachgewiesen sind. Die Freigabe umfasst
weder einen Merge nach `main` noch eine Vercel-Production-Promotion.

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
- der Broker kann keine andere verbindbare Nicht-Template-Datenbank im Cluster
  betreten und in keiner anderen Datenbank temporaere oder dauerhafte Objekte
  erzeugen; ein reines `CONNECT` auf ein anbieterverwaltetes Template ohne
  `TEMPORARY` oder `CREATE` ist kein Pfad zu App-Daten oder Privilegien;
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

Die vollstaendige, reproduzierbare Receipt-Abfrage liegt in
`scripts/validation/database_runtime_platform_receipt.sql`. Sie gibt die
kanonischen Datenbank-ACL-, Providerrollen-, Membership-, Extension-View- und
anbieterinternen `SECURITY DEFINER`-Receipts aus. Ein geaenderter Digest ist
kein Anlass, den Sollwert blind zu aktualisieren; zuerst sind die zugrunde
liegenden kanonischen Zeilen zu pruefen.

Das read-only Inventar vom 2026-07-26 ergab:

| Receipt | Anzahl | MD5 |
| --- | ---: | --- |
| direkte ACLs der App-Datenbank | 10 | `60254db2d786eb5d9472962740435b2d` |
| Login-/privilegierte Providerrollen | 12 | `0afe2eb2b1848c0bf39eb53521c901b6` |
| Superuser-Namen | 1 | `a468f0e091a23006e68f2991c1e449e4` |
| `template1`-ACL | 4 | `71ec9b62961e2fc5d13e4d6ee008ad4f` |
| `extensions`-Schema-ACL | 7 | `e18f1837546257d1ab9732ac78ba82be` |
| `extensions`-Runtime-Views und ACLs | 2 | `037460eda240285faef9153187753c27` |
| verwaltete Default-ACL-Eintraege | 252 | `7a0154016b7e8dc996bbf197a013a8fc` |
| verwaltete non-public `SECURITY DEFINER`-Funktionen | 2 | `bbde5a9f320e09f68d30f1c7a3767b4f` |

Aktuell besitzen `PUBLIC` auf der App-Datenbank noch `CONNECT` und
`TEMPORARY`. Neun der zehn inventarisierten Plattform-Logins beziehen diese
Rechte nicht direkt. Ein vorgezogener Revoke wuerde daher legitime
Supabase-/Pooler-/Storage-Zugaenge veraendern. Das Runtime-Gate bleibt bis zum
Ersatz-Grant und erneuten Post-Provision-Receipt absichtlich rot. Simulierte
Post-Provision-Hashes gelten nicht als Abnahmebeleg.

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
`CONNECT`. Ob einzelne verwaltete Logins weiterhin `TEMPORARY` benoetigen,
muss vor dem Delta durch den Plattformvertrag bestaetigt werden. Erst danach
darf `PUBLIC` auf der App-Datenbank entzogen werden.

```sql
grant connect on database <app_database> to <required_platform_login>;
grant connect on database <app_database> to kreile_app_runtime;

revoke connect, temporary on database <app_database> from public;
revoke create, temporary on database <app_database> from kreile_app_runtime;
revoke create, temporary on database <app_database> from service_role;
```

Fuer jede andere Nicht-Template-Datenbank mit `datallowconn = true` darf der
Broker weder direkt noch ueber `PUBLIC` oder eine Membership `CONNECT`,
`TEMPORARY` oder `CREATE` besitzen. Auf Template-Datenbanken bleiben
`TEMPORARY` und `CREATE` ebenfalls verboten; das plattformseitige reine
`CONNECT` auf `template1` ist zulässig. Anbieterinterne Datenbanken koennen
Superuser-/Providerrechte erfordern. Wenn die Plattform das fachlich
notwendige Delta nicht zulaesst, bleibt das Runtime-Gate absichtlich rot; der
Vertrag wird nicht durch eine Code-Ausnahme aufgeweicht.

Der Datenbankowner darf als vertrauenswuerdiger Migrationsprincipal Mitglied
von `service_role` sein. Diese Kante erweitert den Broker nicht: Der Broker
besitzt weiterhin genau seine einzelne nicht-administrative `SET`-Kante und
kann den Owner weder direkt noch transitiv annehmen.

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
- Default-ACLs des App-Owners im Schema `public`, die spaetere Objekte fuer
  `PUBLIC`, Broker oder `service_role` automatisch freigeben; getrennt davon
  wird das verwaltete Supabase-Default-ACL-Inventar kataloggenau gepinnt;
- nicht inventarisierte `SECURITY DEFINER`-Funktionen oder falsche Owner,
  Sprachen, `search_path`-Werte und Grant Options.

Die Migrationen
`20260715001625_operational_core_boundary_prepared_unapplied.sql` und
`20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql`
sind weiterhin **prepared/unapplied**. Ihr Remote-Einsatz benoetigt eine
eigene Freigabe, einen Katalog-Snapshot und einen getesteten Rollbackpfad.

Die Freigabe ist inzwischen vorhanden; die Migration `20260715001650` bleibt
dennoch technisch vorbereitet/unapplied, weil `kreile_app_runtime`, die
Plattform-Ersatz-ACLs und die Production-Verbindung noch nicht gemeinsam
provisioniert wurden.

Die Inventur weist ausserdem einen verwalteten Residualpfad aus:
`service_role` kann ueber anbieterverwaltete `vault`-Funktionen weiterhin
Secrets anlegen oder aktualisieren. Das ist kein Beweis vollstaendiger
Least-Privilege-Isolation. Bis eine von Supabase unterstuetzte engere
Capability-Rolle existiert, wird dieser Providerpfad als vertrauenswuerdige
Betriebsgrenze dokumentiert und nicht als beseitigt behauptet.

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

Trotz erteilter Remote-Datenbankfreigabe werden nicht ausgefuehrt:

- Broker-/Plattform-ACL-Aenderungen ohne bestaetigte Ersatzrechte und
  App-Cutover;
- Production-Promotion oder Merge nach `main`;
- Loeschung oder irreversible Bereinigung von Datenbankobjekten.

Ist eine benoetigte Cluster-ACL in der verwalteten Umgebung nicht aenderbar,
lautet der Status `BLOCKED_EXTERNAL_PERMISSION` und nicht "implementiert".
