<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Funktionen und Abläufe

## Grundvertrag

1. Die App löst zuerst serverseitig Sitzung, Tenant und exakt konfigurierten Produktaktor auf.
2. Fachliche Rechte entstehen aus dem 13er-Permission-Katalog mit Standard `ALLOW` plus dem neuesten personenbezogenen `ALLOW|DENY|RESET`-Ereignis.
3. Technische Rollen steuern nur kompatiblen Login, Produktprofil und Routing; Fach-Commands prüfen PermissionKeys.
4. `AdminAuthority` ist ausschließlich Gregor mit exakt gebundenem Actor und serverseitiger Rolle `admin|developer`.
5. Kein Erfolg vor Receipt und Readback; unklarer Ausgang führt zu Readback statt blindem Retry.

### F-G01-001 — Persönlicher PIN-Login für Rolf und Phillip

**Auslöser:** Rolf oder Phillip wählt sein sichtbares Profil und gibt vier Ziffern ein.

**Personen:** Rolf und Phillip; Rechte werden erst nach erfolgreicher Anmeldung aufgelöst.

**Schritte:**

1. `/start` liest die exakt konfigurierten Rolf-/Phillip-Profile serverseitig und erzeugt nur undurchsichtige Login-Handles.
2. Tastatur, Numpad oder Touch erfasst genau vier Ziffern und sendet genau einmal.
3. Der Server validiert Handle, Profil, Tenant, Aktivstatus, technische Rolle und serialisiertes Rate-Limit.
4. Der PIN wird serverseitig gegen bcrypt geprüft; Klartext verlässt die Request-Verarbeitung nicht.
5. Eine signierte App-Sitzung wird gesetzt und der serverseitige Last-Seen-Beleg geschrieben.
6. Erst danach navigiert die App zu `/`; Rolf erhält sein Home, Phillip die Werkstatt.

**Ergebnis + Receipt/Readback:** Login-Erfolg wird durch gültige Sitzung plus unmittelbar erneut aufgelösten Product-Actor-/Authorization-Snapshot bestätigt; scheitert Last-Seen, wird die Sitzung wieder gelöscht.

**Fehlerfälle:** unbekannter PIN, ungültiger Handle, fehlendes Profil, fremder Tenant, DB-Fehler, Rate-Limit oder Last-Seen-Fehler liefern keinen Zugang.

**Sperren/Konflikte:** K-G01-001, K-G01-002, K-G01-003.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Profilkarten Rolf und Phillip sowie Gregors separater Systemeinstieg | „Persönlichen Code eingeben“ | `StartScreenClient.tsx` |
| lädt | Serverseitige Loginfläche wird aufgebaut | „Anmeldung wird geladen …“ | `StartScreenClient.tsx` |
| leer | Keine sicher auflösbaren PIN-Profile | „Anmeldung ist momentan nicht verfügbar. Bitte den Systemadministrator kontaktieren.“ | `StartScreenClient.tsx` |
| Fehler | PIN oder aktives Profil passt nicht | „Ungültige PIN oder inaktiver Benutzer.“ | `auth.actions.ts` |
| gesperrt | Dauerhafte PIN-Sperre ist erreicht | „Konto gesperrt. Bitte Administrator kontaktieren.“ | `auth.actions.ts` |
| In Klärung | Device-Challenge ist noch nicht entschieden | „Gerätebindung · In Klärung“ | Q-G01-002; Ausgrauen-Standard |
| In Aufbau | Rechteverwaltung ist noch nicht angebunden | „Personen & Rechte · In Aufbau“ | Plan T-05; Ausgrauen-Standard |

### F-G01-002 — Erhöhter E-Mail-Login für Gregor

**Auslöser:** Gregor öffnet den Systemeinstieg und sendet E-Mail und Passwort.

**Personen:** Gregor; keine betriebliche Impersonation.

**Schritte:**

1. Supabase Auth prüft E-Mail/Passwort serverseitig.
2. Die App liest das tenantgebundene App-User-Profil.
3. Profil-ID, Tenant und Rolle müssen exakt dem konfigurierten Gregor-Actor entsprechen.
4. Die App setzt die signierte Sitzung und schreibt den Last-Seen-Beleg.
5. Gregor wird zu `/settings` geführt.

**Ergebnis + Receipt/Readback:** Gültige Supabase-Identität plus App-Sitzungs-/Product-Actor-Readback; kein App-Zugang allein aufgrund eines erfolgreichen Provider-Logins.

**Fehlerfälle:** falsches Credential, anderes Tenantprofil, falsche Rolle, fehlender Gregor-Actor oder Last-Seen-Fehler führen zu Provider-Logout und geschlossenem App-Zugang.

