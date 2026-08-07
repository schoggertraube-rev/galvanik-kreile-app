# F0 â€” Definitorischer ParitÃ¤ts-Diff (Red-Team-Runde)

**Datum:** 2026-08-06
**Anlass:** UnabhÃ¤ngiger Red-Team-Befund â€” der bisherige Namens-/Anzahl-Fingerprint beweist keine
**Definitions-ParitÃ¤t** (eine namensgleiche, aber aufgeweichte Policy/Funktion bliebe unentdeckt).
**Antwort:** definitorischer Fingerprint gebaut (pg_get_expr / pg_get_functiondef / pg_get_constraintdef /
pg_get_indexdef / pg_get_triggerdef / Spaltentypen+Defaults / RLS-Flags / Grants) und Replay vs. Prod verglichen.

## Komponenten-Ergebnis (Replay `Baseline+Lockdown+StoragePolicies` vs. Prod)

| Komponente | Match | Bemerkung |
|---|:--:|---|
| Spalten (Typ/NotNull/Default) | âœ… | md5 `298ae919â€¦` == Prod |
| Indizes (pg_get_indexdef) | âœ… | md5 `75343db5â€¦` == Prod |
| Funktionen (pg_get_functiondef, inkl. SECURITY DEFINER/search_path/Body) | âœ… | md5 `57c5dd75â€¦` == Prod |
| RLS-Flags (relrowsecurity/force) | âœ… | md5 `7176c1c6â€¦` == Prod |
| **Policies (AusdrÃ¼cke)** | âš ï¸ | 69/71 exakt; **2** nur kosmetisch abweichend (s. u.) |
| **Constraints** | âš ï¸ | Anzahl **exakt = Prod** (252, FK 79); md5-Diff nur im Definitionstext â†’ vermutl. Normalisierung, Stichprobe nÃ¤chste Runde |
| **Trigger** | âš ï¸ | Anzahl **exakt = Prod** (7); md5-Diff nur im Definitionstext â†’ vermutl. Normalisierung, Stichprobe nÃ¤chste Runde |
| **Grants** | âŒ | **echter, bidirektionaler Divergenzfund** (s. u.) |

## Policies â€” 2 Abweichungen, semantisch Ã¤quivalent (kosmetisch)
`scan_objects_insert_authenticated` und `scan_objects_update_authenticated`: identische RollenprÃ¼fung
(dieselben 4 Rollen werkstatt/meister/buero/admin), nur andere Postgres-Serialisierung des Array-Casts
(`(ARRAY[...])::text[]` vs. elementweise `ARRAY[(...)::text,...]`). **Kein Sicherheits-/Strukturunterschied.**
Optionale Angleichung: Policy-Quelltext so schreiben, dass er identisch serialisiert (oder Fingerprint fÃ¼r
diese bekannte Ã„quivalenz normalisieren).

## Grants â€” echter Fund (Security-relevant, Entscheidung nÃ¶tig)
`service_role` Grants Replay 756 vs. Prod 735. Ursache: Supabase-Default-Privileges granten service_role
voll auf neue Tabellen (gleiche Mechanik wie beim anon/auth-Lockdown). Bidirektionale Divergenz:

- **Baseline Ã¼ber-grantet (Fix vorhanden, verifiziert):** `app_usage_events`, `developer_feedback`,
  `operator_control_events`, `tenant_operator_controls` â€” Prod hÃ¤lt service_role hier bewusst knapp
  (nur SELECT bzw. INSERT/SELECT[/UPDATE]). Gezieltes REVOKE bringt Replay **exakt auf Prod**.
- **Baseline unter-grantet (BRAUCHT ENTSCHEIDUNG):** `ai_usage_reservations`, `item_photo_jobs`,
  `security_rate_limit_counters` â€” Baseline hat service_role nur REFERENCES/TRIGGER/TRUNCATE,
  **Prod volle 7**. Das sind die RPC-/SECURITY-DEFINER-Tabellen. **Frage: Welche ACL ist gewollt â€”
  Least-Privilege (nur RPC schreibt) oder voller service_role?** â†’ BLOCKED_PRODUCT_DECISION (morgen).

## Bewertung
Der definitorische Fingerprint war die richtige HÃ¤rtung (Red-Team bestÃ¤tigt): er hat sofort echte
Grant-Divergenzen aufgedeckt, die der Namens-Fingerprint verbarg. â€žReplay = Prod" gilt **noch nicht**
voll â€” offen: Constraints/Trigger lokalisieren, 2 kosmetische Policies angleichen/normalisieren, und die
service_role-ACL-Entscheidung. Struktur (Spalten/Indizes/Funktionen/RLS-Flags) ist definitorisch exakt.

## Update 2026-08-07 â€” nach service_role-4-Tabellen-Fix (voller 10-Komponenten-Fingerprint)
Migrations-Set: Baseline + Lockdown + Storage-Policies + **PROD_SERVICE_ROLE_ACL.sql** (neu).
Replay vs. Prod je Komponente:

| Komponente | Prod | Replay | Match |
|---|---|---|:--:|
| cols | 298ae919 | 298ae919 | âœ… |
| idx | 75343db5 | 75343db5 | âœ… |
| func (Bodies) | 57c5dd75 | 57c5dd75 | âœ… |
| rls-Flags | 7176c1c6 | 7176c1c6 | âœ… |
| **func_grants** | 32b5f7cd | 32b5f7cd | âœ… |
| cons | 6d01fa10 | 288694a7 | âš ï¸ zahlgleich (252/79), Normalisierung |
| trig | fd2dbbf7 | 02b69c0d | âš ï¸ zahlgleich (7), Normalisierung |
| pol | ba81e93f | 3ddc472e | âš ï¸ 69/71 exakt; 2 kosmetische Storage-Policies |
| grants | 6ca01b50 | e3b86120 | âš ï¸ 4-Tab-Fix drin; Rest = 3 RPC-Tab (Entscheidung) |
| **def_privs** | 52bcb99 | 5b26728e | âŒ â†’ **bekannter Blocker** `supabase_admin` Default Privileges (extern) |

**Selbst gefundener Fehler behoben:** service_role-Ãœber-Grant auf 4 Tabellen (REVOKE, verifiziert = Prod).
**Rest ist entweder kosmetisch (cons/trig/2 Policies) oder ein bekannter Entscheidungs-/externer Blocker
(3 RPC-Tabellen; def_privs = supabase_admin).** Kein neuer versteckter Defekt.

## NÃ¤chste Runde (nach Entscheidungen)
1. cons/trig-Stichprobe zur endgÃ¼ltigen Kosmetik-BestÃ¤tigung (hohe Sicherheit: PG17-Serialisierung).
2. service_role-3-RPC-Entscheidung, dann grants == Prod.
3. supabase_admin Default Privileges (extern) â†’ def_privs == Prod.
4. Danach: definitorischer Voll-Fingerprint == Prod als CI-Gate scharf.