# F0-04 â€” service_role-ParitÃ¤t BELEGT (read-only aus Prod, 2026-08-07)

Red-Team-Punkt â€žbelegen statt annehmen" angewandt. Autoritative Prod-Abfrage (`pg_class.relacl`):

| Tabelle | relacl (Prod) | service_role |
|---|---|---|
| ai_usage_reservations | `{postgres=arwdDxtm/postgres}` | **(none)** |
| item_photo_jobs | `{postgres=arwdDxtm/postgres}` | **(none)** |
| security_rate_limit_counters | `{postgres=arwdDxtm/postgres}` | **(none)** |

## Korrektur einer frÃ¼heren Fehlannahme
FrÃ¼here Notiz â€žProd grantet service_role VOLL auf diesen 3, Baseline unter-grantet" war **falsch**.
Wahrheit: Prod hat auf diesen 3 Tabellen **nur Owner postgres**, service_role = keine Rechte.
Prod ist dort **bereits least-privilege** (Zugriff nur via SECURITY-DEFINER-RPC, owner postgres).

Konsequenzen:
- **ParitÃ¤t-vor-HÃ¤rtung** heiÃŸt hier: Baseline muss service_role auf diesen 3 **entziehen** (nicht granten).
- **Entscheidung #1 (Least-Privilege)** deckt sich exakt mit Prod-Ist â†’ **keine Prod-Ã„nderung nÃ¶tig**.

## PrÃ¤ziser Rest-Step F0-04 (nÃ¤chster Block, kein Docker lokal â€” CI beweist)
Der aktive Baseline-Inhalt auf diesem Branch ist **#40 (05.08)**, also VOR meiner Prod-HÃ¤rtung
(anon/auth 666â†’0, service_role-Revokes, Storage-Policies). D1/D2 sind als Post-Baseline drin, decken aber
nur belege-Bucket + revoke-execute â€” **nicht** die volle Grants-HÃ¤rtung.
â†’ Reststep: **#40-Mechanik behalten** (Archiv + Ledger-Check + Manifeste), **Baseline-Inhalt auf meinen
bewiesenen 06.08-Stand heben** (`db_baseline/PROD_BASELINE_2026-08-06.sql` + `PROD_LOCKDOWN_GRANTS.sql`
+ `PROD_STORAGE_POLICIES.sql` + `PROD_SERVICE_ROLE_ACL.sql`), dann **committete Prod-Grants-Referenz** anlegen,
damit der CI-Fingerprint-Schritt `grants`/`pol` gegen Prod vergleicht (Gate scharf).

## Beweis-Weg (ohne lokalen Docker)
CI-Job `fresh-supabase-replay` (grÃ¼n) + Fingerprint-Report-Schritt â†’ gegen committete Prod-Referenzdatei.
Kein Prod-Zugriff aus CI; Prod bleibt read-only.