**Sperren/Konflikte:** K-G01-002, K-G01-003.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | E-Mail- und Passwortfelder im Systemdialog | „System Login“ | `EmailLoginDialog.tsx` |
| lädt | Provider-Anmeldung läuft | „Lädt...“ | `EmailLoginDialog.tsx` |
| leer | Gregor-Profil ist nicht sicher verfügbar | „Anmeldung ist momentan nicht sicher verfügbar.“ | `auth.ts`/`productActorReadiness.ts` |
| Fehler | Credential ist falsch | „E-Mail oder Passwort falsch“ | `auth.ts` |
| gesperrt | App-Profil ist nicht für Systemadministration freigegeben | „Dieser Zugang ist nicht für die Systemadministration freigegeben.“ | `auth.ts` |
| In Klärung | Kein zusätzlicher Zustand fachlich belegt | FEHLT → Q-G01-001 | Designphase 1b |
| In Aufbau | Rechteverwaltung folgt nach Login | „Personen & Rechte · In Aufbau“ | Plan T-05; Ausgrauen-Standard |

### F-G01-003 — Sitzung und wirksame Autorisierung auflösen

**Auslöser:** Jede authentifizierte Route, jeder sensible Read-Port und jeder Command.

**Personen:** alle drei Produktidentitäten; Standard sind alle fachlichen PermissionKeys erlaubt, Gregor kann je Person abweichen.

**Schritte:**

1. Signatur, Ablauf und Tenant des Cookies werden validiert.
2. `app_users` wird mit Person und Tenant gelesen; Aktivstatus, technische Rolle und `updated_at` werden geprüft.
3. Das exakte Produktprofil wird fail-closed bestätigt.
4. Das Rechte-Readmodel liefert pro katalogisiertem PermissionKey die neueste Entscheidung.
5. Der Resolver bildet atomar Product Identity, technische Rolle, wirksame Rechte und Aktivstatus.
6. Server-Guard und UI-Bootstrap erhalten denselben Snapshot; der Browser entscheidet nie über Autorisierung.

**Ergebnis + Receipt/Readback:** Ein unveränderlicher Authorization-Snapshot für den Request; Reads und Commands protokollieren Actor/Tenant/Korrelation in ihrem eigenen Beleg.

**Fehlerfälle:** kein Cookie, ungültige Signatur, Ablauf, Tenantabweichung, DB-Ausfall, unbekannte Rolle, Sessionwiderruf oder unlesbares Rechteereignis.

**Sperren/Konflikte:** K-G01-002, K-G01-003, K-G01-005.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Zielroute mit atomarem Produktprofil | FEHLT → Q-G01-001 | D-UI-V5-002; `authBootstrap.ts` |
| lädt | Navigation wartet nicht auf einen zweiten Rechte-Request | FEHLT → Q-G01-001 | `PermissionsContext.tsx` |
| leer | Keine Sitzung | FEHLT → Q-G01-001 | `src/app/page.tsx` |
| Fehler | Rechteauflösung ist nicht verfügbar | „Der Produktzugang ist momentan nicht sicher verfügbar.“ | `authBootstrap.ts` |
| gesperrt | Sitzung wurde widerrufen | „Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.“ | `authBootstrap.ts` |
| In Klärung | Kein eigener Zustand fachlich belegt | FEHLT → Q-G01-001 | Designphase 1b |
| In Aufbau | Kein eigener Zustand fachlich belegt | FEHLT → Q-G01-001 | Designphase 1b |

### F-G01-004 — Personen und wirksame Rechte ansehen

**Auslöser:** Gregor öffnet in Einstellungen „Personen & Rechte“.

**Personen:** Lesen verlangt `perm_sys_users`; die Seite selbst wird im Kreile-Host nur Gregor angeboten.

**Schritte:**

1. Der Server bestätigt Product Actor, Tenant und `perm_sys_users`.
2. Er liest ausschließlich die drei konfigurierten Produktprofile.
3. Pro Profil werden die 13 Katalogrechte, Standardwirkung, explizite letzte Entscheidung und effektive Wirkung geladen.
4. UI gruppiert Rechte nach System, Daten, Betrieb und Ansicht; technische Rollen bleiben nur als nicht editierbare Diagnoseinformation.
5. Auswahl einer Person öffnet deren Rechtematrix und Auditverlauf.

**Ergebnis + Receipt/Readback:** Read-only Snapshot mit Datenstand/Version; kein Receipt nötig, aber Audit-/Event-IDs der letzten Änderungen sind verlinkbar.

**Fehlerfälle:** fehlendes Adminprofil, fehlendes Leserecht, unvollständiger Snapshot oder DB-Fehler bleiben fail-closed.

**Sperren/Konflikte:** K-G01-003, K-G01-005.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Drei Personen mit Status und effektiven Rechten | „Personen & Rechte“ | Auftrag; Plan T-05 |
| lädt | Personen-Readmodel wird gelesen | „Lade Benutzer...“ | `UserManagement.tsx` (Wortlaut zu prüfen) |
| leer | Keine konfigurierten Produktprofile | „Keine Benutzer gefunden.“ | `UserManagement.tsx` (Wortlaut zu prüfen) |
| Fehler | Readmodel ist nicht verfügbar | FEHLT → Q-G01-001 | Designphase 1b |
| gesperrt | Actor besitzt keinen zulässigen Zugang | FEHLT → Q-G01-001 | Designphase 1b |
| In Klärung | Design ist noch nicht freigegeben | „Personen & Rechte · In Klärung“ | Ausgrauen-Standard |
| In Aufbau | Implementierung läuft | „Personen & Rechte · In Aufbau“ | Ausgrauen-Standard |

