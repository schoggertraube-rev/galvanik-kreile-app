# F0 Entscheidungen 2026-08-07 (Nutzer)

| # | Thema | Entscheidung | Umsetzung |
|---|---|---|---|
| 1 | service_role auf 3 RPC-Tabellen | **Least-Privilege** | **Verifiziert:** App referenziert `ai_usage_reservations`/`item_photo_jobs`/`security_rate_limit_counters` **0x direkt** im Code (Zugriff nur via SECURITY-DEFINER-RPC). Baseline ist bereits restriktiv (korrekt). **Prod tightenen** (REVOKE service_role-DML) â†’ Remote-Schritt in F0-04. |
| 2 | buchhaltung-belege Bucket-Limit | **5 MiB, pdf/png/jpeg** | `hardening/F0_06_STORAGE_BUCKET_LIMITS.sql` aktiviert (Remote-Anwendung = F0-06). |
| 3 | PR #48 Merge | **Ja, nach CI-grÃ¼n** | CI-Blocker (Whitespace im verbatim Baseline-Dump) behoben via `.gitattributes`; Merge nach grÃ¼ner Quality. |
| 4 | supabase_admin Default Privileges | **Anleitung, Nutzer setzt** | `ANLEITUNG_supabase_admin_default_privileges.md` (SQL + Verifikation). Ergebnis flieÃŸt in def_privs-ParitÃ¤t. |
| 5 | RLS-CONTRACT-HÃ¤rtung | offen (nÃ¤chste Frage) | Braucht bestÃ¤tigtes Tenant-Modell. |

## Offene Remote-Schritte (Freigabe/F0-04)
- Prod: service_role-DML auf den 3 RPC-Tabellen entziehen (Least-Privilege, s. #1).
- Prod: Storage-Bucket-Limits anwenden (#2) + item-photos.
- Prod: supabase_admin Default Privileges (#4, Nutzer via Dashboard).
- F0-04: Baseline+Lockdown+Storage-Policies+service_role-ACL ledgerfÃ¤hig nach `main`.