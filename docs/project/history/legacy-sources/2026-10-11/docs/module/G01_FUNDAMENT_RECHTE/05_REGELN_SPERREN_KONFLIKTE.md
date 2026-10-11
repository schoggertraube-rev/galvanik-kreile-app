<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Regeln, Sperren und Konflikte

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Loginfläche zeigt nur exakt konfigurierte Profile | Benutzer-/Actor-Auswahl durch erratbare IDs | UI/Server | D-UI-V5-002; `productActorReadiness*`; `pinLoginHandle.ts` | GEBAUT |
| HMAC, Ablauf, Tenant und Cookie-Optionen | Cookie-Fälschung, Sessiondiebstahl/-wiederverwendung | Server | `appSession.ts` | GEBAUT |
| Profil-, Rollen-, Aktiv- und `updated_at`-Abgleich | Zugriff mit veralteter oder widerrufener Sitzung | Server/DB | `authorization.ts` | GEBAUT |
| bcrypt cost 12 ohne PIN-DTO/Logging | Klartext- oder Client-PIN-Wahrheit | Server/DB | `auth.actions.ts`; DECISION_PIN_SECURITY | GEBAUT |
| Advisory-Lock und 5/10/20-Schwellen | paralleles Umgehen des PIN-Rate-Limits | Server/DB | `pinRateLimit.ts` | GEBAUT |
| Tenantfilter vor jeder privilegierten Query | Cross-Tenant-Lesen/-Schreiben | Server/DB | D-ARCH-007; DECISION_TENANT_ISOLATION | GEBAUT |
| `AdminAuthority` zusätzlich zu PermissionKeys | Selbstvergabe der Sicherheitsadministration | Server | OE-2609-09/-20; D-UI-V5-002; Dossiervertrag | SPEZ |
| Permission-Katalog-Validierung | Rechteerweiterung über unbekannte Strings | Server/DB | `authorizationContract.ts`; A-G01-017 | SPEZ |
| Latest-event-Readmodel mit Standard `ALLOW` | Rollenmatrix oder FeatureFlags als Schattenwahrheit | Server/DB | OE-2609-09; A-G01-012…015 | SPEZ |
| `expectedVersion` + gesperrter Aggregatstand | verlorene Updates bei gleichzeitigen Rechteänderungen | Server/DB | D-RES-001; A-G01-021 | SPEZ |
| tenantweiter Unique-Key auf `client_event_id` | doppelte Rechte-/Approval-Mutation | DB | MODULKARTE Commands/Receipts; A-G01-021 | SPEZ |
| UPDATE-/DELETE-/TRUNCATE-Trigger auf Security-Events | nachträgliche Auditmanipulation | DB | D-RES-001; vorhandenes `prevent_audit_mutation`-Muster | SPEZ |
| Receipt plus fachlicher Readback | Scheinerfolg nach unklarem Commit-Ausgang | Server/UI | D-RES-001 | SPEZ |
| Rechteänderung hebt `app_users.updated_at` an | Nutzung alter Browserrechte nach Adminänderung | Server/DB | DECISION_PIN_SECURITY; A-G01-024 | SPEZ |
| Keine allgemeine Benutzeranlage | viertes sichtbares Profil ohne Produktvertrag | UI/Server | OE-2609-02; D-UI-V5-002 | SPEZ |
| Aufbewahrungs-Approval-Receipt | stille oder fremdautorisierte Löschung/Anonymisierung | Server/DB | OE-2609-20 | SPEZ |
| Provider-/DB-Ausfall bleibt fail-closed | Demo-, Mock- oder In-Memory-Zugang | Server/UI | AGENTS; D-ARCH-011/012 | GEBAUT |

## 2. Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G01-001 | Zu viele falsche PIN-Versuche | serialisierter Zähler erreicht 5/10/20 | Gregor | Systemadministration › Handlungsbedarf | Wartefrist beachten oder nach Identitätsprüfung PIN sicher rotieren; nie Zähler per Client löschen | GEBAUT |
| K-G01-002 | Product-Actor-Konfiguration fehlt, ist doppelt oder passt nicht zu Tenant/Rolle | Readiness-Validator | Gregor | Systemadministration › Handlungsbedarf | Serverkonfiguration und DB-Profil kontrolliert korrigieren; keine Ersatzperson wählen | GEBAUT |
| K-G01-003 | Sitzung ist abgelaufen, manipuliert, widerrufen oder tenantfremd | Session-/Authorization-Resolver | betroffene Person; Gregor nur bei Wiederholung | Loginfläche, nicht allgemeine Startseite | erneut anmelden; bei wiederholtem Fehler Support-Referenz an Gregor | GEBAUT |
| K-G01-004 | Zwei Adminänderungen verwenden denselben veralteten Personenstand | `expectedVersion` ungleich Aggregatversion | Gregor | Systemadministration › Personen & Rechte | aktuellen Readback laden, Abweichung prüfen und bewusst neu bestätigen | SPEZ |
| K-G01-005 | PermissionKey oder Rechte-Readmodel ist unbekannt/unvollständig | Katalog-/Schema-/Vollständigkeitsprüfung | Gregor | Systemadministration › Handlungsbedarf | keine Freigabe; Korrelation prüfen, Vertrag/DB vorwärtsgerichtet reparieren | SPEZ |
| K-G01-006 | Ausgang einer Rechteänderung ist nach Verbindungsabbruch unklar | kein Receipt im Client, aber mögliche Korrelation | Gregor | Systemadministration › Personen & Rechte | zuerst Readback über `clientEventId/correlationId`, nur bei belegtem Nichtschreiben erneut senden | SPEZ |
| K-G01-007 | Gregor versucht sich selbst zu deaktivieren oder den einzigen Admin-Actor zu lösen | Zielprofil = aktuelle `AdminAuthority` bei destruktiver Zugangsänderung | Gregor | Systemadministration › Personen | Command abweisen; Admin-Bindung nur in eigener, owner-freigegebener Recovery-Mission ändern | SPEZ |
| K-G01-008 | Fach-Command wird trotz personenbezogenem `DENY` aufgerufen | `requirePermission` vor Daten-/Providerzugriff | betroffene Person; Gregor für Rechteklärung | jeweilige Startseite › Handlungsbedarf | Aktion bleibt unverändert; Person wendet sich an Gregor, der das Rechteprofil prüft | SPEZ |
| K-G01-009 | Lösch-/Anonymisierungs-Command hat kein passendes Admin-Approval-Receipt | Ziel-/Aktion-/Proposal-/Tenant-Abgleich | Gregor | Systemadministration › Aufbewahrung | Vorschlag prüfen und ausdrücklich genehmigen oder ablehnen; bis dahin keine Datenänderung | SPEZ |

## 3. Konfliktanzeige-Grenze

Auth-/Rechtekonflikte gehören nicht als Rohfehler auf Rolf- oder Phillip-Home. Eine konkrete verweigerte Fachhandlung erscheint dort nur im Kontext der Handlung und nennt Gregor als Klärungsweg; Konfigurations-, Audit- und Admin-Konflikte erscheinen in Gregors Systemadministration. Der genaue visuelle Wortlaut ist Q-G01-001, die Zuständigkeit ist mit OE-2609-09/-10 und D-UI-V5-002 festgelegt.
