# Hardening 2026-07-14 – Lieferwahrheit

Stand: 2026-07-27, Branch `codex/foundation-security-remediation-20260715`, Basis `6e1d1831be823b7655130f0f46ba964d45c4b8dc` (`origin/main`).

Dieses Dokument beschreibt die lokal implementierte und geprüfte Remediation. Es behauptet weder einen Merge noch einen Production-Deploy, eine Remote-Migration, eine Remote-RLS-Änderung oder eine reale Providerfreigabe.

## Ergebnis

Das lokale Fundament ist für den Draft-PR abnahmefähig:

- alle 24 Findings des versiegelten Codex-Security-Scans sind im Code geschlossen oder bei migrations-/providerabhängigen Teilen klar als Remote-Rollout-Grenze ausgewiesen;
- Tenant-, Rollen- und Objektgrenzen laufen über serverseitige Autorisierung; Admin-Benutzerverwaltung ist tenant-scoped, receipt-geprüft und schützt Entwicklerkonten vor Admin-Eskalation;
- Buchhaltung, Analyse, Marketing, Capture, Kommunikation und Warendurchlauf verwenden echte Serverdaten oder einen ausdrücklich sichtbaren Zustand `nicht konfiguriert`, `nicht verfügbar`, `Review erforderlich` oder reale Nullmenge;
- produktive Demo-Fallbacks, erfundene Trends, Null-Erfolgsmethoden und „gespeichert“-Meldungen ohne durable Wirkung wurden aus den geprüften Kernpfaden entfernt beziehungsweise ehrlich deaktiviert;
- der Betreiberkanal ist signiert, versioniert, auditiert und transparent. Er kennt `active`, `grace`, `suspended` und `maintenance`, aber keine versteckte Drosselung oder Ferncodeausführung;
- Nutzungsanalyse ist datenminimiert und aggregierbar. Freitext, geheime Payloads, Signaturen und Inhaltsdaten werden nicht als Telemetrie gespeichert;
- die öffentliche Feedback-Token-Seite ist bis zu einem sicheren, persistenten Single-use-Vertrag ehrlich deaktiviert und behauptet keine Speicherung oder Übermittlung.

Der additive Remote-Datenbank-Rollout ist seit 2026-07-26 ausdrücklich freigegeben, in diesem vor dem Cutover erstellten Lieferstand aber noch nicht als ausgeführt behauptet.

## Abschlussnachweise

| Gate | Ergebnis | Nachweis |
|---|---|---|
| Vollständige Unit-Tests | PASS | 142/142 Testdateien und 639/639 Tests PASS; Integrationsprüfungen bleiben separat gegated |
| TypeScript | PASS | `npx tsc --noEmit`, Exit 0 |
| Produktionsbuild | PASS | Next.js 16.2.12 mit Webpack; Compile und TypeScript PASS; 86/86 statische Seiten generiert |
| Lint-Ratchet | PASS | 107 historische Errors und 144 Warnungen als per-file/rule/severity Ceiling erfasst; frischer Ratchet-Lauf Exit 0 |
| Vollständiges ESLint | Bestandslast sichtbar | Repository ist nicht lint-clean. Der Ratchet verbietet jede neue oder erhöhte Verletzung und erlaubt nur Reduktion. |
| Dependency-Audit | PASS für den Produktionsbaum | installierter Produktionsbaum: `npm audit --omit=dev --audit-level=high`, Exit 0, 0 Vulnerabilities |
| Verbleibender Audit-Rest | dev-only, nicht verschwiegen | 9 High-Hinweise betreffen `brace-expansion@1.1.16` im ESLint-/`minimatch@3`-Pfad; die gepatchte 5.x-API ist dort inkompatibel. 4 Moderate-Hinweise betreffen esbuild via `drizzle-kit`. Beide Pfade werden nicht in die App-Runtime ausgeliefert. |
| Diff-Hygiene | PASS | `git diff --check`, Exit 0 |
| Unabhängiger Review | PASS | kein offenes P0/P1; Rollen-, Concurrency-, Wahrheitszustands- und Dependency-Addenda behoben oder explizit begrenzt und revalidiert |

Die drei Integrationsprüfungen in zwei Dateien benötigen eine ausdrücklich konfigurierte Integrationsdatenbank und werden im Unit-Gate bewusst nicht als ausgeführt dargestellt. Zusätzlich wurden die migrationskritischen Verträge während der Mission in isolierten lokalen PostgreSQL-Datenbanken funktional geprüft, unter anderem Payment/Quote, AI-Ledger, Item-Photo-Jobs, Finance-/Marketing-Grenzen, Mail-Ledger, Telemetrie, Periodenabschluss, Developer-Feedback, operative Events, Capture-Integrität und Operator-Control.

