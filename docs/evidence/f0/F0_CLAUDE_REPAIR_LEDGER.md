# F0/W4 Claude-Reparaturledger

Stand vor der ersten Codeänderung: Paketcommit
`83123a4316c76377de1f4da3432a50926907479d`, sauberer Missionsworktree;
geschützter Checkout `02_app` unverändert. Dieses Ledger erweitert weder F1
noch Remote-/Production-Autorität.

| Claude-ID | Einordnung / Kriterium | Echte Ursache | Vorhandener Vertrag und kleinste Reparatur | Kleinste Dateimenge / Konsumenten | Erforderlicher positiver und negativer Nachweis | Status |
|---|---|---|---|---|---|---|
| `CLAUDE-F0-001` | P1-Akzeptanzblocker; `G-01/G-03/G-04/P10` | Kandidat ist lokal, ohne Draft-PR/CI/Preview. | Delivery-Vertrag der Mission; keine Codeänderung. Push/PR/Preview bleiben ohne neue Freigabe gesperrt. | Keine Produktionsdatei; finales Prüfpaket dokumentiert `NOT_RUN/BLOCKED_EXTERNAL_PERMISSION`. | Exakter PR-Head, grüne CI und Preview desselben SHA erst nach ausdrücklicher Freigabe; bis dahin null Push/Deploy/Promotion. | `BLOCKED_EXTERNAL_PERMISSION` |
| `CLAUDE-F0-002` | P1-Akzeptanzblocker; `W4-02` | Der Stationsbeleg hält nur Original-Preservation, keine kanonische Extraktions-/Konfidenzmetadaten-Wahrheit; Evidenzname war nicht missionsnummerntreu. | Bestehende immutable Evidence plus versionierter Read-Port: additive, append-only Extraktionsmetadaten; explizit ehrlicher Zustand `NOT_REQUESTED` für das Stationsoriginal und normalisierte vorhandene Legacy-Scan-Metadaten, ohne Originalersatz. | Neue additive Migration; `orderStationAttachment.ts`; kanonischer `evidenceRead.ts`; Warendurchlauf-Action; Attachment-Panel; direkte Unit-/RTL-/lokale Integrationstests; W4-Evidenz. | Realer DB→View→Action→UI→Reload-Beleg für Original plus Extraktionszustand/Confidence; invalid/out-of-range/wrong-tenant/provider-drift führt zu null Read-Erfolg und null Mutation. | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-003` | verbindlicher Akzeptanzblocker; `W4-03` (Claude: P2) | Evidence ist nur über feste Order-/Item-Felder gebunden; kein gespeicherter Typdiskriminator plus Ziel-ID. | Bestehende Evidence-ID bleibt kanonisch; additive immutable Linktabelle mit `target_type`/`target_id`, versionierter View und exakt validiertem Server-DTO. Beim Finalize entstehen `ORDER`- und `ORDER_ITEM`-Links in derselben Transaktion. | Dieselbe Migration; `orderStationAttachment.ts`; `evidenceRead.ts`; Action/Panel; Unit-/RTL-/Integrationstests. | Mindestens zwei Zielobjekttypen real gespeichert und nach Reload gelesen; unbekannter Typ, fremder Tenant, falsche ID oder Linkdrift ergeben null Erfolg/null Folgeschreibvorgang. | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-004` | verbindlicher Akzeptanzblocker; `W4-04` (Claude: P2) | Quarantäne ist kein lesender Legacy-Adapter. Vorhandene `public.scan_uploads` besitzen bereits Original-, Extraktions-, Confidence- und Linkwahrheit. | Neuer kanonischer Read-Port liest ausschließlich eine `security_invoker`-View über `scan_uploads`; keine Legacy-Tabelle, kein Objekt und kein Status wird verändert. Keine Reaktivierung des quarantänisierten Upload-/Providerpfads. | Additive View in derselben Migration; `evidenceRead.ts`; serverseitige Action; Unit-/lokaler Integrationstest; W4-Evidenz. | Gesicherten Legacy-Scan mit Original/Extraktion/Confidence/Link real lesen und exakt normalisieren; Vor-/Nach-Snapshot bytegleich. Unsicherer, tenantfremder oder unvollständiger Legacy-Datensatz liefert fail-closed und null Mutation. | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-005` | verbindlicher Akzeptanzblocker; `W4-08` (Claude: P2) | Für W4-Quellen fehlt ein reproduzierbares vollständiges Leser-/Bypass-Inventar. | Versionierte `private.v_*_v1` bleiben einzige Cross-Modul-Read-Ports. Ein dependency-freier Checker inventarisiert repo-weit alle W4-Basistabellen-/View-Leser und erlaubt direkte Basistabellenzugriffe nur in deklarierten Command-/Port-Interna, nie in Konsumenten. | `scripts/quality/check-w4-cross-module-read-ports.mjs`; maschinenlesbares Inventar unter `docs/evidence/f0`; Workflow; alle gemeldeten Konsumenten werden im selben Atom geprüft. | Checker PASS am finalen SHA; Selbsttests für neuen Bypass, unbekannten Leser, unversionierte View und fehlenden Konsumenten müssen fail-closed sein. | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-006` | verbindlicher Akzeptanzblocker; `W4-09` (Claude: P2) | Die bestehende Negativmatrix deckt die fehlenden W4-02/03/04/08-Verträge naturgemäß nicht ab. | Bestehende W4-Integration wird um genau diese Verträge ergänzt; kein separates Mock-Erfolgssystem. | W4-Unit-/Action-/RTL-Tests; reale lokale W4-Integration; Read-Port-Checker; Workflow/Evidenz. | Private ACL, Legacy-Read-only, Extraction-Validation, Link-Polymorphie, append-only, Korrelation/Idempotenz und View-Exklusivität positiv/negativ; jeweils Null-Side-Effect-Snapshot. | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-007` | Capability-/Abnahmeblocker; `G-01/P1-P9` | Claudes Linux-VM hatte falsche Toolchain; der autorisierte Windows-Worktree hat Node `24.18.0`, Docker und die bereits belegte lokale CLI-/PG17-Kette. | Kein Produktfix. Nach Codeabschluss P1-P9 seriell in der kanonischen lokalen Umgebung frisch ausführen. | Nur finale Receipts/Evidenz. | Frische Exitcodes und Artefakt-SHAs am finalen SHA; keine Remoteverbindung. | `PASS_LOCAL` |
| `CLAUDE-F0-008` | formaler Akzeptanzblocker; Missionsscope (Claude: P2) | Drei bestehende W2C-Sicherheits-/Testpfade sind notwendig, aber nicht wörtlich allowlisted. Rücknahme würde bereits belegte Fail-closed-Gates schwächen. | Missions-Allowlist eng um exakt `scripts/fetch_and_classify_orders.ts`, `scripts/test_order_source.ts` und `vitest.config.ts` ergänzen; keine Glob-Erweiterung. | Missionsdatei; T0/YAML-/Paketchecker und finales Scope-Inventar als Konsumenten. | Exakter Scope-Checker: keine weiteren Ausnahmen; die beiden Scripts bleiben fail-closed, Vitest-Alias bleibt test-only; Produktionspfad unverändert. | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-009` | Capability-/Paketgate | Claudes SMB-/Linux-Git-Brücke lief in Timeout; derselbe Checker war im nativen Worktree bereits grün. | Kein Produktfix. Finalen Paketchecker nach Commit nativ ausführen. | Prüfpaket und finale Receipts. | `--selftest` und `--check` Exit 0 am finalen sauberen SHA. | `CLOSED_PASS_LOCAL` |

