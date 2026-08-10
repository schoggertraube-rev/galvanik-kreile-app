# F0_FINAL_REPORT — Austrittsmatrix F0-A01–A15 (Neufassung nach Befundbericht 2026-08-10)

**Stand:** 2026-08-10 · **Norm:** F0_CONTRACT_V1.md (extern bereitgestellt, s. Herkunftskopf dort)
**TECHNICAL_PROOF_COMMIT:** b6a4808424304338391abba43d2bd192e227b7ff · **Evidence-Payload:** PR #57 (Aufloesung: dessen Merge-Commit)
**Prod:** syhaigjhsbpjmtnggqka · Ledger 9/9, Digest 268ce6c1d87a7d020d68369eac20b2b4 · PRODUCTION_DEPLOYMENT_HEAD ae47f3de (dpl_7vwbgEJrPJhYHf9RcuLWswBr1EbT, READY)

Diese Neufassung ersetzt den Report vom 08.08. vollstaendig. Jeder Status nennt seinen Beweis; kein
Status stuetzt sich auf einen frueheren Selbst-PASS.

## Befund BF-001 — transparente Aufloesung (kein absolutes Urteil)
Audit 10.08. mass v_auftrag_db als "ohne Invoker-Option/false" (16/17). Direktmessung derselben View
am 10.08. VOR jeder Aenderung ergab reloptions = `security_invoker=on`. Belegkette fuer das
Erklaermodell "Schreibweisen-Artefakt (on vs true) in der Audit-Query": (a) apply_migration
f0_06 am 07.08. erfolgreich inkl. damaligem Live-Verify; (b) CI-Negativtest D prueft seit PR #54
exakt `'security_invoker=on'` und war durchgehend gruen; (c) o.g. Direktmessung. Eine alternative
zwischenzeitliche Drift ist nicht restlos ausschliessbar; sie waere durch dieselbe Massnahme geheilt.
**Massnahmen (beide unabhaengig vom Erklaermodell wirksam):** Schreibweise per Migration
20260810100000 auf einheitlich `true` normalisiert (Prod 17/17, live nachmessbar) und neue HARTE
Fingerprint-Komponente `viewopts` (PR #57) — jede kuenftige View-Options-Drift bricht CI (BF-002 geschlossen).

## Austrittsmatrix

| ID | Status | Beweis (aktuell, nachpruefbar) |
|---|---|---|
| A01 | PASS | Identitaet ueber HANDOFF-Felder ohne Selbstreferenz: TECHNICAL_PROOF_COMMIT + evidence_payload_ref(PR #57, merge-commit-Aufloesung) + RATIFICATION_REF extern (BF-003 geschlossen) |
| A02 | PASS | offene PRs = nur #57; Remote-Branch-Inventar mit Disposition in CURRENT_STATE (keine Pauschalbehauptung) |
| A03 | PASS | DOPPELTER Fresh-Replay im CI mit byte-identischem Gesamt-Digest 9dc1067b51c84ec0c92c83bf6c40b496d33873bb7f02f81e03eb9f7c7468fb17 |
| A04 | PASS | Ledger 9/9 = aktive Repo-Migrationen, Digest 268ce6c1…; Historie: 98→8 (08.08., PRE 55d2fb14/POST 693a36ce) + 9. Migration 10.08. (s. POSTFLIGHT-Nachtrag inkl. Governance-Anmerkung) |
| A05 | PASS_WITH_EXTERNAL_EXCEPTION | Paritaet jetzt 7 HART-Komponenten inkl. viewopts (CI: FINGERPRINT_PARITY=PASS); Ausnahme def_privs = BLOCKED_EXTERNAL_PERMISSION (Vertragsstatus; F0_PERMISSION_PACKET: 15/24 defacl, 42501-Evidenz, Kompensation, Ticket) |
| A06 | PASS | RELATIONSWEITE Grant-Denial-Pruefung (alle public-Tabellen+Views, CI) + Tenant-Fixture-Matrix ueber ALLE 8 tenant_isolation-Tabellen (E1–E4 inkl. Cross-Tenant-INSERT-Denial) + maschinenlesbare F0_TENANT_COVERAGE.json mit Live-Abgleich-Gate (BF-008 geschlossen) |
| A07 | PASS | 17/17 Views security_invoker live (einheitlich `true`) + hartes viewopts-Gate (BF-001/002 geschlossen) |
| A08 | PASS | ECHTE Storage-HTTP-Negativmatrix S1–S12 im CI gegen lokale Storage-API (eigenes Objekt/fremd/bucketuebergreifend/MIME/Groesse/Signed-URL expired+manipuliert+fremd/Cleanup) — alle PASS (BF-007 geschlossen) |
| A09 | PASS | 6/6 bcrypt (live) + pin_rate_limits + ECHTE Session-Kette V1–V5 (realer PIN-Login-POST→Cookie, verify mit/ohne/manipuliertem Cookie, Rollen-Denial readonly→Write=401). Restpunkt deklariert: Rate-Limit-WIRKUNGS-Drill (Brute-Force-Sperre) steht als Betriebs-Drill aus |
| A10 | PASS | CI: tsc, lint:full (eigener Step), Units, DB-Integration, V1–V5-HTTP, S1–S12, Doppel-Replay, Negativ-/Inventar-/Coverage-/doc-truth-Gates, Build, audit-Rohartefakt, diff-check. scan_order-Mock ist im Test deklariert; seine Beweisgrenze schliessen V1–V5 (BF-006 geschlossen) |
| A11 | PASS (minimal) | kanonische Clients + Boundary-Gate + Manifest-Schema — minimale Anschlussfaehigkeit, ausdruecklich keine fertige Modularchitektur |
| A12 | PASS (nach Behebung) | Kanonische Dateien in dieser Neufassung widerspruchsfrei neu geschrieben; erzwungen durch neues CI-Gate check-f0-doc-truth.mjs (BF-004/005 geschlossen) |
| A13 | SEPARATE_INSTANCE_REVIEW_PASSED · ORGANIZATIONAL_INDEPENDENCE=PENDING_EXTERNAL_RATIFIER | Reviews erfolgten durch getrennte Agent-Instanzen unter demselben GitHub-Account; organisatorische Unabhaengigkeit ist extern zu ratifizieren (BF-011 anerkannt) |
| A14 | PREPARED_NOT_DRILLED | Backup/Rueckfallweg dokumentiert, Vercel-Rollback-Kandidaten vorhanden; Restore-DRILL ausdruecklich noch nicht durchgefuehrt (BF-012 uebernommen) |
| A15 | PASS | Produkt-/Go-live-Themen strikt getrennt (CURRENT_STATE); kein F0-PASS stuetzt sich auf spaetere Gates |

## Schlussstatus
`FINAL_STATUS=PASS_WITH_DECLARED_EXTERNAL_EXCEPTION` · `OPEN_INTERNAL_BLOCKERS=0` ·
`OPEN_EXTERNAL_BLOCKERS=1 (def_privs supabase_admin)` · `RATIFICATION_STATUS=PENDING_EXTERNAL` ·
`ZIP_READINESS=RECOMMEND_GREEN_AFTER_EXTERNAL_RATIFICATION`

Betreiberpflichten vor Go-live (nicht F0): DB-Passwort-Rotation; Leaked-Password-Protection
AKTIVIEREN (Pflicht, nicht optional); Restore-Drill (Gate G); def_privs-Ticket (Vorlage im Packet).
