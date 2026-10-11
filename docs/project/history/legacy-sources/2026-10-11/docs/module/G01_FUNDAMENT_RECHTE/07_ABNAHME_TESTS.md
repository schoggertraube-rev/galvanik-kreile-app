<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Abnahme und Tests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-G01-001 | A-G01-001, A-G01-005, A-G01-019 | Given produktionsnah konfigurierte Profile, when `/start` und Header geöffnet werden, then sind nur Rolf, Phillip und Gregor sichtbar und technische Rollen/Actor-IDs fehlen. | E2E | bestehende `start-page-payload.test.tsx`, `productActorAuthorization.test.ts`; Ziel-Browsermatrix |
| T-G01-002 | A-G01-002 | Given Rolf/Phillip, when vier Ziffern per Touch, Zahlenreihe oder Numpad eingegeben werden, then erfolgt genau ein Submit ohne Enter und Backspace löscht eine Stelle. | E2E/Owner-UX | bestehender Path-1-Login-E2E; V5 SHA `75258FF3BD4C` |
| T-G01-003 | A-G01-002, A-G01-009 | Given Browser/Logs/DTOs, when PIN-Login positiv und negativ läuft, then erscheinen weder PIN noch Hash noch Actor-ID außerhalb des Servers. | Smoke/E2E | `loginWithPin.test.ts`, `start-page-payload.test.tsx`; neuer Payload-/Log-Negativtest |
| T-G01-004 | A-G01-003, A-G01-038 | Given beliebige Supabase-Auth-Nutzer, when E-Mail-Login erfolgt, then erhält nur der exakt gebundene Gregor-Actor eine App-Sitzung und kein Credential wird gelesen/gespeichert. | E2E | `loginEmailProductActor.test.ts`; neuer negativer Fremduserfall |
| T-G01-005 | A-G01-004 | Given fehlende, partielle, doppelte, tenantfremde, inaktive und rollenfalsche Actor-Profile, when Readiness läuft, then endet jeder Fall mit dem erwarteten fail-closed Code. | Smoke | `productActorReadiness.test.ts` / `productActorAuthorization.test.ts` |
| T-G01-006 | A-G01-006 | Given gültiger, manipulierter, abgelaufener und tenantfremder Cookie, when der Resolver liest, then besteht nur der gültige Fall. | Smoke | `appSession.test.ts` |
| T-G01-007 | A-G01-007, A-G01-024 | Given eine vor der Profil-/Rechteänderung ausgestellte Sitzung, when `updated_at` steigt, then wird der nächste Zugriff als `SESSION_REVOKED` geschlossen. | Smoke/E2E | `authorization.test.ts`; neuer Rechteänderungs-E2E |
| T-G01-008 | A-G01-008 | Given Supabase-Signout wirft einen Fehler, when Logout läuft, then ist der App-Cookie trotzdem gelöscht. | Smoke | Test für `auth.ts#logout` |
| T-G01-009 | A-G01-009 | Given neue und rotierte PIN, when DB-Readback erfolgt, then beginnt der gespeicherte Wert mit bcrypt-Format und cost 12; Klartextvergleich schlägt fehl. | Smoke | `admin-pin-security.test.ts`, `loginWithPin.test.ts` |
| T-G01-010 | A-G01-010 | Given parallele Fehlversuche, when Schwellen 5, 10 und 20 erreicht werden, then greifen 15 Minuten, 60 Minuten und dauerhaft ohne Race. | Smoke/Integration | `pinRateLimit.test.ts`; DB-Paralleltest |
| T-G01-011 | A-G01-011 | Given identische User-/Event-IDs in zwei Tenants, when Rechte gelesen/geändert werden, then ist der Fremdtenant unsichtbar und unverändert. | E2E | neuer `fundament_permission_tenant.integration.test.ts` |
| T-G01-012 | A-G01-012 | Given Rolf, Phillip oder Gregor ohne Permission-Events, when Effective Permissions gelesen werden, then sind exakt alle 13 katalogisierten Keys `true`. | Smoke/Integration | neuer Resolver-/View-Test |
| T-G01-013 | A-G01-013, A-G01-015 | Given Standard `ALLOW`, when `DENY`, danach `ALLOW`, danach `RESET` geschrieben werden, then lauten die Readbacks `false`, `true`, `true` und alle Events bleiben erhalten. | Integration | neuer Permission-Ledger-Test |
| T-G01-014 | A-G01-014 | Given identische Personenereignisse und verschiedene technische Rollen, when Rechte aufgelöst werden, then sind die Effective Permissions identisch. | Smoke | neuer `authorizationPermissions.test.ts` |
| T-G01-015 | A-G01-016 | Given UI-Manipulation oder direkter Serverrequest mit `DENY`, when ein geschützter Read/Command läuft, then erfolgt kein DB-/Providerzugriff. | E2E | Negativtests je Permission-Zuordnung; Spy beweist zero downstream call |
| T-G01-016 | A-G01-017 | Given unbekannter PermissionKey oder unvollständige Viewzeile, when Resolver/Command läuft, then wird kein Recht erweitert und eine Korrelation entsteht. | Smoke | Katalog-/Readmodel-Failure-Injection |
| T-G01-017 | A-G01-018 | Given Rolf/Phillip mit allen 13 Keys und Gregor als AdminAuthority, when Rechte- oder Approval-Command aufgerufen wird, then scheitern Rolf/Phillip und Gregor besteht. | E2E | neuer AdminAuthority-Negativ-/Positivtest |
| T-G01-018 | A-G01-019 | Given weitere historische `app_users`, when Admin-Personenliste gelesen wird, then enthält sie ausschließlich die drei konfigurierten Produktprofile und keine Anlageaktion. | E2E/Owner-UX | Personenlisten-Test mit synthetischem vierten App-User |
| T-G01-019 | A-G01-020 | Given eine Sitzung, when Bootstrap und Refresh laufen, then stammen Produktname, technische Rolle und Permissions jeweils atomar aus einem Snapshot. | Smoke | `PermissionsContext.test.tsx`, `authBootstrap.test.ts` angepasst |
| T-G01-020 | A-G01-021 | Given derselbe `clientEventId`, when Rechteänderung zweimal gesendet wird, then existiert genau ein Event und beide Antworten referenzieren denselben Beleg. | Integration | neuer Idempotenztest |
| T-G01-021 | A-G01-021 | Given zwei Gregor-Sitzungen mit derselben `expectedVersion`, when beide unterschiedliche Änderungen senden, then schreibt genau eine und die andere erhält `CONFLICT`. | Integration/E2E | Paralleltest mit Fresh-Replay |
| T-G01-022 | A-G01-022 | Given erfolgreicher Permission-Command, when Receipt und Readback geprüft und die Seite neu geladen werden, then stimmen Event-ID, Version und effektive Rechte überein. | E2E | Browser-E2E auf Fresh-Replay, SHA-gebundenes Receipt |
| T-G01-023 | A-G01-023 | Given ein Rechteevent, when Audit gelesen wird, then sind Pflichtfelder vollständig und PIN/Passwort/Sessiontoken fehlen. | Smoke/Integration | Schema-/Redaction-Test |
| T-G01-024 | A-G01-023 | Given vorhandene Security-Events, when UPDATE, DELETE oder TRUNCATE versucht werden, then weist die DB alle Versuche ab. | Integration | Fresh-Replay-Trigger-Negativmatrix |
| T-G01-025 | A-G01-025, A-G01-026, A-G01-027 | Given Ziel-Adminscreen, when Person/Recht geändert wird, then arbeitet er gegen Personenports; `RoleMatrix`, `ROLE_PERMISSIONS` und `feature_flags.roles_allowed` werden nicht als Mutation/Autorisierung genutzt. | Smoke/E2E/Owner-UX | Source-Gate plus Browser-E2E; Designphase-1b-Referenz |
| T-G01-026 | A-G01-024, A-G01-037 | Given aktive Rolf-/Phillip-Sitzung, when Gregor Status ändert oder PIN rotiert, then ist die alte Sitzung ungültig und die alte PIN funktioniert nicht. | E2E | Fresh-Replay-Login-/Widerrufskette |
| T-G01-027 | A-G01-029 | Given DB-Ausfall, Timeout und unklarer Response nach Commit, when UI reagiert, then zeigt sie sichere Datenlage/Korrelation und führt zuerst Readback statt Retry aus. | E2E | D-RES-001 Failure-Injection |
| T-G01-028 | A-G01-030, A-G01-031 | Given Login-/Adminscreens, when alle sieben Zustände in 1914×917, 1220×880 und 390×844 gerendert werden, then sind Wortlaut, Fokus, Touchziele und Inhalt vollständig. | Owner-UX | Designphase-1b-Matrix und Preview-Screenshots |
| T-G01-029 | A-G01-028, A-G01-035 | Given Modul-Gates, when Fundament mit zweitem synthetischen Host geprüft wird, then bestehen Manifest/Fassade/Tenant-Injektion ohne Kreile-Literal oder Tiefimport. | Smoke | `npm run quality:module-gates`; `s1_module_gates.test.ts` |
| T-G01-030 | A-G01-032 | Given DB, Supabase Auth oder Konfiguration fehlt, when Produktzugang versucht wird, then erscheint kein Mock-/Fallback-Erfolg. | E2E | No-Fake-Gate plus Auth-Failure-E2E |
| T-G01-031 | A-G01-033 | Given Lösch-/Anonymisierungsproposal, when ein Fachcommand ohne, mit fremdem oder mit passendem Approval-Receipt läuft, then schreiben nur passende Tenant/Ziel/Aktion/Version. | Integration | neuer Approval-Port-/Fachadapter-Kontrakttest |
| T-G01-032 | A-G01-034 | Given abgelaufene Aufbewahrungsfrist ohne Adminentscheidung, when Hintergrundlauf erfolgt, then bleiben personenbezogene Daten unverändert und nur ein Vorschlag besteht. | E2E | Fachmodul-Contract-Test gegen Fundament-Approval-Port |
| T-G01-033 | A-G01-036 | Given vollständige Positiv-/Negativmatrix, when Fresh-Replay und Browser-E2E laufen, then sind alle Fixtures synthetisch und alle Tenant-/Auth-/Auditfälle grün. | E2E | CI-Artefakt am Exact SHA, unabhängiger Reviewer |

## Gate-Reihenfolge

1. Migrationen lokal per Fresh-Replay, einschließlich Unveränderlichkeits- und Fremdtenanttests.
2. Serverports/Commands mit Unit- und Integrationstests.
3. Alle fachlichen Call-Sites von Rollenallowlists auf Permission-Guards umstellen; Source-Gate muss Null Altpfade melden.
4. Designsystem-/UI-Umsetzung nach Designphase 1b.
5. Browsermatrix mit realer Sessionkette und synthetischen Daten.
6. Unabhängiger Exact-SHA-Review; erst danach PR/Preview gemäß Mission. Keine Remote-Migration, kein Merge und kein Production-Schritt ohne Freigabe.
