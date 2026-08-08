# F0_POSTFLIGHT — Ledger-Reconciliation Nachweis (2026-08-08)

**Operation:** ausgeführt 2026-08-08 via Supabase-MCP `execute_sql` (eine Transaktion), project `syhaigjhsbpjmtnggqka`.
**Freigabe:** Nutzer, Ratifizierer-Auflage 1. **Plan+Backup:** F0_LEDGER_RECONCILIATION_PLAN.md.

## Ergebnis
| Messwert | Soll | Ist |
|---|---|---|
| ROWS | 8 | **8** ✓ |
| Versionen | 20260805180624,20260805180801,20260806120000,20260806120100,20260806120200,20260806120300,20260807090000,20260807090100 | **exakt identisch** ✓ |
| POST_DIGEST (md5 version:name sortiert) | dokumentiert | **693a36cefda4eeb9a6f4330517403d5c** |
| PRE_DIGEST (Backup, 98 Zeilen) | — | 55d2fb1404d2b9d57e3373aaf0ab9d05 |

## Schema-Unversehrtheit (Stichprobe unmittelbar nach Mutation, read-only)
- `grants` = 01feb57e0cbb387abb9842f7f07c6413 → **identisch zur Referenz** ✓
- `pol` (mit `set search_path=pg_catalog`) = af7dd29ef35db3ec25297d54b999ba32 → **identisch zur Referenz** ✓
- Lehrstück protokolliert: Erstabfrage ohne search_path lieferte abweichendes pol-Rendering (1d99cfe9…) —
  bestätigt die dokumentierte Determinismus-Regel; kein Drift.

## Konsequenz
`supabase db push`/`db diff` sieht Repo und Prod jetzt als deckungsgleich (Ledger = aktive Migrationsmenge).
F0-A04: PASS. Rückfallweg bleibt über Backup + migrations_legacy (SHA-manifestiert) jederzeit möglich.
