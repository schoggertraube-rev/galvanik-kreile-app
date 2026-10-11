<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Schnittstellen und Daten

## 1. Angebotene Ports

### Browser-sichere Fassade `src/modules/fundament/public.ts`

| Export | Zweck | Stand |
|---|---|---|
| `ProductStartProfile` | Sichtbares Rolf-/Phillip-Profil ohne Actor-ID | GEBAUT |
| `SystemAdminView` / `SystemAdminViewProps` | Gregors Systemansicht; Optik ist umzubauen | GEBAUT |
| `PermissionKey` | Zentraler Katalog der 13 fachlichen/systemischen Rechte; statische Rollenmatrix ist zu lösen | GEBAUT |
| `EffectivePermission` | Key, Standardwirkung, letzte explizite Entscheidung, effektive Wirkung, Version | SPEZ |
| `PersonAccessProfile` | Browser-minimaler Snapshot einer der drei Produktpersonen | SPEZ |
| `PersonRightsView` | Designsystem-UI für Personenrechte ohne Serverlogik; Gestaltung folgt in Designphase 1b | FEHLT |

### Server-Fassade `src/modules/fundament/server-public.ts` (Ziel)

| Port | Eingabe | Ausgabe/Fehler | Nutzer |
|---|---|---|---|
| `resolveAuthorization()` | Request-Sitzung | atomarer Actor-/Tenant-/Permission-Snapshot oder typisierter Fehler | alle Serverpfade |
| `requirePermission(key)` | `PermissionKey`, Request-Kontext | bestätigter Snapshot oder `FORBIDDEN` | Fach-Read-/Command-Ports |
| `requireAllPermissions(keys)` | mehrere PermissionKeys | bestätigter Snapshot nur bei vollständiger Menge | kombinierte Commands, z. B. Rechnung/Zahlung |
| `requireAdminAuthority()` | Request-Kontext | exakt Gregor + `admin\|developer` oder `FORBIDDEN` | Rechte-, Status-, PIN- und Aufbewahrungsfreigabe |
| `readPersonAccessProfiles()` | keine Client-Actor-ID | drei Profile mit Effective-Permissions-Version | Gregor-Admin-UI |
| `decidePersonPermission(command)` | Zielprofil, Key, `ALLOW\|DENY\|RESET`, Grund, Version, Event-/Korrelation-ID | Receipt + Effective-Permissions-Readback | Gregor-Admin-UI |
| `changePersonAccessStatus(command)` | Zielprofil, aktiv, Grund, Version, IDs | Receipt + Profil-Readback | Gregor-Admin-UI |
| `rotatePersonPin(command)` | Zielprofil, neue PIN, Version, IDs | Receipt ohne PIN + Profil-Readback | Gregor-Admin-UI |
| `approveRetentionAction(command)` | Proposal-Referenz, `DELETE\|ANONYMIZE`, Zielmodul/-objekt, Grund, Version, IDs | unveränderliches Approval-Receipt | Fachmodule vor Löschung/Anonymisierung |
| `readRetentionApproval(receiptId)` | Receipt-ID + Zielreferenz | gültiger, passender Approval-Readback oder `NOT_FOUND\|FORBIDDEN` | ausführender Fach-Command |

Direkte Importe aus `src/lib/auth` oder `src/lib/server/authorization.ts` durch Fachmodule werden beim Umbau durch die Server-Fassade ersetzt. UI-Fassaden exportieren keine DB-, Cookie-, Hash- oder Providerfunktion.

## 2. Benötigte Host-Ports

| Host-Port | Verantwortung | Kreile-HostAdapter | Fehlervertrag |
|---|---|---|---|
| `TenantContextPort` | Tenant serverseitig injizieren | `KREILE_TENANT_SLUG` ausschließlich aus `src/lib/tenant.ts` | fehlend/fremd → geschlossen |
| `AuthorizationStorePort` | Transaktionen auf App-User, Rechteereignissen und Readmodels | Drizzle/Postgres über serverseitige DB-Verbindung | DB-Fehler → keine Teilmutation |
| `SessionPort` | Cookie signieren, lesen, widerrufen, löschen | bestehender App-Session-Vertrag | ungültig/abgelaufen → `/start` |
| `CredentialPort` | PIN prüfen/hashen; Gregors Supabase-Login bestätigen | bcrypt + Supabase Auth | nie stiller lokaler Ersatz |
| `ProductActorConfigPort` | exakt Rolf/Phillip/Gregor an App-User binden | drei serverseitige Konfigurationsnamen | fehlend/doppelt/falsch → geschlossen |
| `ClockPort` | UTC-Zeitpunkte | Serveruhr/DB `now()` | kein Clientzeit-Vertrauen |
| `IdPort` | UUID für Event, ClientEvent und Korrelation validieren/erzeugen | Server/Command-Vertrag | formfalsch → Validation Error |
| `SecurityAuditPort` | append-only Ereignisse und Approval-Receipts | Fundament-Tabellen/Views | kein Erfolg ohne Auditbeleg |

