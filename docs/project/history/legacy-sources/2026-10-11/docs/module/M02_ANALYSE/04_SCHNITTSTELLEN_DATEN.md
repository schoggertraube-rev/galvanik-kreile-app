<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 04 – Schnittstellen und Daten

Stand: 2026-09-26  
Modul: M02 Analyse

## Architekturgrenze

Der Analyse-Core ist ein read-only Decision-Support-Kern. Er besitzt keine fachlichen Fakten, keine Speicherung, keine UI, keine Authentifizierung, keine Providerverbindung und keine Command-Schnittstelle. Der spätere Host bleibt für Tenant, Auth, Disclosure, Datenbeschaffung, kanonische Serialisierung, Rendering und Retention verantwortlich.

## Angebotene Schnittstelle

| Port | Richtung | Vertrag | Status | Bemerkung |
|---|---|---|---|---|
| `decision-support.read/v1` | Host → Core → Host | kanonischer Request und `ReadEnvelope` | GEBAUT im Off-Repo-Core | Exporte `src/public.ts` und `src/server-public.ts`; keine Legacy- oder Command-Fassade |

## Benötigte Host-Schnittstellen

| Port/Fähigkeit | Richtung | Minimaler Inhalt | Status | Blocker |
|---|---|---|---|---|
| `domain-fact-adapter/v1.1` | Host → Core | kanonische Fakten, Entitätsreferenzen, Scope, Snapshot, Pagination/Coverage | FEHLT | Externes Integrationsgate; fachliche Reihenfolge durch OE-2609-21/23 geklärt |
| Metric-Pack | Host-Konfiguration → Core | zugelassene Metriken, Methoden, Einheiten, Threshold-/Prioritätspolicy | FEHLT | Externes Integrationsgate; Termintreue zuerst, Liquidität 30 Tage nach M01 |
| Tenant/Auth/Disclosure | Host → Core | Tenant, Person/Rolle, Sichtbarkeitsentscheidung, Feldunterdrückung | FEHLT | Q-M02-005 |
| Retention/Anonymisierung | Host → Fachmodule | Frist je Datenart, Vorschlag, Admin-Freigabe, Personenbezug entfernt | FEHLT | OE-2609-20; externes Datenschutz-/Integrationsgate Q-M02-005 |
| Leadership-Mapping | M03/Host → Core | kanonische Ziel-/Entscheidungsreferenzen für Termintreue und Liquidität 30 Tage | FEHLT | Q-M02-006 |
| Domain-Receipt-Read | Fremdmodule/Host → Core | unveränderte Action-/Receipt-Referenzen | FEHLT | Q-M02-006 |
| Projektions-Renderer | Core → Host-UI | renderer-neutrale Projektion, Beschreibung, Tabelle | FEHLT | Q-M02-002 |
| kanonische Serialisierung | Host/Core | bytegenaue Reihenfolge/Normalisierung für Content-Hashes | OFFEN | Q-M02-004; aktueller Repo-Abgleich Q-M02-007 |

## Events und Schreibwege

M02 publiziert und konsumiert in V1 keine Events und besitzt keinen Schreibweg. Handlungen werden in zuständigen Fremdmodulen ausgelöst und nur über deren kanonische Receipts referenziert. Ein neuer Event-, Command- oder Speicherweg wäre eine neue dauerhafte Strukturentscheidung und benötigt vor Umsetzung eine eigene Freigabe.