## Fundamentbereiche

### Authentifizierung, Tenant und Berechtigungen

- Sessions sind HMAC-signiert, ablaufend, tenant-gebunden und gegen den aktuellen `app_users`-Datensatz geprüft. Deaktivierung, Löschung und Rollenwechsel widerrufen die Sitzung.
- Session-Secrets müssen mindestens 32 UTF-8-Byte besitzen; zu kurze Werte schlagen auch bei direkten Signier-/Verifikationsaufrufen geschlossen fehl.
- PINs werden ausschließlich als bcrypt cost 12 verarbeitet. Durable Rate-Limits und atomare Fehlversuchszähler liegen vor dem teuren Hash-Vergleich.
- Start-Payloads enthalten keine Klartext-PIN und keine vollständigen Identitätsdaten; der PIN-Selector ist kurzlebig und AES-GCM-geschützt.
- Admin-Reads und -Mutationen auf `app_users` erzwingen `tenant_id`, Zielrolle und genau einen Mutation-Receipt. Normale Admins dürfen Entwicklerkonten weder erzeugen noch ändern oder deaktivieren.
- `bypass-auth` existiert nur dreifach development-gated; produktive Cookie-Präsenz allein autorisiert nichts.

### Vernetzung und operative Wahrheit

- Aktive Repositories delegieren an echte serverseitige Actions und übersetzen Provider-/DB-Fehler nicht in leere Erfolgsergebnisse.
- Browserseitige Supabase-Datenzugriffe wurden aus dem aktiven App-Pfad entfernt; Client-Refresh ist providerneutral und lädt Wahrheit erneut über den Server.
- Auftrag, Kunde, Teile, Statusereignisse, Zeit, Material, Bestand, Dokumente, Kommunikation und Finanzbezug sind tenant- und objektgebunden.
- Capture schreibt Zeit und Material idempotent, prüft den Auftrag, erzeugt Receipts und aktualisiert Bestand atomar. Offline-/Retry-Wahrheit nutzt Client-IDs und sichtbare Zustände.
- Der Warendurchlauf berechnet Sieben-Tage-Trends nur aus geladenen Aufträgen. Eine Nullreihe bleibt Null; Laden und Nichtverfügbarkeit werden getrennt angezeigt.

### Buchhaltung

- Finance-Actions prüfen `perm_view_prices` vor DB-, Body-, Storage- oder Providerzugriff.
- Beleg-OCR nutzt private serverseitige Speicherung, begrenzte Formate/Größen, Signed URLs, Confidence in Prozent und einen sichtbaren Review-Zustand.
- BWA, offene Posten, Kosten, Einsparungen, Zahlungen und Export liefern echte Daten oder einen expliziten Fehler. Der nominelle Supabase-Provider enthält keine produktiven `[]`-/`null`-Erfolgsmethoden mehr.
- Periodenabschluss ist transaktional, idempotent, auditierbar und schützt finale Perioden gegen spätere Änderungen.
- Rechnungsnummern und Payment-Finalisierung sind eindeutig beziehungsweise idempotent; Quote, Betrag, Währung, Auftrag, Tenant und Providerstatus werden serverseitig gebunden.

### Analyse

- Kennzahlen werden deterministisch aus tenant-scoped App-Daten berechnet. Datenabdeckung und Lücken sind Bestandteil des Ergebnisses.
- KI formuliert nur auf begrenzten, validierten Inputs und darf fehlende Datengrundlage nicht als belastbare Erkenntnis ausgeben.
- `/cockpit` behauptet kein zweites Fake-Cockpit, sondern führt zum echten Performance-Pfad.

### Marketing

- Aktionen, Segmente, Einwilligungen, Kanäle, Touchpoints und Attribution laufen über serverseitige Auth-/Tenant-Grenzen.
- Instagram verwendet einen serverseitigen Token-Vault, OAuth-State, begrenzte Provider-Requests, durable Publish-Jobs, externe IDs und `uncertain`/Review statt falschem Erfolg.
- Reichweite und Kampagnenerfolg werden nicht simuliert. Nicht konfigurierte Provider werden als solche angezeigt.
- E-Mail-Versand schreibt ein idempotentes Delivery-Ledger; Provider-Erfolg ohne lokale Persistenz wird nicht als sicherer Erfolg dargestellt.

### KI, OCR und kostenpflichtige Provider