## 3. Events

| Ereignis | Besitzer | Pflichtinhalt | Unveränderlichkeit | Readback |
|---|---|---|---|---|
| `USER_PERMISSION_DECIDED_V1` | Fundament | Tenant, Zielperson, Key, `ALLOW\|DENY\|RESET`, Vorher/Nachher, Grund, Actor, Version, ClientEvent, Korrelation, Zeit | UPDATE/DELETE/TRUNCATE verboten | `private.v_app_user_effective_permissions_v1` |
| `PERSON_ACCESS_STATUS_CHANGED_V1` | Fundament | Zielperson, alter/neuer Aktivstatus, Grund, Actor, Version, Korrelation | append-only | PersonAccessProfile |
| `PERSON_PIN_ROTATED_V1` | Fundament | Zielperson, Actor, Version, Korrelation, Zeit; niemals PIN/Hash | append-only | Profilversion + Sessionwiderruf |
| `RETENTION_ACTION_APPROVED_V1` | Fundament | Proposal, Zielmodul/-objekt, Aktion, Grund, Actor, Version, Korrelation, Zeit | append-only | `private.v_retention_action_approvals_v1` |
| `USER_LAST_SEEN_RECORDED_V1` | Fundament/Ist-Port | Tenant, Actor, Zeit, Version, Korrelation | vorhandener Eventvertrag | Login-Readback |

## 4. Datenmodell-Feldliste

