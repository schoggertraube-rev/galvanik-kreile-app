<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M07 KI-Suche — Schnittstellen und Daten

## 1. Angebotene Ports

Geplanter off-repo-Kern: `src/modules/ki-suche`. Namen sind der vollständige Zielvertrag für den Builder; die Dateien entstehen erst im Bauauftrag.

### `public.ts`

| Export | Art | Vertrag |
|---|---|---|
| `answerSearchQuestion(request)` | Funktion | Führt F-M07-001/002 aus und liefert ausschließlich `KiSearchOutcome`. |
| `openKiSearchCitation(request)` | Funktion | Prüft Citation und aktuelle Berechtigung erneut und liefert ein bekanntes Host-Navigationsziel. |
| `prepareKiSearchAction(request)` | Funktion | Liefert nur eine aktuelle, servergeprüfte Aktionsvorschau. |
| `confirmKiSearchAction(request)` | Funktion | Führt nach expliziter Bestätigung den sicheren Command des Besitzer-Moduls aus. |
| `KiSearchRequest` | Typ | Frage und optionaler, nicht autoritativer UI-Kontext; kein Client-Tenant und keine Client-Rolle. |
| `KiSearchOutcome` | Typ | Diskriminierte Union aller Erfolgs-, Klärungs-, Sperr-, Konflikt- und Fehlercodes. |
| `KiSearchResponse` | Typ | Antwort mit Claims, Citations, Unsicherheiten, Coverage, Datenstand und Korrelations-ID. |
| `KiSearchCitation` | Typ | Autorisierte, servergebundene Quelle mit Besitzer, Objektbezug, Link und Datenstand. |
| `KiSearchActionSuggestion` | Typ | Erlaubte `actionKey` samt Quellen, Wirkung und Vorbedingungen; keine frei formulierte Mutation. |

### `server-public.ts`

| Export | Art | Vertrag |
|---|---|---|
| `createKiSearchService(ports, config)` | Factory | Verdrahtet den hostneutralen Kern ausschließlich mit expliziten Ports und validierter Konfiguration. |
| `KiSearchHostPorts` | Typ | Gesamtheit der unten beschriebenen, server-only Host-Ports. |
| `KiSearchProviderPortV1` | Typ | Versionierter Providervertrag; kennt kein UI und keine Fachdatenbank. |
| `KiSearchConfigV1` | Typ | Limits, Timeouts, Capability- und Schema-Version; enthält keine Secretwerte. |

**Importregel:** Andere Module importieren nur diese Fassaden. M07 importiert G08 nur über `@/modules/suche/public`; interne Provideradapter, Prompts und Hostadapter sind nicht öffentlich.

## 2. Benötigte Host-Ports

| Host-Port | Besitzer | Eingabe | Ausgabe / Pflichtverhalten |
|---|---|---|---|
| `authorization.resolve` | G01 | aktuelle Server-Session | Tenant, Person, Capabilities; fail-closed; ignoriert Client-Tenant/Rolle. |
| `modules.readSwitch` | G10/G01 | Tenant, `m07-ki-suche` | serverseitiger Organisationsschalter; AUS beendet vor Datenzugriff. |
| `search.searchTenant` | G08 | normalisierte Frage | unveränderter `SearchTenantResult`; erste und einzige Basissuche. |
| `evidence.resolveMany` | Host/Fachmodule | autorisierte `SearchHit`-Referenzen, erlaubte Feldliste | minimale, aktuelle Faktenumschläge oder feldweiser Denial; nur öffentliche Fachports. |
| `navigation.resolveCitation` | G02/Fachmodule | validierte Citation | bekanntes internes Ziel oder Denial; keine freie URL. |
| `commands.describeAllowed` | G01/Fachmodule | Person, Quellen, Kontext | servergeprüfte `actionKey`-Vorschauen mit Vorbedingungen. |
| `commands.executeConfirmed` | Besitzer-Modul | `actionKey`, Idempotenzschlüssel, explizite Bestätigung | fachlicher Receipt und Readback; M07 schreibt nicht selbst. |
| `usage.reserveClaimSettle` | bestehende Plattform-RPC, Ownership Q-M07-006 | Tenant, Person, Feature, Request-Hash, Limits, Units, Ergebnis | atomare Budget-/Rate-/Replay-Entscheidung über bestehende RPCs, kein direktes Tabellen-DML. |
| `audit.record` | G01/Plattform | technische Metadaten und Korrelations-ID | nachvollziehbarer Lauf ohne Secrets und ohne unnötigen Frage-/Antwortinhalt. |
| `provider.generateStructured` | M07-Adapter | minimierter Faktenumschlag, Schema-Version, Timeout | streng validierbare Providerantwort oder eindeutiger Fehler; kein Fallback. |
| `clock.now` / `ids.newCorrelationId` | Host | — | testbare Zeit und eindeutige Korrelations-ID. |