- Jede kostenpflichtige AI-/Vision-Delegation reserviert vor dem Provideraufruf atomar Nutzer-/Tenant-Quota und bindet Claim/Settlement an Tenant, Nutzer, Feature und Request-Digest.
- Readonly-Nutzer können keine kostenpflichtige oder mutierende Delegation auslösen.
- Inputs, Outputs, Timeouts und Antwortschemata sind begrenzt; Parserfehler, Quota-Ausfall und fehlende DB-Wahrheit schlagen geschlossen fehl.
- Mollie-Create verwendet DB-Quote statt Clientbetrag. Der Webhook akzeptiert nur vorregistrierte Payment-ID plus versuchsgebundenes Callback-Token, lädt danach den Live-Providerstatus und finalisiert monoton/idempotent.

### Betreiberzugang und Entwickleranalyse

- Operator-Policies werden als striktes kanonisches JSON mit Ed25519 geprüft, per Tenant/versioniertem Advisory-Lock serialisiert und vor dem Current-State-Update append-only auditiert.
- Der Ingress benötigt ein mindestens 32-stelliges Bearer-Secret, durable Rate-Limits, Content-Type- und Byte-Limits. Chunked Bodies werden während des Stream-Lesens abgebrochen, nicht erst nach vollständigem Puffern.
- Ungültige, abgelaufene, geplante oder nicht verifizierbare Policies sperren den Kunden nicht. Ein bestätigter Entwickler bleibt für Diagnose und Wiederherstellung erreichbar.
- Sperre/Wartung wird sichtbar erklärt. Verstecktes Verlangsamen, verdeckte Überwachung und Remote-Code existieren nicht.
- Entwickleranalysen aggregieren Ereignistyp, Route, Dauer, Ergebniszahl, Klick-/Schrittanzahl und technische Fehlerklasse. Freitextsuche, fachliche Inhalte, Signaturen, Tokens und vollständige Payloads werden nicht gespeichert.

## Codex-Security-Remediation-Ledger (24/24)

`LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED` bedeutet: Code und lokaler Vertrag sind geprüft; die Wirkung auf Live-Daten beginnt erst nach freigegebener Migration, Secret-Konfiguration und Deployment.

| # | Finding | Status | Lokale Schließung / Remote-Grenze |
|---|---|---|---|
| 1 | `pin-online-bruteforce` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | bcrypt, atomarer Counter, HMAC-Subjekt; Migrationen 002/001 remote unapplied |
| 2 | `ocr-finance-authorization-bypass` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | Finance-Guard vor Body, privater Bucketpfad, Signed URL, fail-closed OCR; Storage-Migration remote unapplied |
| 3 | `finance-open-items-action-authorization` | PASS | Finance-Guard und Tenant-Prädikate vor beiden Queries |
| 4 | `finance-bwa-action-authorization` | PASS | Finance-Guard, tenant-scoped Rechnungen |
| 5 | `finance-expense-action-authorization` | PASS | Finance-Guard vor Beleg-/Fixkostenabfragen |
| 6 | `finance-savings-action-authorization` | PASS | Finance-Guard; ungenutzter unsicherer Read entfernt |
| 7 | `finance-category-action-authorization` | PASS | Finance-Guard vor Aggregation |
| 8 | `mollie-create-authorization` | PASS | Permission und Fixed-Tenant vor JSON, DB und Provider |
| 9 | `mollie-stale-amount-reuse` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | Quote-Digest/Lock, nur passende offene Attempts, Storno-/Review-Vertrag; Migration/Deploy fehlen live |
| 10 | `mollie-terminal-state-lock` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | monotone service-role-only RPCs; Remote-Migration/Deploy fehlen |
| 11 | `mollie-webhook-provider-amplification` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | lokale Admission vor Provider-I/O, Body-/ID-Limits, Callback-Hash; Secret/Migration/Deploy fehlen live |
| 12 | `ai-customer-enrich-unmetered` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | Reserve/Claim/Settle, Nutzer-/Tenant-Quota, Grenzen/Timeout; Ledger/Secret/Deploy fehlen live |
| 13 | `ai-freetext-unmetered` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | gleicher durable Quota- und Replay-Vertrag; Remote-Rollout fehlt |
| 14 | `ai-inquiry-unmetered` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | begrenzter Input und durable Quota vor Delegation; Remote-Rollout fehlt |
| 15 | `ai-notes-unmetered` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | identity-bound Claim und begrenzter Input; Remote-Rollout fehlt |
| 16 | `kpi-insight-unmetered` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | gemeinsames Ledger, feste KPI-Allowlist, Input-/Output-/Timeout-Limits; Remote-Rollout fehlt |
| 17 | `item-photo-permission-bypass` | PASS | `perm_op_photos`, Tenant und Item-Ownership vor Multipart/Storage/Provider |
| 18 | `item-photo-unmetered` | LOCAL_PASS / REMOTE_ROLLOUT_REQUIRED | Quota vor Storage, Deduplizierung, durable Job-ID, Einmal-Claim; Migration/Secret/Deploy fehlen live |
| 19 | `scan-upload-permission-bypass` | PASS | `perm_data_orders` vor Multipart und allen Sinks |
| 20 | `session-revocation-gap` | PASS | aktueller aktiver DB-User, Tenant und Rollenabgleich im Proxy/Resolver |
| 21 | `ai-customer-enrich-readonly` | PASS | `perm_data_customers` vor JSON, Quota und Provider |
| 22 | `ai-freetext-readonly` | PASS | `perm_data_orders` vor JSON, Quota und Provider |
| 23 | `ai-inquiry-readonly` | PASS | `perm_data_orders` vor JSON, Quota und Provider |
| 24 | `ai-notes-readonly` | PASS | `perm_data_orders` vor JSON, Quota und Provider |

