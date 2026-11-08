# Review Q13 · Kein Kunde ohne Auftrag

Prüfer: Claude · 27.10.2026 21:27 Berlin (20:27 UTC)
Branch: origin/kreile/s1-p2-eingang · Produkt-SHA 2d00386e

## Urteil: **PASS**

Keine Blocker.

- `src/lib/server/commands/orderIntakeCommand.ts`: Katalog-/Preisprüfung jetzt vor `resolveCustomer` (Kundenanlage). Nach Kundenanlage gibt es für `mode === "NEW"` keinen regulären `return` mehr – alle Fehlerpfade (`ORDER_INTAKE_NEW_CUSTOMER_INVALID`, `…_DISPLAY_INVALID`, Order/Item/Event/Receipt/Readback) werfen → Rollback in `withPrivilegedTenantTransaction`, äußerer catch → `UNAVAILABLE`. Kein verwaister Kunde mehr möglich.
- Weiterhin ein einziger Neukunden-Schreibweg (create_customer_v1 in derselben Transaktion), keine Löschung, keine Migration.
- Regressionstest: veralteter Katalog abgewiesen, bevor create_customer_v1 aufgerufen wird.
- Vorhandene verwaiste TEST-Kunden bleiben (Löschverbot) → DEZEMBER_LISTE.
