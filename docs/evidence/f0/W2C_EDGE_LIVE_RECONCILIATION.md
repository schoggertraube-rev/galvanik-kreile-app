# W2C Edge Live Reconciliation

**Timestamp:** 2026-08-10 Europe/Berlin
**Scope:** read-only reconciliation; no remote mutation, deploy, or configuration change was performed.

## Supplied live facts

Live project `syhaigjhsbpjmtnggqka` lists 11 `ACTIVE` Edge Functions. Every listed function has `verify_jwt=true`:

- `email-send`
- `payments-intent`
- `email-webhook`
- `payments-webhook-mollie`
- `kpi-insight`
- `customer-enrich`
- `freetext-extract`
- `notes-extract`
- `scan-analyze`
- `inquiry-extract`
- `item-photo-analyze`

`mollie-create-payment` and `mollie-webhook` are local-only and are not live-listed. The Edge logs query for the last 24 hours returned no entries; this is not a claim about lifetime use.

## Reconciliation boundary

The deployed webhook candidates `email-webhook` and `payments-webhook-mollie`, plus local `mollie-webhook`, remain `BLOCKED_EXTERNAL_PERMISSION` for reconciliation because an Edge mutation or deploy requires explicit permission. They are intentionally outside the local quarantine scope. No deploy or configuration change was performed.