### Bestehendes und Zielmodell

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `app_users` | `id` | uuid | ja | PK; entspricht Auth-User, soweit Providerlogin verwendet wird | Fundament | ja: `src/db/schema.ts` / Baseline |
| `app_users` | `tenant_id` | text | ja | jede Query/Mutation tenantgebunden; Ziel zusätzlich UNIQUE `(tenant_id,id)` | Fundament | ja |
| `app_users` | `email` | text | ja | im Tenant eindeutig zu härten; nicht als sichtbare Identität verwenden | Fundament | ja |
| `app_users` | `full_name` | text | ja | Audit-/Adminname; sichtbarer Produktname kommt aus HostAdapter | Fundament | ja |
| `app_users` | `role` | varchar(50) | ja | nur `developer\|admin\|meister\|buero\|werkstatt\|readonly`; keine Rechteableitung | Fundament | ja |
| `app_users` | `pin_hash` | text nullable | nein | nur bcrypt für Rolf/Phillip; niemals DTO/Audit | Fundament | ja |
| `app_users` | `active` | boolean | ja | `false` verweigert jeden App-Zugang | Fundament | ja |
| `app_users` | `created_at` | timestamp | ja | DB-Zeit | Fundament | ja |
| `app_users` | `updated_at` | timestamptz | ja | Änderung nach `session.issuedAt` widerruft Sitzung | Fundament | ja |
| `pin_rate_limits` | `operator_id` | uuid | ja | PK/FK `app_users`; eine Zählerzeile je Person | Fundament | ja: `src/db/schema.ts` / Migration |
| `pin_rate_limits` | `tenant_id` | text | ja | muss Zielperson-Tenant entsprechen | Fundament | ja |
| `pin_rate_limits` | `failed_attempts` | integer | ja | `>=0`; Schwellen 5/10/20 | Fundament | ja |
| `pin_rate_limits` | `last_failed_at` | timestamptz | ja | DB-Zeit | Fundament | ja |
| `app_user_permission_events` | `id` | uuid | ja | PK; Receipt-ID | Fundament | nein → neue Migration, nicht ausgeführt |
| `app_user_permission_events` | `tenant_id` | text | ja | Teil aller Unique/FK-/Filterbedingungen | Fundament | nein |
| `app_user_permission_events` | `subject_user_id` | uuid | ja | Ziel muss konfiguriertes aktives/inaktives Produktprofil im selben Tenant sein | Fundament | nein |
| `app_user_permission_events` | `permission_key` | text | ja | CHECK gegen versionierten 13er-Katalog | Fundament | nein |
| `app_user_permission_events` | `decision` | text | ja | CHECK `ALLOW\|DENY\|RESET` | Fundament | nein |
| `app_user_permission_events` | `reason` | text | ja | getrimmt, 5–500 Zeichen | Fundament | nein |
| `app_user_permission_events` | `before_effective` | boolean | ja | serverseitig aus gesperrtem Vorzustand | Fundament | nein |
| `app_user_permission_events` | `after_effective` | boolean | ja | muss Entscheidung/Standard entsprechen | Fundament | nein |
| `app_user_permission_events` | `actor_user_id` | uuid | ja | exakt bestätigte `AdminAuthority`, gleicher Tenant | Fundament | nein |
| `app_user_permission_events` | `aggregate_version` | integer | ja | `>0`, UNIQUE `(tenant_id,subject_user_id,aggregate_version)` | Fundament | nein |
| `app_user_permission_events` | `client_event_id` | uuid | ja | UNIQUE `(tenant_id,client_event_id)` für Idempotenz | Fundament | nein |
| `app_user_permission_events` | `correlation_id` | uuid | ja | UNIQUE `(tenant_id,correlation_id)` | Fundament | nein |
| `app_user_permission_events` | `created_at` | timestamptz | ja | DB `now()`, append-only | Fundament | nein |
| `private.v_app_user_effective_permissions_v1` | `tenant_id` | text | ja | security-invoker/private Read-Port | Fundament | nein → neue View |
| `private.v_app_user_effective_permissions_v1` | `subject_user_id` | uuid | ja | nur konfiguriertes Zielprofil | Fundament | nein |
| `private.v_app_user_effective_permissions_v1` | `permission_key` | text | ja | exakt jeder Katalogkey | Fundament | nein |
| `private.v_app_user_effective_permissions_v1` | `explicit_decision` | text nullable | nein | neuestes `ALLOW\|DENY`; `RESET` wird als Standard kenntlich | Fundament | nein |
| `private.v_app_user_effective_permissions_v1` | `effective_allowed` | boolean | ja | ohne explizite Entscheidung `true` | Fundament | nein |
| `private.v_app_user_effective_permissions_v1` | `aggregate_version` | integer | ja | aktueller Personen-Aggregatstand | Fundament | nein |
| `private.v_app_user_effective_permissions_v1` | `event_id` | uuid nullable | nein | letzter Rechtebeleg oder null bei Standard | Fundament | nein |
| `retention_action_approval_events` | `id` | uuid | ja | PK/Approval-Receipt | Fundament | nein → neue Migration, nicht ausgeführt |
| `retention_action_approval_events` | `tenant_id` | text | ja | tenantgebunden | Fundament | nein |
| `retention_action_approval_events` | `proposal_id` | uuid | ja | UNIQUE mit Ziel/Aktion/Version; Proposal bleibt im Fachmodul | Fundament | nein |
| `retention_action_approval_events` | `target_module` | text | ja | registrierte Modul-ID | Fundament | nein |
| `retention_action_approval_events` | `target_type` | text | ja | typisierte Fachobjektart, kein URL-/RPC-Tunnel | Fundament | nein |
| `retention_action_approval_events` | `target_id` | text | ja | opake Fach-ID; kein Inhalt/Snapshot | Fundament | nein |
| `retention_action_approval_events` | `action` | text | ja | CHECK `DELETE\|ANONYMIZE` | Fundament | nein |
| `retention_action_approval_events` | `reason` | text | ja | getrimmt, 5–500 Zeichen | Fundament | nein |
| `retention_action_approval_events` | `actor_user_id` | uuid | ja | bestätigte `AdminAuthority` | Fundament | nein |
| `retention_action_approval_events` | `aggregate_version` | integer | ja | `>0`; schützt Proposal-Konflikt | Fundament | nein |
| `retention_action_approval_events` | `client_event_id` | uuid | ja | tenantweit idempotent | Fundament | nein |
| `retention_action_approval_events` | `correlation_id` | uuid | ja | tenantweit eindeutig | Fundament | nein |
| `retention_action_approval_events` | `created_at` | timestamptz | ja | DB `now()`, append-only | Fundament | nein |
| `private.v_retention_action_approvals_v1` | `approval_id` + Ziel-/Aktionsfelder | typisierter View-Record | ja | private/security-invoker; keine personenbezogenen Nutzdaten | Fundament | nein → neue View |
| App-Sitzung | `userId, tenantId, role, displayName, issuedAt, expiresAt` | signiertes JSON im Cookie | ja | HMAC; keine Permissionliste im Cookie; 12 h TTL | Fundament | ja: `appSession.ts`, keine DB-Tabelle |
| Product-Actor-Konfiguration | drei App-User-IDs | serverseitige Konfiguration | ja | valide, eindeutig, vollständig; keine Secrets | Kreile-HostAdapter | ja: `productActorReadinessCore.ts` |
| `feature_flags.roles_allowed` | Rollenarray | text[] | nein | darf nach Umbau keine Autorisierung steuern | Altbestand, nicht Rechte-SSOT | ja: `src/db/schema.ts` |
| `audit_log` | generischer Alt-Audit | DB-Tabelle | nein für Rechte | nicht als zweite Rechteereigniswahrheit verwenden | Altbestand | ja: Baseline; Drizzle unvollständig |

