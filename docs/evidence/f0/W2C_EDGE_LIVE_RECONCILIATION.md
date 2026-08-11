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

## Local source containment and reconciliation boundary

All 13 local Edge entrypoint sources are now fail-closed through the shared non-available response. This local source change does not establish that any remote or Production function is active with that source.

The deployed live-listed functions `email-webhook` and `payments-webhook-mollie`, plus local-only/not-live-listed `mollie-webhook`, remain `BLOCKED_EXTERNAL_PERMISSION` for deploy and live reconciliation because an Edge mutation or deploy requires explicit permission. Remote and Production were neither checked nor changed. No deploy or configuration change was performed.