## Felder und Datenwahrheit

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `ReadRequest` | `tenantId` | stabile ID | ja | nicht leer; Tenant-Isolation vor Core-Aufruf | Host/Auth | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadRequest` | `actorRef` | kanonische Personen-/Rollenreferenz | ja | Host autorisiert und begrenzt Disclosure | Host/Auth | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadRequest` | `requestId` | stabile ID | ja | pro Anfrage eindeutig | Host | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadRequest` | `asOf` | ISO-8601-Zeitpunkt | ja | explizit; keine implizite Systemzeit | Host-Snapshot | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadRequest` | `timezone` | IANA-Zeitzone | ja | explizit und periodenstabil | Host/Policy | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadRequest` | `scope` | kanonisches Objekt | ja | Population, Zeitraum und Filter explizit | Host/Fachmodul | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `snapshotRef` | stabile Referenz | ja | gemeinsamer oder ausdrücklich begrenzter Snapshot | Fact-Adapter/Fachmodul | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `entityRefs[]` | kanonische Referenzen | bedingt | keine Entitätskopie; tenantgebunden | zuständiges Fachmodul | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `capability.status` | Enum | ja | `SUPPORTED/UNSUPPORTED/ERROR` | Fact-Adapter | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `evidence.status` | Enum | ja | `READY/STALE/PARTIAL/UNKNOWN/CONFLICTING` | Fact-Adapter/Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `disclosure.status` | Enum | ja | `VISIBLE/DENIED/SUPPRESSED` | Host-Policy/Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `coverage` | Integer/Zähler + Population | ja | Nenner/Eligibility/Truncation explizit | Fact-Adapter/Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `FactRef` | `provenance[]` | Referenzliste | ja | Quelle, Feld, Owner, Port und Snapshot nachvollziehbar | Fact-Adapter/Fachmodul | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `TermintreueFact` | zugesagter Termin | Zeitpunkt/Datum | ja | für die geschlossene Population und Zeitzone eindeutig | Orders/Production | nein; fachlicher Soll-Vertrag nach OE-2609-21 |
| `TermintreueFact` | fertig beziehungsweise abgeholt | Zeitpunkt/Datum + Status | ja | Eligibility, Storno und maßgebliches Ereignis explizit | Orders/Production | nein; fachlicher Soll-Vertrag nach OE-2609-21 |
| `TermintreueFact` | Zeitraum/Population | Scope + Coverage | ja | vollständig paginiert; keine Stichprobe als Gesamtquote | Orders/Production | nein; fachlicher Soll-Vertrag nach OE-2609-21 |
| `LiquiditaetInput` | Kontostand + Standdatum | MoneyMinor + Zeitpunkt | ja | manuell bestätigt; Aktualität sichtbar | M01/Host-Einstellungen | nein; fachlicher Soll-Vertrag nach OE-2609-24 |
| `LiquiditaetInput` | laufende Kosten | MoneyMinor + Rhythmus + Fälligkeit | ja | vollständige freigegebene Liste | M01/Host-Einstellungen | nein; fachlicher Soll-Vertrag nach OE-2609-24 |
| `LiquiditaetInput` | offene Posten | MoneyMinor + Fälligkeit + Status | ja | vollständige Population, Reversal/Status berücksichtigt | M01 | nein; fachlicher Soll-Vertrag nach OE-2609-23/24 |
| `LiquiditaetInput` | Personalkosten | MoneyMinor-Summe | ja | nur freigegebene Summe, keine Gehalts-Einzeldaten | geschützte Gehaltsplanung/M01 | nein; fachlicher Soll-Vertrag nach OE-2609-24 |
| `RetentionRef` | Personenbezug/Anonymisierungsstatus | Enum + Zeitpunkt | bedingt | nie still löschen; Admin-Freigabe referenzieren | Host/Fachdatenbesitzer | nein; Integrationsvertrag nach OE-2609-20 |
| `MetricDefinition` | `metricId` | versionierte stabile ID | ja | im zugelassenen Pack; Hashbindung | Metric-Pack/Fachowner | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `MetricDefinition` | `method` | Enum | ja | nur `SUM`, `DIFFERENCE`, `RATIO_BPS`, `ON_TIME_RATE`, `AVG_DURATION_SECONDS` | Metric-Pack/Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `Calculation` | `value` | Integer + Einheit | bedingt | keine Floats; Geld als sichere Minor Units | Core-Ableitung | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `claim` | strukturiertes Objekt | bedingt | nicht kausal; Evidenz/Unsicherheit gebunden | Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `recommendation` | strukturiertes Objekt | bedingt | keine automatische Handlung; externe PriorityPolicy | Core + Host/Leadership | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `brief` | strukturierte Projektion | bedingt | trägt Zustandsachsen und Belegreferenzen | Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `derivationGraph` | gerichtete Referenzstruktur | bedingt | azyklisch; Unterdrückung propagiert | Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `visualization` | renderer-neutrale Spezifikation | bedingt | max. 12 Serien/1000 Punkte; Tabelle/Beschreibung | Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `actionRef` | opake Fremdreferenz | bedingt | keine M02-Commandsemantik | zuständiges Fremdmodul | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `receiptRef` | kanonische Fremd-Receipt-Referenz | bedingt | Owner/Operation/Assurance prüfbar | zuständiges Fremdmodul | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `projectionId` | deterministische ID | ja | aus kanonischer Eingabe/Ausgabe | Core | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `contentHash` | SHA-256 | ja | kanonische Serialisierung | Core/Hostvertrag | nein; nur Off-Repo-DTO `src/contracts.ts` |
| `ReadEnvelope` | `error.code` | versionierter Code | bedingt | kein Null-/Legacy-Fallback | Core/Adapter | nein; nur Off-Repo-DTO `src/errors.ts` |

Beim letzten belegten Read-only-Abgleich war keines dieser Felder als kanonisches M02-Schema in `origin/main` adoptiert; ein `src/db`-M02-Schema existierte nicht. Der aktuelle Git-Stand konnte in diesem Nachlauf wegen `dubious ownership` nicht gelesen und wurde auftragsgemäß nicht erneut abgefragt (Q-M02-007, Zuständigkeit PL). Das ist kein Auftrag für eine neue Tabelle: Der Core ist zustandslos; persistiert werden nur bestehende fachliche Fakten beziehungsweise Receipts in ihren zuständigen Modulen.

## Manifest und Übernahmebelege

| Artefakt | Nachweis | Bedeutung |
|---|---|---|
| `outputs/analysis-core-v1.1/ARTIFACT_MANIFEST.json` | SHA-256 `7A2BA82A7230AD6C2C52A1715E77C4FBAA7E08886A5F71F1C5A048ABFD30B360` | Finaler Kandidatenumfang, 146 manifestierte Dateien |
| `capability.manifest.json` | SHA-256 `CCFE95C5808C…` | Angebotene Fähigkeit/Portgrenze |
| `INTEGRATION_HANDSHAKE.json` | SHA-256 `AA0F045F400B…` | Integrationsform, kein realer Hostnachweis |
| `TEST_RECEIPT.json` | SHA-256 `A1C22EB0C6E0…` | Beleg vom 2026-09-17: 66/66 PASS für `node --test tests/*.test.mjs` am Audit-Freeze; 67/67 PASS für die Post-Closure-Funktionssuite ohne `artifact-integrity.test.mjs`; vollständiger Post-Closure-Gesamtlauf offen (Q-M02-011) |
| externer Scope-Closure-Check | SHA-256 `FFEE68E892F24A7D8C584BFD6C905293B3FDFE0776B5D82DB45E1192631358C4` | Enger unabhängiger Reaudit: PASS, keine offenen P0/P1 |

## Provider und externe Dienste

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| M02-Core | keine Netzwerk-/Providerrechte | — (keins im Core) | GEBAUT, off-repo | Darf keine eigene Verbindung hinzufügen |
| Supabase/Hostdaten | nur durch künftig freigegebenen Host/Adapter; tenant- und rollenbegrenzt | FEHLT → erst im konkreten Integrationsauftrag benennen | NICHT ANGEBUNDEN | Keine Remote-Migration/RLS-Änderung ohne ausdrückliche Freigabe |
| Microsoft 365/Graph | keine direkte Nutzung durch M02 | — (verboten im Core) | NICHT VORGESEHEN | Nur kanonische Fakten anderer Module, niemals Direktzugriff |
| Bank/PaymentAdapter | keine direkte Nutzung durch M02; später nur bestätigte M01-Fakten | — (kein Secret in M02) | SPÄTER / NICHT ANGEBUNDEN | Zustimmung, Vertrag und Kosten am Owner-Gate Q-M02-010; bis dahin ausschließlich manuelle Daten nach OE-2609-24 |
| LLM/AI-Provider | keine Laufzeitabhängigkeit im Core | — (keins) | NICHT VORGESEHEN | Keine erfundene Providerfunktion |

## Festgelegte Datenpfade

1. **Zuerst Termintreue (OE-2609-21):** geschlossene, vollständig paginierte Auftrags-/Produktionspopulation. Der Fact-Adapter muss mindestens Zusage, Fertig-/Abholereignis, Storno, Eligibility, Snapshot, Zeitraum, Zeitzone, Coverage, Staleness, Disclosure und kanonische Entitätsreferenzen liefern.
2. **Danach Liquidität 30 Tage nach M01 (OE-2609-23/24):** manueller Kontostand, laufende Kosten, offene Posten und freigegebene Personalkosten-Summen. Solange die Aktualitätsschwelle Q-M02-008 offen oder der Kontostand veraltet ist, muss die Projektion warnen und darf keine Scheingenauigkeit erzeugen. Eine spätere Bankanbindung liefert über M01 nur bestätigte Vorschläge.

Prioritäts- und Empfehlungspolicy bleiben externe, ausdrücklich freizugebende Kreile-Host-/Metric-Pack-Wahrheit. Andere finanzielle Unternehmens-KPIs sind nicht zulässig, solange M01 keine vollständige Population mit Snapshot-, Recognition-, Kosten- und Reversal-Regeln anbietet.

## Übertragbarkeit

Kern app-neutral: ja – der unveränderte Core enthält keine Kreile-Fachbegriffe und keine Kreile-Datenwahrheit. Termintreue, Liquidität 30 Tage, Tenant/Auth/Disclosure/Retention, EntityRefs, Rendering und Providergrenzen liegen ausschließlich im Kreile-HostAdapter beziehungsweise in den besitzenden Kreile-Fachmodulen.