**Offene Portreichweite:** G08 liefert derzeit Kunden und Aufträge. Weitere Domänen sind erst nach freigegebenen öffentlichen Read-Ports zulässig; siehe Q-M07-006. Ein generischer SQL-, URL- oder Payload-Tunnel ist verboten.

## 3. Events

M07 besitzt im MVP keine fachlichen Domain-Events. Query-, Provider- und Usage-Läufe gehen über den Audit-Port, nicht über einen zweiten Eventstrom. Wird eine bestätigte Aktion ausgeführt, emittiert ausschließlich das fachlich besitzende Modul sein vorhandenes Ereignis und liefert seinen Receipt/Readback. Das geplante Manifest deklariert daher `emits: []`, `consumes: []`.

## 4. Datenmodell-Feldliste und Soll-Ist-Abgleich

### Vorhandener G08-Vertrag

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `SearchTenantResult.OK` | `code` | Literal `OK` | ja | diskriminiert Erfolg | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchTenantResult.OK` | `query` | string | ja | normalisiert, 2–80 Zeichen | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchTenantResult.OK` | `hits` | `SearchHit[]` | ja | max. 20 gesamt, max. 10 je Typ | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchTenantResult.OK` | `checkedSources` | `SearchSource[]` | ja | derzeit Auftragsbestand/Kundenstamm | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchTenantResult.OK` | `checkedAt` | ISO string/null | ja | Host-Zeitstempel | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchTenantResult.OK` | `coverage` | `SearchCoverage` | ja | Trefferzahl, Untergrenze, truncation | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchHit` | `type`, `id` | `ORDER` oder `CUSTOMER`, string | ja | bekannte Entität; Tenantzugriff servergeprüft | G08/Fachmodul | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchHit` | `title`, `subtitle`, `status` | string | ja | Anzeigefelder aus autorisiertem Read-Port | G08/Fachmodul | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchHit` | `matchField`, `matchLabel`, `matchValue`, `context` | typisierte Union/string | ja | erklärt den Treffer | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchHit` | `source` | `Auftragsbestand` oder `Kundenstamm` | ja | bekannte Quelle | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |
| `SearchHit` | `href`, `actionLabel` | typisierte interne Route/Literal | ja | nur Order-/Customer-Ziel | G08 Suche | ja, TypeScript: `src/modules/suche/server/types.ts` |

### Geplanter M07-Laufzeitvertrag, nicht persistent

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `KiSearchRequest` | `question` | string | ja | normalisiert; Limit aus validierter Konfiguration, nie leer | M07 | nein; geplanter Typ `src/modules/ki-suche/public.ts` |
| `KiSearchRequest` | `uiContext` | typisierte Referenzen | nein | Hinweis, niemals Auth-/Tenantquelle | M07 | nein; geplant |
| `KiSearchOutcome` | `code` | Enum | ja | `OK_DETERMINISTIC`, `OK_AI`, `NEEDS_CLARIFICATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `DISABLED`, `BUDGET_BLOCKED`, `CONFLICT`, `UNAVAILABLE`, `VALIDATION_ERROR` | M07 | nein; geplant |
| `KiSearchOutcome` | `correlationId` | string | ja außer Eingabe vor ID-Erzeugung | nicht erratbar; über Audit/Usage/Response identisch | Host/M07 | nein; geplant |
| `KiSearchResponse` | `answer` | string | ja bei `OK_AI` | keine alleinige Faktquelle; aus validierten Claims gerendert | M07 | nein; geplant |
| `KiSearchResponse` | `claims` | `KiSearchClaim[]` | ja | jeder Claim hat kind und gültige Citation-Bindung | M07 | nein; geplant |
| `KiSearchClaim` | `kind` | `FACT`, `INFERENCE` oder `UNCERTAINTY` | ja | sichtbare Trennung | M07 | nein; geplant |
| `KiSearchClaim` | `text` | string | ja | Ausgabeschema validiert | M07 | nein; geplant |
| `KiSearchClaim` | `citationIds` | string[] | bei FACT ja | mindestens eine autorisierte Citation je FACT | M07 | nein; geplant |
| `KiSearchClaim` | `confidence` | Zahl/null | ja | 0..1 oder null, nie als Wahrheitsschwelle allein | M07 | nein; geplant |
| `KiSearchCitation` | `id`, `sourceType`, `sourceId` | string, Enum, string | ja | serverseitig gebunden, nicht vom Modell erfunden | Fachmodul/M07-Projektion | nein; geplant |
| `KiSearchCitation` | `ownerModule`, `title`, `href` | string, string, typisierte Route | ja | bekannte Besitzer-/Navigationsauflösung | Fachmodul/G02 | nein; geplant |
| `KiSearchCitation` | `observedAt`, `dataState` | ISO string/null, Enum | ja | Datenstand und frisch/veraltet/unvollständig | Fachmodul/M07 | nein; geplant |
| `KiSearchResponse` | `coverage` | strukturierter Status | ja | enthält G08-Coverage und Host-Port-Lücken | M07 | nein; geplant |
| `KiSearchResponse` | `uncertainties`, `missingData` | string[] | ja | leer erlaubt, nicht verschweigen | M07 | nein; geplant |
| `KiSearchResponse` | `suggestedActions` | `KiSearchActionSuggestion[]` | ja | leer erlaubt; nur Katalog-`actionKey` | M07/Fachmodul | nein; geplant |
| `KiSearchActionSuggestion` | `actionKey`, `label`, `citationIds`, `preconditionToken` | string, string, string[], opaque string | ja | kein frei ausführbarer Befehl; Token kurzlebig | Fachmodul/M07 | nein; geplant |
| `KiSearchResponse` | `providerRun` | Provider-/Modell-/Schema-Version, Latenz | bei `OK_AI` ja | keine Secrets; expliziter Provider | M07 | nein; geplant |
| `KiSearchResponse` | `costUsage` | geschätzt/tatsächlich/Einheit/Status | bei Modelllauf ja | aus Usage-Port, nicht Modellbehauptung | Usage-Besitzer | teilweise DB, siehe unten |

