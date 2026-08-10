# F0_TEST_EVIDENCE — massgebliche Gate-Tabelle (Neufassung 2026-08-10, BF-005)

Fruehere Fassungen (Kandidaten-Branch-Notizen, DATABASE_URL-Fehlschlaege, Encoding-Schaeden) sind
vollstaendig ersetzt; Historie = Git.

| Gate | Mechanik | Ort |
|---|---|---|
| Fresh-Replay x2 | leere DB → alle aktiven Migrationen, ZWEITER Reset, Gesamt-Digest byte-gleich | Replay-Job (`REPLAY_DETERMINISM=PASS`, Digest 9dc1067b…) |
| Fingerprint hart | 7 Komponenten byte-exakt = Prod (cols/idx/func/rls/grants/func_grants/**viewopts**) | fingerprint-compare.mjs |
| Grant-Denial relationsweit | ALLE public-Tabellen+Views: has_table_privilege(anon/authenticated, SELECT)=false | f0_negative_tests.sql (A) |
| RLS-Inventar | >=29 Haertungspolicies; keine breiten Policies ausser service_role | (B) |
| Storage-Inventar | 0 public Buckets; Policy-Mindestbestand; Limits | (F) |
| Tenant-Fixture-Matrix | ALLE 8 tenant_isolation-Tabellen: eigener/fremder/leerer Kontext + Cross-Tenant-INSERT-Denial | (E1–E4) |
| Session-/PIN-Grundlage | pin_rate_limits existiert; alle pin_hash bcrypt | (H) |
| Tenant-Coverage | jede tenant_id-Tabelle kategorisiert, Kategorien+Policies live abgeglichen | check-tenant-coverage.mjs + F0_TENANT_COVERAGE.json |
| Storage-HTTP-Negativmatrix | S1–S12 gegen echte Storage-API: eigenes Objekt ok; fremd/bucketuebergreifend/anon deny; MIME 415; Groesse 413; Signed-URL expired/manipuliert/fremd deny; Cleanup verifiziert | f0-storage-http-tests.mjs |
| Echte Session-Kette | V1–V5 gegen `next start`: realer PIN-Login→Cookie; verify mit Session ok; ohne/manipuliert 401; readonly→Write 401 | f0-verify-http-tests.mjs |
| DB-Integration | scan_order gegen Replay-DB (Auth dort bewusst gemockt — DEKLARIERT im Test; die Auth-Grenze beweisen V1–V5 + Playwright) | Replay-Job |
| Auth-E2E | Playwright Auth-Boundary | quality-Job |
| Doc-Truth | Platzhalter-, Konsistenz-, Superseded-as-current-Gate | check-f0-doc-truth.mjs |
| Toolchain | tsc · lint:full (eigener Step) · Units · Build · Ratchet · Boundary · Ledger · Forbidden-Patterns · diff-check | quality-Job |
| Runtime-Audit | npm audit --omit=dev --json als CI-Rohartefakt `runtime-audit` (kein Fail-Gate; Review-Pflicht) | quality-Job |

## Ehrliche Grenzen (deklariert, nicht versteckt)
- scan_order mockt Autorisierung (DB-Integrationsbeweis); Session-/Rollen-Grenze ist separat real bewiesen (V1–V5).
- Rate-Limit-WIRKUNG (Sperre nach N Fehlversuchen) ist nicht als automatischer Drill verankert — Betriebs-Drill offen.
- Restore-DRILL offen (Rollback vorbereitet, nicht getestet) — Go-live-Gate.
- def_privs: extern blockiert (F0_PERMISSION_PACKET.md).
