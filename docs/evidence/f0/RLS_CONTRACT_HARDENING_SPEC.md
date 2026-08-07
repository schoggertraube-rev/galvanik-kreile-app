# RLS-CONTRACT-001 HÃ¤rtung â€” Spezifikation (F0-05, Entscheidung 5 = â€žjetzt hÃ¤rten")

**Datum:** 2026-08-07 Â· read-only analysiert gegen Prod Â· **Build+Verify = nÃ¤chster Block** (nicht Ã¼berhasten).
**Tenant-Modell (bestÃ¤tigt):** server-kanonisch `galvanik-kreile` via GUC `current_setting('app.tenant_id', true)`.
Kanonisches Muster (aus vorhandenen `tenant_isolation`-Policies): `USING (tenant_id = current_setting('app.tenant_id'::text, true))`
(bzw. `(tenant_id)::text = â€¦` bei varchar; Kind-Tabellen via EXISTS gegen Elterntabelle).

## 29 breite Policies (qual=true / null, nicht tenant-gebunden) â€” Disposition

### A) Bereits `tenant_isolation` vorhanden â†’ breite Policy nur DROPPEN (kein Neubau)
- `inquiries.auth_all_inquiries`, `inquiries.public_all_inquiries_final` â†’ droppen (behalte `tenant_isolation_inquiries`).
- `items.public_all_items_final` â†’ droppen (behalte `tenant_isolation_items`).

### B) `tenant_id`-Spalte vorhanden (8) â†’ DROP breit + CREATE tenant-gebunden (Muster oben)
- `audit_log` (text) â€” **append-only beachten**: nur INSERT+SELECT tenant-gebunden, kein UPDATE/DELETE (GoBD-Trigger respektieren).
- `calendar_events` (text)
- `communication_drafts` (varchar)
- `email_templates` (text) â€” Config; tenant-gebunden.
- `kpi_snapshots` (text) â€” nur SELECT.
- `kvp_items` (text)
- `offline_outbox` (varchar)
- `order_cost_positions` (varchar) â€” alt.: EXISTS-Join auf `orders`.

### C) KEIN `tenant_id` (14) â†’ anderer Vertrag nÃ¶tig (NICHT dasselbe Muster)
Buchhaltung/Config, inhÃ¤rent single-tenant. Vorschlag: `USING (auth.uid() IN (select id from app_users where active))`
bzw. Kindâ†’Eltern-Join, oder `TO authenticated` + aktiver-User-Check. **Pro Tabelle einzeln festzulegen:**
- Kindâ†’Eltern-Join: `beleg_position`â†’`beleg`, `kraftstoff_detail`â†’`beleg`, `import_job_rows`â†’`import_jobs`.
- Eltern/Config ohne tenant_id: `beleg`, `bh_audit_log` (append-only!), `bh_einstellungen`, `export_lauf`,
  `feature_flags`, `import_jobs`, `kategorie`, `kostenposten`, `lieferant`, `steuerprofil`, `ustva_periode`, `zahlung`.
  â†’ aktiver-App-User-Vertrag (kein anonymer Zugriff), Schreibrechte je GoBD/Rolle.

## Build-Plan (nÃ¤chster Block)
1. Migration `PROD_RLS_CONTRACT_HARDENING.sql`: Gruppe A (3 DROPs) + Gruppe B (8 DROP+CREATE) + Gruppe C (14, je Vertrag).
2. Lokaler Replay + **positive/negative Tests**: korrekter `app.tenant_id` sieht Zeilen; falscher/kein Tenant = 0 Zeilen;
   anon = 0; GoBD-Append-only bleibt erzwungen.
3. Fingerprint `pol` gegen Prod neu (Prod muss identisch gehÃ¤rtet werden â†’ Remote-Freigabe).
4. Red-Team, dann PR.

## Sicherheitsleitplanken
- Reihenfolge: **immer** neue Policy anlegen bevor breite entfernt wird (kein â€žoffenes Fenster"; da RLS OR-verknÃ¼pft,
  besser: neue anlegen â†’ alte droppen in einer Transaktion).
- Append-only-Tabellen (`audit_log`, `bh_audit_log`, `beleg`) nie mit `FOR ALL` Ã¼berschreiben.
- Kein `TO public` mit `true`; immer tenant-/user-gebunden.
- Aktuell zusÃ¤tzlich durch 0 anon/auth-Grants gedeckt (kein akuter Leak), daher sorgfÃ¤ltig vor schnell.