### F-G01-005 — Personenrecht erlauben, verweigern oder zurücksetzen

**Auslöser:** Gregor ändert für eine ausgewählte Person genau ein Recht und bestätigt die Änderung mit Grund.

**Personen:** ausschließlich `AdminAuthority`; Zielperson ist Rolf, Phillip oder Gregor.

**Schritte:**

1. Client sendet Zielperson, PermissionKey, `ALLOW|DENY|RESET`, Grund, `expectedVersion`, `clientEventId` und `correlationId`.
2. Server bestätigt erneut `AdminAuthority`, Tenant, Zielprofil, bekannten PermissionKey und Eingabe.
3. In einer Transaktion wird die aktuelle Aggregatversion gesperrt und verglichen.
4. Bei gültiger Version wird genau ein append-only `USER_PERMISSION_DECIDED_V1` geschrieben; UPDATE, DELETE und TRUNCATE sind DB-seitig verboten.
5. `app_users.updated_at` der Zielperson wird im selben Commit angehoben, damit alte Sitzungen widerrufen werden.
6. Das kanonische Effective-Permissions-Readmodel wird erneut gelesen.
7. UI zeigt Erfolg erst mit Receipt und dem neuen effektiven Profil.

**Ergebnis + Receipt/Readback:** Event-ID, Zielperson, PermissionKey, Entscheidung, Vorher/Nachher, Version, Zeit und Korrelation plus vollständiger Rechte-Readback.

**Fehlerfälle:** unbekannter Key, fremder Tenant, fehlender Grund, kein Admin, Versionkonflikt, doppelte Event-ID oder unklarer Commit-Ausgang.

**Sperren/Konflikte:** K-G01-004, K-G01-005, K-G01-006.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Aktuelle Wirkung und explizite Abweichung je Recht | FEHLT → Q-G01-001 | Designphase 1b |
| lädt | Änderung wartet auf Receipt und Readback | FEHLT → Q-G01-001 | Designphase 1b |
| leer | Keine Abweichung vom Standard | FEHLT → Q-G01-001 | Designphase 1b |
| Fehler | Command ist sicher gescheitert | FEHLT → Q-G01-001 | Designphase 1b |
| gesperrt | `AdminAuthority` fehlt | FEHLT → Q-G01-001 | Designphase 1b |
| In Klärung | Design-/Wortlautentscheidung offen | „Rechte ändern · In Klärung“ | Ausgrauen-Standard |
| In Aufbau | Command oder UI ist noch nicht angebunden | „Rechte ändern · In Aufbau“ | Ausgrauen-Standard |

### F-G01-006 — Person sperren/aktivieren oder PIN rotieren

**Auslöser:** Gregor wählt bei Rolf oder Phillip „Deaktivieren/Aktivieren“ oder startet eine PIN-Rotation.

**Personen:** ausschließlich `AdminAuthority`; Gregors Provider-Credential wird nicht in der App geändert.

**Schritte:**

1. Server bestätigt Admin, Tenant, exaktes Produktprofil, Eingabe und erwartete Version.
2. Neue PINs werden ausschließlich serverseitig bcrypt cost 12 gehasht; der PIN steht nie in Receipt oder Audit.
3. Status-/PIN-Änderung und append-only Security-Audit werden atomar geschrieben.
4. `app_users.updated_at` wird angehoben; PIN-Rate-Limit wird bei bestätigter Rotation kontrolliert zurückgesetzt.
5. Command liest Status, Profilversion und Sitzungswiderruf zurück.

**Ergebnis + Receipt/Readback:** Sicherheitsbeleg ohne Credential sowie bestätigter Aktivstatus/Versionsstand; alte Sitzung und bei Rotation alte PIN sind ungültig.

**Fehlerfälle:** Selbstdeaktivierung Gregors, fremder Tenant, Ziel außerhalb der drei Profile, schwache/formfalsche PIN, Versionskonflikt oder DB-Fehler.

**Sperren/Konflikte:** K-G01-001, K-G01-004, K-G01-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Person mit Aktivstatus und PIN-Aktion | „Aktivieren“ / „Deaktivieren“ | `UserManagement.tsx` |
| lädt | Sicherheitsänderung läuft | FEHLT → Q-G01-001 | Designphase 1b |
| leer | Kein sicher konfiguriertes Zielprofil | „Keine Benutzer gefunden.“ | `UserManagement.tsx` (Wortlaut zu prüfen) |
| Fehler | Änderung ist gescheitert | FEHLT → Q-G01-001 | Designphase 1b |
| gesperrt | Ziel oder Aktion ist nicht zulässig | FEHLT → Q-G01-001 | Designphase 1b |
| In Klärung | Device-/Credential-Grenze ist offen | „Gerätebindung · In Klärung“ | Q-G01-002 |
| In Aufbau | Sicherer Command ist noch nicht angebunden | „PIN und Zugang · In Aufbau“ | Ausgrauen-Standard |
