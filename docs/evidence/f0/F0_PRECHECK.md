# F0_PRECHECK – T0-Wahrheit und Driftinventur

**Mission:** `F0_FOUNDATION_CONVERGENCE_W2C_W4_001`

**Stufe:** `T0`

**Status:** `FAIL_INTERNAL`
**Scope:** Dokumentation; keine Production-, Datenbank-, Vercel-, Browser-, Paket-, Git-Remote- oder Merge-Aktion in T0.

## Aktuelle Wahrheitsanker

| Wahrheit | Feststellung |
|---|---|
| Kanonischer Stand | Die nachfolgende Inventur ist die einzige aktuelle T0-Wahrheit dieser Mission. |
| GitHub `main` und Vercel Production | `c294c0564dc8a5e137eaa00de1276677cb1a1c53`. |
| Pull Requests und Wellen | 0 offene PRs; W1, W2a und W2b sind gemergt. |
| Missionsstart | Missionsbranch mit sauberem Start. Der geschützte Checkout `feature/capture-auth-tenant@8cf9e6c` enthält 53 untracked Dateien und bleibt unangetastet. |
| Missionszustand | W2C bis W4 dürfen lokal und sequenziell umgesetzt sowie als Kandidat abgenommen werden. |
| Vertragsratifikation | Ausstehend; sie ist Voraussetzung für einen `F0-PASS`-Claim, nicht für den Abschluss von W4. |
| Externe Gates | Sie blockieren Remote- oder Legacy-Mutationen und `F0-PASS`, nicht die lokale W2C-W4-Implementierung. |

## Aktuelle Supabase- und Storage-Fakten

| Bereich | Feststellung |
|---|---|
| Remote-Supabase | `syhaigjhsbpjmtnggqka`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.121`. |
| Remote-Ledger | Exakt 9 Einträge bis `20260810100000_normalize_view_invoker_spelling`; kein belastbarer Statement-/Hash-Digest. |
| `beleg` | Exakt 19 Datensätze, kein `tenant_id`; Defaults `vorsteuer_abzug=true` und `absetzbar_prozent=100`. |
| Tabellen und RLS | 94 `public`-Basistabellen, 62 mit `tenant_id`, 26 ohne RLS. |
| Rechte | Keine direkten DML-Grants für `anon` oder `authenticated` festgestellt; riskante Default-ACLs von `supabase_admin` bestehen fort. |
| Private Buckets | `belege`: 5 MiB/3 Objekte; `buchhaltung-belege`: 5 MiB/1 Objekt; `item-photos`: 12 MiB/0 Objekte; `scans`: 20 MiB/4 Objekte. Nur `scans` hat App-Policies; keine Objektinhalte wurden abgerufen. |

## T0-Drift- und Risikoregister

| ID | Befund und Vorwärtskorrektur | Owner | Schwere | Nachweis |
|---|---|---|---|---|
| T0-01 | Veraltete Dokumentation und fehlende Missionsinstanz: nur diese T0-Inventur und verifizierbare Wahrheit fortschreiben. | Governance | hoch | Dokumenten- und Diff-Review |
| T0-02 | Vertragsratifikation steht aus: explizite Entscheidung vor einem `F0-PASS` einholen. | Auftraggeber/Ratifizierer | hoch | Ratifikationsnachweis |
| T0-03 | Ledger ohne belastbaren Digest: reproduzierbaren lokalen Digest vor Remote-Anfragen herstellen. | Datenbank-Owner | hoch | Unabhängiger Digest-Review |
| T0-04 | `beleg` ohne Tenant-Attribution und mit ungeprüften Steuer-Defaults: Klassifikation vor Mapping oder Legacy-Mutation entscheiden. | Produkt/Accounting | hoch | Freigegebenes Mapping und Tenant-Negativtests |
| T0-05 | RLS-/Default-ACL-Risiko: relationenweise fail-closed-Remediation planen; keine Remote-Änderung ohne Gate. | Production-DB-Owner | kritisch | Grant-/RLS-/Default-ACL-Negativmatrix |
| T0-06 | `scan_uploads`, die `beleg`-Textpfade sowie `items.photo_ids`/`item_photos` bilden mehrere Evidence-Wahrheiten: W4 definiert stabile private Preservation-Metadaten und Legacy-Adapter ohne Umklassifikation alter Objekte. | Evidence-Owner | hoch | Link-, Preservation- und Adaptertests |
| T0-07 | `events.tenant_id` ist nullable und hat einen Default-Literal; außerdem fehlt `correlation_id`. W4 erzwingt serverseitigen Tenant, Korrelation und Idempotenz. | Event-Owner | hoch | Tenant-, Korrelations- und Idempotenztests |
| T0-08 | Browser-Upload/Public-URL, ID-only-Operationen, zweiter Stationsschreiber, Extraction-/Provider-Pfade, synthetische Today-/Cron-Wahrheit und nichtatomare Side-Effects sind aktiv riskant. W2C schließt unsichere Pfade; W3/W4 führen Command-, Event- und Read-Port-Verträge ein. | Command-/Storage-/Read-Model-Owner | kritisch | Negativtests und Reload-Readback-Evidenz |

## Sequenz und externe Gates

1. `T0`: Wahrheit und Drift inventarisieren.
2. `W2C`: unsichere oder erfundene aktive Pfade fail-closed schließen.
3. `W3`: einen serverseitigen Vertrag für Actor, Session-Tenant, fachliche Capability, Ownership und Version mit Result-Union und server-only Service-Role-Provider herstellen.
4. `W4`: private Evidence-Metadaten, append-only Fakten/Ereignisse mit Korrelation und Idempotenz, versionierte `v_*`-Read-Ports sowie negative und End-to-End-Nachweise herstellen.
5. `P1` bis `P12`, Kandidatenbranch-Push, Draft-PR, Vercel Preview und unabhängige Review sind nach F0-Vertrag erlaubt und Teil der Kandidatenabnahme; sie benötigen keine neue Nutzerfreigabe.
6. Nach W4 stoppen; die unabhängige Review erfolgt vor jeder Mergeempfehlung.

- Externe Gates: Production-Default-ACL/Rechte, Legacy-`beleg`-Tenant-/Steuerklassifikation, Bucket-Zwecke/Legacy-Objekte und Vertragsratifikation.
- Diese Gates blockieren `F0-PASS` sowie Remote- und Legacy-Mutationen. Sie blockieren weder lokale W2C-W4-Arbeit noch die W4-Kandidatenabnahme.
- Geschützt bleiben Daten, alte Worktrees und Klone. Keine Löschung, Remote-Migration, RLS-, Grant-, Default-ACL-, Production-, Merge- oder sonstige Remote-Mutation.

## T0-Schlussfolgerung

`FAIL_INTERNAL`: Die dokumentierten Drift- und fail-closed-Lücken verhindern einen `F0-PASS`-Claim. Die lokale, sequenzielle W2C-W4-Implementierung und W4-Kandidatenabnahme bleiben im Missionsvertrag zulässig; externe Gates bleiben offen.