### Migrations- und Bestandsdatenregel

- Neue Tabellen/Views werden nur in einer freigegebenen Vorwärtsmigration ergänzt; keine bestehende Migration wird umgeschrieben und keine Remote-Migration wird durch dieses Dossier ausgeführt.
- Der Startbestand enthält keine Personen-Rechteereignisse. Dadurch erhalten die drei konfigurierten Personen gemäß OE-2609-09 alle 13 Rechte; die statische Rollenmatrix wird nicht als Seed übernommen.
- `ROLE_PERMISSIONS` bleibt während einer eng begrenzten Codeumstellung höchstens Kompatibilitätskonstante, darf aber nach Gate-Abschluss keinen Runtime-Callsite besitzen.
- `feature_flags.roles_allowed` wird nicht migriert, weil es bislang weder tenantgebunden noch echte Autorisierungswahrheit ist.
- Rechte-/Approval-Events erhalten DB-Trigger gegen UPDATE, DELETE und TRUNCATE sowie GRANT-/RLS-/Privileged-DB-Negativtests.
- Nur klar synthetische Fixtures in lokalen/Fresh-Replay-Tests; keine Echtdatenmutation.

## 5. Manifest und Handshake

| Artefakt | Pfad | SHA-256 (12) | Befund/Ziel |
|---|---|---|---|
| Path-1-Modulmanifest | `src/modules/fundament/fundament.manifest.json` | `21F42C421462` | GEBAUT, aber `ownsTables`, `viewsFunctions`, `events` und Server-Fassade fehlen für den Zielvertrag; aktualisieren. |
| Browser-Fassade | `src/modules/fundament/public.ts` | `854779CA08AC` | GEBAUT, nur ProductStartProfile/SystemAdminView; zielgerichtet erweitern. |
| Server-Fassade | `src/modules/fundament/server-public.ts` | — | FEHLT; nach Modul-Gate-Schema ergänzen. |
| `capability.manifest.json` | nicht vorhanden | — | Nicht parallel erfinden; in-repo gilt das Path-1-Manifest als einzige Manifestwahrheit. |
| `INTEGRATION_HANDSHAKE.json` | nicht vorhanden | — | Für das bereits adoptierte Fundament nicht erforderlich; Host-Ports stehen in diesem Dossier und später im Path-1-Manifest/Serververtrag. |

## 6. APIs und Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase Postgres | serverseitige, tenantgefilterte DB-Verbindung; Browser ohne direkte Fachtabellenrechte | `DATABASE_URL` | GEBAUT | Remote-Wahrheit nicht in dieser Mission geprüft; keine Remote-Migration/RLS-/Datenmutation ohne Freigabe |
| Supabase Auth | E-Mail/Passwort ausschließlich für Gregor; normale Auth-Session des Providers | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | GEBAUT | App bindet Ergebnis zusätzlich an exakten Gregor-Actor; keine Credential-/Provideränderung |
| App-Session | HMAC-Signatur, serverseitiger Cookie | `APP_SESSION_SECRET` | GEBAUT | Secret niemals dokumentieren; Rotation/Production nur eigenes Gate |
| Product-Actor-Bindung | keine Provider-Scopes; serverseitige nicht geheime IDs | `KREILE_ROLF_APP_USER_ID`, `KREILE_PHILLIP_APP_USER_ID`, `KREILE_GREGOR_APP_USER_ID` | GEBAUT | Änderungen nur kontrolliert; keine IDs im Client |
| Keine weiteren Dienste | keine | — | SPEZ | M365/Azure/OCR/KI/Payment gehören nicht in G01 |

## 7. Übertragbarkeit

- Kern frei von Kreile-Fachbegriffen: `PermissionKey`, Effektiventscheidung, Session-/Actor-Kontext, Idempotenz, Audit und Admin-Approval sind app-neutral.
- Kreile-spezifisch im HostAdapter: Tenant-Slug, Rolf/Phillip/Gregor, Produktprofilregeln, sichtbare Texte und Zuordnung PermissionKey → Kreile-Aktion.
- Andere Zielapps definieren ihre eigenen Profile, Permission-Kataloge und HostAdapter; keine gemeinsamen Daten, Secrets, Konten, Sessions oder Ressourcen.
- Kein Modul darf den Tenant oder sichtbare Namen als Literal im wiederverwendbaren Kern einbetten.