## Reparaturgrenze

- Einziger Writer: dieser Hauptchat im bestehenden F0-Worktree.
- Kein F1, Push, PR, Preview, Remote-/Productionzugriff oder Merge ohne neue
  Freigabe.
- Keine angewandte Migration wird umgeschrieben; Schemaarbeit ist rein additiv.
- P2-/Stilideen außerhalb der oben als verbindliche Missionsblocker markierten
  Kriterien werden nicht umgesetzt.

## Ausgeführter Abschlussstand

- W4-02/03/04/08/09: `PASS_LOCAL` mit additiver 13. Migration,
  versionierten privaten Views, realem Legacy-Read-only-Adapter,
  polymorphen Links, Extraktionsmetadaten und globalem Read-Port-Checker.
- Fokussiert: 4 Dateien / 103 Tests; lokal E2E: 1 Datei / 14 Tests;
  vollständig: 87 Dateien / 551 Tests. Reine Customer-/Invoice-Ziele sind
  über den autorisierten Target-Read ohne künstlichen Order-Link erreichbar.
- Frischer PG17-Reset: 13 Migrationen; exakter 9→13-Vertrag:
  312 ADD, 0 CHANGE, 0 REMOVE; zweiter Katalog/Fingerprint/Ledger byteidentisch.
- TypeScript, vollständiges ESLint und Produktionsbuild: PASS.
- Missions-Allowlist enthält ausschließlich die drei belegten engen
  W2C-Ausnahmen; keine Glob-Erweiterung.
- Nativer Paketchecker: 12 adversariale Selftests und committed `--check`
  einschließlich exakt eines Paketcommits auf dem Kandidaten: `PASS`.
- Claude-F0-001 bleibt der einzige externe Delivery-Blocker. Kein Push,
  Draft-PR, Preview, CI oder Remote-/Productionzugriff wurde ausgeführt.