## Vorbereitete, nicht angewendete Migrationen

Alle folgenden Dateien sind absichtlich `prepared_unapplied`. Keine davon wurde remote ausgeführt:

1. `20260714000050_operational_events_payment_prerequisite_prepared_unapplied.sql`
2. `20260714000100_payment_idempotency_prepared_unapplied.sql`
3. `20260714000200_pin_bcrypt_prepared_unapplied.sql`
4. `20260713000100_security_rate_limit_index.sql`
5. `20260715000200_buchhaltung_receipt_storage_prepared_unapplied.sql`
6. `20260713000200_ai_usage_ledger.sql`
7. `20260713000300_item_photo_jobs.sql`
8. `20260715000500_finance_server_boundary_prepared_unapplied.sql`
9. `20260715000550_marketing_source_contract_prepared_unapplied.sql`
10. `20260715000575_marketing_tenant_relationships_prepared_unapplied.sql`
11. `20260715000600_marketing_server_boundary_prepared_unapplied.sql`
12. `20260715000700_marketing_connector_prepared_unapplied.sql`
13. `20260715000800_email_delivery_ledger_prepared_unapplied.sql`
14. `20260713000400_usage_telemetry.sql`
15. `20260715001000_period_close_prepared_unapplied.sql`
16. `20260713000500_developer_feedback.sql`
17. `20260715001150_operational_events_source_prepared_unapplied.sql`
18. `20260715001200_operational_events_prepared_unapplied.sql`
19. `20260715001300_operational_server_boundary_prepared_unapplied.sql`
20. `20260713000600_ocr_confidence_scale_expand.sql`
21. `20260713000700_invoice_number_uniqueness.sql`
22. `20260715001550_inventory_contract_reconciliation_prepared_unapplied.sql`
23. `20260715001600_capture_integrity_prepared_unapplied.sql`
24. `20260715001620_operational_source_contracts_prepared_unapplied.sql`
25. `20260715001625_operational_core_boundary_prepared_unapplied.sql`
26. `20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql`
27. `20260715001660_analytics_truth_contracts_prepared_unapplied.sql`
28. `20260715001670_finance_truth_contracts_prepared_unapplied.sql`
29. `20260713000800_operator_control_plane.sql`
30. `20260716000100_station_completion_receipt_prepared_unapplied.sql`
31. `20260716000200_calendar_price_boundary_prepared_unapplied.sql`
32. `20260720000100_scan_original_receipt_prepared_unapplied.sql`
33. `20260720000200_phase2_public_rls_remediation_prepared_unapplied.sql`

## Echte externe Restgrenzen

- Remote-RLS ist in der beobachteten Supabase-Umgebung für 26 Tabellen deaktiviert beziehungsweise zu breit. Änderung nur nach ausdrücklicher Freigabe und mit Backup/Rollback.
- Sämtliche obigen Migrationen benötigen eine eigene Rollout-Mission, Vorprüfung auf Bestandskonflikte, Backup, least-privileged Runtime-Role und Post-Deploy-Integrationstest.
- Edge Functions, Payment, OCR, AI, Mail, Instagram und Operator-Control benötigen reale Secrets, Providerkonfiguration und verifizierte Deployments.
- Der Operator-Channel benötigt `OPERATOR_CONTROL_PUBLIC_KEY_PEM`, ein hochentropisches `OPERATOR_CONTROL_INGEST_SECRET` und eine Runtime-DB-Rolle, die Audit-Events weder ändern noch löschen darf.
- Der verbleibende moderate Next/PostCSS-Auditfund wird erst durch einen kompatiblen Next-Patch oder eine upstream bestätigte Auflösung geschlossen; kein Force-Downgrade.
- Draft-PR und Vercel Preview sind Liefergates dieser Mission; main, Production und Remote-Daten bleiben unangetastet.