### Vorhandener Usage-Bestand

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `ai_usage_reservations` | `id` | uuid | ja | PK, default UUID | FEHLT → Q-M07-006 | ja: `supabase/migrations/20260805180624_production_schema_baseline.sql` |
| `ai_usage_reservations` | `tenant_id`, `user_id`, `feature` | text | ja | `feature` Regex; tenant/person aus Serverauth | FEHLT → Q-M07-006 | ja: Baseline |
| `ai_usage_reservations` | `request_key_hash` | text | ja | 64 Hexzeichen; Unique über Tenant/User/Feature/Hash | FEHLT → Q-M07-006 | ja: Baseline |
| `ai_usage_reservations` | `estimated_units`, `actual_units` | integer, integer/null | ja/nein | geschätzt >0; tatsächlich ≥0 | FEHLT → Q-M07-006 | ja: Baseline |
| `ai_usage_reservations` | `status` | text | ja | reserved/in_flight/succeeded/failed/uncertain | FEHLT → Q-M07-006 | ja: Baseline |
| `ai_usage_reservations` | `reason`, `provider_status` | text/null | nein | technische Statuswerte, keine Secrets | FEHLT → Q-M07-006 | ja: Baseline |
| `ai_usage_reservations` | `result_json`, `result_expires_at` | jsonb/null, timestamptz/null | nein | Inhalt/Retention für M07 vor Nutzung freizugeben | FEHLT → Q-M07-006/010 | ja: Baseline |
| `ai_usage_reservations` | `created_at`, `started_at`, `completed_at`, `updated_at` | timestamptz | teilweise | Laufzeit-/Auditzeiten | FEHLT → Q-M07-006 | ja: Baseline |
| Usage-RPC | `reserve_ai_usage`, `claim_ai_usage_reservation`, `settle_ai_usage_reservation` | SECURITY-DEFINER-Funktionen | ja für Modelllauf | nur `service_role`; direktes Tabellen-DML entzogen | bestehende Plattform, Ownership offen | ja: Baseline + `20260806120200...` + Grants `20260806120300...` |

