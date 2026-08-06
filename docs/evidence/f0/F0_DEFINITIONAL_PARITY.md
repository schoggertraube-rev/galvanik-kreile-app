# F0 — Definitorischer Paritäts-Diff (Red-Team-Runde)

**Datum:** 2026-08-06
**Anlass:** Unabhängiger Red-Team-Befund — der bisherige Namens-/Anzahl-Fingerprint beweist keine
**Definitions-Parität** (eine namensgleiche, aber aufgeweichte Policy/Funktion bliebe unentdeckt).
**Antwort:** definitorischer Fingerprint gebaut (pg_get_expr / pg_get_functiondef / pg_get_constraintdef /
pg_get_indexdef / pg_get_triggerdef / Spaltentypen+Defaults / RLS-Flags / Grants) und Replay vs. Prod verglichen.

## Komponenten-Ergebnis (Replay `Baseline+Lockdown+StoragePolicies` vs. Prod)

| Komponente | Match | Bemerkung |
|---|:--:|---|
| Spalten (Typ/NotNull/Default) | ✅ | md5 `298ae919…` == Prod |
| Indizes (pg_get_indexdef) | ✅ | md5 `75343db5…` == Prod |
| Funktionen (pg_get_functiondef, inkl. SECURITY DEFINER/search_path/Body) | ✅ | md5 `57c5dd75…` == Prod |
| RLS-Flags (relrowsecurity/force) | ✅ | md5 `7176c1c6…` == Prod |
| **Policies (Ausdrücke)** | ⚠️ | 69/71 exakt; **2** nur kosmetisch abweichend (s. u.) |
| **Constraints** | ⚠️ | Anzahl **exakt = Prod** (252, FK 79); md5-Diff nur im Definitionstext → vermutl. Normalisierung, Stichprobe nächste Runde |
| **Trigger** | ⚠️ | Anzahl **exakt = Prod** (7); md5-Diff nur im Definitionstext → vermutl. Normalisierung, Stichprobe nächste Runde |
| **Grants** | ❌ | **echter, bidirektionaler Divergenzfund** (s. u.) |

## Policies — 2 Abweichungen, semantisch äquivalent (kosmetisch)
`scan_objects_insert_authenticated` und `scan_objects_update_authenticated`: identische Rollenprüfung
(dieselben 4 Rollen werkstatt/meister/buero/admin), nur andere Postgres-Serialisierung des Array-Casts
(`(ARRAY[...])::text[]` vs. elementweise `ARRAY[(...)::text,...]`). **Kein Sicherheits-/Strukturunterschied.**
Optionale Angleichung: Policy-Quelltext so schreiben, dass er identisch serialisiert (oder Fingerprint für
diese bekannte Äquivalenz normalisieren).

## Grants — echter Fund (Security-relevant, Entscheidung nötig)
`service_role` Grants Replay 756 vs. Prod 735. Ursache: Supabase-Default-Privileges granten service_role
voll auf neue Tabellen (gleiche Mechanik wie beim anon/auth-Lockdown). Bidirektionale Divergenz:

- **Baseline über-grantet (Fix vorhanden, verifiziert):** `app_usage_events`, `developer_feedback`,
  `operator_control_events`, `tenant_operator_controls` — Prod hält service_role hier bewusst knapp
  (nur SELECT bzw. INSERT/SELECT[/UPDATE]). Gezieltes REVOKE bringt Replay **exakt auf Prod**.
- **Baseline unter-grantet (BRAUCHT ENTSCHEIDUNG):** `ai_usage_reservations`, `item_photo_jobs`,
  `security_rate_limit_counters` — Baseline hat service_role nur REFERENCES/TRIGGER/TRUNCATE,
  **Prod volle 7**. Das sind die RPC-/SECURITY-DEFINER-Tabellen. **Frage: Welche ACL ist gewollt —
  Least-Privilege (nur RPC schreibt) oder voller service_role?** → BLOCKED_PRODUCT_DECISION (morgen).

## Bewertung
Der definitorische Fingerprint war die richtige Härtung (Red-Team bestätigt): er hat sofort echte
Grant-Divergenzen aufgedeckt, die der Namens-Fingerprint verbarg. „Replay = Prod" gilt **noch nicht**
voll — offen: Constraints/Trigger lokalisieren, 2 kosmetische Policies angleichen/normalisieren, und die
service_role-ACL-Entscheidung. Struktur (Spalten/Indizes/Funktionen/RLS-Flags) ist definitorisch exakt.

## Nächste Runde
1. Constraints- und Trigger-Diff lokalisieren (vermutlich pg_dump-Normalisierung vs. echt).
2. service_role-ACL-Entscheidung einholen, dann `PROD_SERVICE_ROLE_ACL.sql` final.
3. 2 Storage-Policies serialisierungs-angleichen ODER Fingerprint-Normalisierung.
4. Danach: definitorischer Voll-Fingerprint == Prod als CI-Gate.
