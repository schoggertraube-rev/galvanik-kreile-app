---
name: project-g04-b2-timestamps-storno
description: Paket B2 "Auftrag-Zeitpunkte" — G04 forbids building Storno (Q-G04-002 open), and the Termintreue KPI consumer is deleted by MODULKARTE_KANON; findings from 2026-09-27
metadata:
  type: project
---

Paket B2 (branch `claude/kr-b2-auftrag-zeitpunkte`, PL order 2026-09-27) asks for
"eindeutige Zeitpunkte fertig/abgeholt + Storno-Behandlung laut G04". The G04
dossier itself **forbids** the Storno half.

**Why:** `Q-G04-002` (which fachliche Stornoarten exist, how they count in the
Termintreue denominator) is `OFFEN – abgesichert`, owner-decision-level. G04
therefore mandates the opposite of building it: `A-G04-023` (Stand FEHLT) requires
only a greyed-out, non-clickable `„Auftragsstorno – In Klärung"`; `T-G04-024`
tests that no Storno write path exists; `04_SCHNITTSTELLEN_DATEN.md` marks
`ORDER_CANCELLED_V1` as "FEHLT; nicht implementieren" and `cancelled_at` /
`cancellation_reason` as "keine Umsetzung vor Q-G04-002". Order-level cancellation
does not exist in code (only invoice-level, in `immutableInvoiceCommand.ts`).

Second blocker, scope-level: the Termintreue KPI consumer (M02 / Analyse) is
explicitly deleted by the authoritative scope source
`docs/project/linie/MODULKARTE_KANON.md` — "ENTFÄLLT BEWUSST — kein Modul, auch
keine Mini-Version, wird GELÖSCHT: Analyse/KPI-Cockpit" and "ENTFÄLLT → LÖSCHEN:
analyse, cockpit, kontrolle, performance, status (alle KPI/Cockpit)". The dossier's
basis OE-2609-21/-22 (Termintreue as first KPI, Analyse as its own menu item) is
unanchored — see [[project-moduldossiers-not-authoritative]].

**How to apply:** Treat B2 as at most the *timestamp* half plus read-port facts;
route Storno and any Analyse surface to `BLOCKED_PRODUCT_DECISION` rather than
implementing. Do not let "laut G04" be read as authorization — G04 says "nicht
implementieren".

Concrete code fact worth remembering (not derivable from the dossier, which claims
`completed_date` is the unique finish timestamp):
`src/lib/server/commands/orderFreezeCorrectionCommand.ts` sets
`completed_date = NULL` on correction, and `orderFreezeCommand.ts` re-sets it via
`clock_timestamp()`. So `orders.completed_date` is mutable and a corrected+refrozen
order reports the *second* freeze time. Event history
(`ORDER_FROZEN_V1` / `ORDER_FREEZE_CORRECTED_V1`) is the only append-only truth.
The pickup timestamp has no column at all — it lives in `events.created_at` of
`ORDER_PICKED_UP_V2`. `pickup_due_date` does not exist anywhere in `src/` or
`supabase/`.
