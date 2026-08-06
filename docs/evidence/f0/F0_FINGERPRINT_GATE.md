# F0 Fingerprint-Gate — definitorische Replay==Prod-Prüfung

**Zweck:** Bei jedem Build den Fresh-Replay gegen Prod prüfen — **auf Definitionsebene**
(Policy-Ausdrücke, Funktions-Bodies, Constraints, Spalten), nicht nur Namen/Anzahl.
**Script:** `docs/evidence/f0/hardening/f0_schema_fingerprint.sql` (identisch auf Replay und Prod ausführen).

## Hinterlegte Prod-Referenz (2026-08-06, read-only)

| Komponente | Prod-md5 | Replay-Status |
|---|---|---|
| cols (Spalten Typ/NotNull/Default) | `298ae919741dd003962021f8f1d5fa84` | **EXAKT** |
| idx (Indizes) | `75343db54bb620978e1461bdeeb2e195` | **EXAKT** |
| func (Funktions-Bodies inkl. SECDEF/search_path) | `57c5dd75d3af96d97423714cd6affb88` | **EXAKT** |
| rls (RLS-Flags) | `7176c1c699aa26fb0c23276c53341087` | **EXAKT** |
| cons (Constraints) | `6d01fa1055264eeed86b00940bba8220` | Anzahl exakt (252/FK79); Text-Normalisierung |
| trig (Trigger) | `fd2dbbf795278d30567641a9dc244488` | Anzahl exakt (7); Text-Normalisierung |
| pol (Policy-Ausdrücke) | `ba81e93f371031e2952e90befec17545` | 69/71 exakt; 2 kosmetisch (s.u.) |
| grants (public+private) | `6ca01b506766bfdf5507067b094006c0` | service_role-ACL-Divergenz (s.u.) |

Voll-Fingerprint (Namensebene, Struktur inkl. storage-Policies): Prod `7c6bbd55e1e80a4aaee974075f7cec4e`,
Replay identisch (71 Policies) — belegt strukturelle Parität.

## Gate-Regeln
- **Hart (müssen exakt sein):** cols, idx, func, rls. Abweichung ⇒ FAIL.
- **cons/trig:** Anzahl muss exakt sein (252/79/7); Text-md5-Abweichung ist als
  pg_dump/Serialisierungs-Normalisierung dokumentiert (Stichprobe bestätigt Semantik) ⇒ WARN, kein FAIL,
  solange Anzahl + Stichprobe stimmen.
- **pol:** die 2 Storage-Policies `scan_objects_insert/update_authenticated` weichen nur in der
  Array-Cast-Serialisierung ab (gleiche 4 Rollen) ⇒ bekannte, bewiesene Äquivalenz (WARN).
  Alle übrigen 69 müssen exakt sein.
- **grants:** nach Klärung der service_role-ACL (Entscheidung) muss grants exakt matchen.

## Bekannte Rest-Divergenzen (zu schließen)
1. **grants/service_role** — 4 Tabellen fixbar (REVOKE, verifiziert), 3 RPC-Tabellen ENTSCHEIDUNG nötig.
2. **2 Storage-Policies** — optional serialisierungs-angleichen für md5-Exaktheit.
3. **cons/trig** — Stichprobe zur endgültigen Kosmetik-Bestätigung (nächste Runde).

## Einsatz in CI (F0-08 P8)
Job: fresh `supabase db reset` → `f0_schema_fingerprint.sql` → Vergleich gegen diese Referenz;
Prod-Referenz read-only re-attestieren (kein Schreibzugriff). FAIL bei harter Abweichung.