**Soll-Ist-Ergebnis:** Der M07-Kern benötigt keine neue Tabelle, View oder Migration. Der vorhandene Usage-Vertrag ist technisch passend, darf aber erst nach geklärtem Ownership, Datenschutz für `result_json`, Feature-Key und Limits über einen Host-Port verwendet werden. Bis dahin bleibt der Providerpfad AUS. Eine neue Datenwahrheit wäre eine neue Strukturentscheidung und ist nicht durch dieses Dossier freigegeben.

## 5. Manifest und Handshake

| Artefakt | Zielpfad | SHA-256 (12) | Stand |
|---|---|---|---|
| Architekturmanifest | `src/modules/ki-suche/ki-suche.manifest.json` | — | FEHLT; im Bau zu erzeugen: Version, öffentliche Exporte, Capability `ki-search:read`, Dependency `suche`, null Tabellen/Migrationen/Events |
| Capability-Manifest | off-repo-Paket `capability.manifest.json` | — | FEHLT; vor Übergabe zu erzeugen und gegen Dossier zu hashen |
| Integrationshandshake | off-repo-Paket `INTEGRATION_HANDSHAKE.json` | — | FEHLT; erst mit echten Host-Port-, Gate- und E2E-Belegen signierbar |

Der fehlende SHA ist kein Ratestelle: Ein Hash vor Existenz wäre erfunden. Adoption ist bis zu beiden finalen Hashes gesperrt.

## 6. APIs und Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Azure OpenAI / Azure AI Foundry | produktiv ausschließlich im Kreile-eigenen Azure-Abo; konkrete Region, Deployment, Datenebenenrolle und Modell-Capabilities FEHLT → Q-M07-008/009 | keiner freigegeben; Namen FEHLT → Q-M07-009 | GESPERRT; Owner-Dev-Foundry nur für synthetische Tests, kein aktueller Kreile-Real-E2E | Keine Provideranlage, Aktivierung, Rolle, Secretanlage, Kostenfreigabe oder Datenübertragung ohne Owner-Gates Q-M07-008–010; die App zeigt „In Klärung“. |
| Direkte OpenAI API | keine freigegeben | keiner freigegeben | VERWORFEN als stiller/automatischer Fallback; nur neue Owner-Entscheidung bei belegtem Azure-Pflichtgap | D-ARCH-012; nicht aktivieren. |
| Gemini / Google GenAI | keine freigegeben | Legacy-Namen werden nicht übernommen | LEGACY-QUARANTÄNE | Nicht für M07 importieren oder reaktivieren; kein Fallback. |
| G08 interne Suche | G01-Auth und `tenant-search:read` über Serverfassade | keiner | im Erstlauf auf `origin/main` als GEBAUT belegt; Aktualität Q-M07-012 | Bleibt eigenständig; M07 darf Vertrag nicht umgehen oder schwächen. |

## 7. Übertragbarkeit

**Übertragbarkeit:** Kern app-neutral: ja — Request-, Outcome-, Citation- und Action-Schemata sowie Cheap-first-, Citation-, Fail-closed-, Budget-/Audit- und Bestätigungsregeln enthalten keine Kreile-Fachbegriffe; Kreile-Auth, G08, Evidenz, Navigation, Commands, Usage, Audit und Providerbindung liegen ausschließlich im Kreile-HostAdapter.
