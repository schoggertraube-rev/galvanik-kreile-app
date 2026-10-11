<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 02 — Funktionen und Zustände

Alle fachlichen UI-Wortlaute sind bis Designphase 1b absichtlich nicht erfunden. Vor dem Provider-/UI-Gate bleiben M04-Route und Kalendernavigation unsichtbar; ausschließlich das nicht klickbare Grundstamm-Element „Microsoft 365 – In Klärung“ ist zulässig. Die Tabellen definieren die später abzunehmenden Zustände.

### F-M04-001 — Fachtermin nach Microsoft 365 projizieren

- **Auslöser:** Ein kanonischer Kreile-Auftragstermin wird bei Auftragsannahme, Terminverschiebung oder bestätigter Fälligkeit angelegt beziehungsweise geändert.
- **Personen:** Lesen für alle Personen; Auslösen über das jeweils berechtigte Fachmodul, nicht über Outlook.
- **Schritte:** Quelle lesen → Kreile-Content-Policy mit minimaler Übersicht und vollständigem Detail samt App-Links rendern → Absicht/Idempotency-Key in Job/Outbox persistieren → Graph-Hauptkalender des Büropostfachs schreiben → Receipt speichern → Readback vergleichen.
- **Ergebnis:** Genau ein bestätigter Termin im Hauptkalender des Kreile-Büropostfachs mit belegbarer Quellrevision.
- **Fehler:** Auth, Rate Limit, ungültige Zeitzone, Providerfehler oder fehlender Readback bleiben sichtbar technisch offen.
- **Konflikte:** Neuere Quellrevision gewinnt nur über neue Operation; `UNKNOWN` wird erst reconciled.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | App-Termin und bestätigten Projektionsstatus | FEHLT → Q-M04-007 | A-M04-006–010 |
| lädt | Laufende Übermittlung ohne Erfolgsbehauptung | FEHLT → Q-M04-007 | A-M04-032/036 |
| leer | Noch keine Projektion für diesen Termin | FEHLT → Q-M04-007 | D-ARCH-011 |
| Fehler | Klassifizierten Fehler und sichere nächste Aktion | FEHLT → Q-M04-007 | A-M04-011 |
| gesperrt | M365 ist nicht abgenommen beziehungsweise Person darf nicht administrieren | FEHLT → Q-M04-007 | A-M04-005/031 |
| In Klärung | Versand unklar; Readback/Reconcile läuft | FEHLT → Q-M04-007 | A-M04-010/036 |
| In Aufbau | Modul noch nicht produktiv adoptiert | FEHLT → Q-M04-007 | Mission; OP-02 |

### F-M04-002 — Projektion ändern oder absagen

- **Auslöser:** Ein kanonischer Kreile-Auftragstermin ändert Revision, Zeit, Terminart, Inhalt oder Berechtigung beziehungsweise wird abgesagt.
- **Personen:** Alle Personen im Fachmodul gemäß dessen Schreibrecht; M04 selbst vergibt keine Fachrechte.
- **Schritte:** Neueste Revision prüfen → Mapping laden → Modify/Cancel-Absicht persistieren → Graph ausführen → Readback.
- **Ergebnis:** Providerprojektion entspricht exakt der neuesten berechtigten App-Revision oder ist bestätigt entfernt.
- **Fehler:** Fehlendes Mapping, fremde Provideränderung, Rate/Timeout oder ungültiger Kreile-Quellzustand.
- **Konflikte:** Parallele Revisionen werden serialisiert; veraltete Operation wird verworfen, nicht zurückprojiziert.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Letzte App-Revision und bestätigten Outlook-Stand | FEHLT → Q-M04-007 | A-M04-008/014 |
| lädt | Änderung/Absage wird geprüft und übertragen | FEHLT → Q-M04-007 | A-M04-009 |
| leer | Kein bestehendes Mapping | FEHLT → Q-M04-007 | candidate.3 |
| Fehler | Ursache, betroffenen Termin und sichere Wiederaufnahme | FEHLT → Q-M04-007 | A-M04-011 |
| gesperrt | Quelle nicht änderbar oder Provider nicht freigegeben | FEHLT → Q-M04-007 | A-M04-005/031 |
| In Klärung | Providerausgang unbekannt oder Drift festgestellt | FEHLT → Q-M04-007 | A-M04-010/027 |
| In Aufbau | Modify/Cancel noch nicht produktiv adoptiert | FEHLT → Q-M04-007 | Mission |

### F-M04-003 — Unklaren Provider-Ausgang nachlesen und abgleichen

- **Auslöser:** Timeout, Prozessabbruch, fehlendes Receipt, Hashabweichung oder planmäßiger Reconcile.
- **Personen:** Automatisch; lesbare Zusammenfassung für alle, technische Aktion nur Admin.
- **Schritte:** Operation sperren → Mapping/Provider lesen → Intent-Hash vergleichen → sicheren Folgeschritt persistieren → erneut nachlesen.
- **Ergebnis:** `CONFIRMED`, sicherer Retry oder menschlich zu klärender Drift; niemals blindes Doppel-Schreiben.
- **Fehler:** Provider nicht erreichbar, Identität ungültig, Objekt nicht eindeutig.
- **Konflikte:** Bei neuerer Fachrevision wird der alte Intent abgeschlossen und die neuere Revision separat verarbeitet.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reconcile-Ergebnis, Zeitpunkt und betroffene Quelle | FEHLT → Q-M04-007 | A-M04-009/010 |
| lädt | Readback läuft | FEHLT → Q-M04-007 | candidate.3 |
| leer | Keine ungeklärten Operationen | FEHLT → Q-M04-007 | candidate.3 |
| Fehler | Readback nicht möglich und nächste sichere Prüfung | FEHLT → Q-M04-007 | A-M04-011 |
| gesperrt | Nur Admin darf manuellen Reconcile anstoßen | FEHLT → Q-M04-007 | A-M04-031 |
| In Klärung | Ausgang noch nicht eindeutig | FEHLT → Q-M04-007 | A-M04-010/036 |
| In Aufbau | Reconcile-Worker noch nicht adoptiert | FEHLT → Q-M04-007 | Mission |

### F-M04-004 — Betriebstermin oder Abwesenheit schreibgeschützt aufnehmen

- **Auslöser:** Gültige Graph-Change-Notification oder Delta-Reconcile erkennt im Hauptkalender des Kreile-Büropostfachs einen Betriebstermin oder eine Abwesenheit.
- **Personen:** Automatisch; lesbar für alle nach Content-/Datenschutzfreigabe.
- **Schritte:** Vercel-Route validiert und queued die Notification → Supabase-Worker liest Subscription/Delta → Event normalisieren → Fingerprint deduplizieren → schreibgeschütztes Signal speichern.
- **Ergebnis:** Ein Kreile-tenantgebundenes Signal für Startseite/Tagesüberblick oder Werkstatt ohne automatische App- oder Graph-Rückschreibung.
- **Fehler:** Ungültige Webhooksignatur, Delta-Lücke, abgelaufene Subscription oder nicht freigegebener Inhalt.
- **Konflikte:** Mehrere Notifications desselben Providerstands werden dedupliziert; App-Wahrheit bleibt unverändert.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Betriebstermin oder Abwesenheit mit Zeit, Herkunft und Änderungsart | FEHLT → Q-M04-007 | A-M04-013/016/038 |
| lädt | Delta-/Signallauf wird verarbeitet | FEHLT → Q-M04-007 | A-M04-025 |
| leer | Keine freigegebenen externen Signale | FEHLT → Q-M04-007 | A-M04-016 |
| Fehler | Signalquelle unvollständig oder nicht vertrauenswürdig | FEHLT → Q-M04-007 | A-M04-025 |
| gesperrt | Signal-In ist bis Datenschutz-/Retention-Gate deaktiviert | FEHLT → Q-M04-007/016 | A-M04-016/041 |
| In Klärung | Delta-Lücke oder unbekannte Änderungsfolge | FEHLT → Q-M04-007 | A-M04-025/026 |
| In Aufbau | Signal-In noch nicht produktiv adoptiert | FEHLT → Q-M04-007 | Mission |

### F-M04-005 — Kalendereintrag mit Kreile-Information verknüpfen

- **Auslöser:** Eine Person öffnet den App-Link eines Auftragstermins oder ordnet ein read-only Kalendersignal einem zulässigen Kreile-Objekt zu.
- **Personen:** Alle Personen mit Leserecht; Verknüpfung nur gemäß Fachrecht des Zielobjekts.
- **Schritte:** Signal und Ziel lesen → Tenant/Fachrecht prüfen → Host-Link persistieren → Audit anzeigen.
- **Ergebnis:** Tenantgebundener App-Link beziehungsweise hostseitige Referenz; Providerereignis und fachliches App-Objekt bleiben unverändert.
- **Fehler:** Ziel fehlt, Cross-Tenant, fehlendes Fachrecht oder Signal veraltet.
- **Konflikte:** Bereits anderweitig verknüpftes Signal erfordert bewusste Klärung; keine automatische Umhängung.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kalendereintrag, App-Ziel und Auditzeitpunkt | FEHLT → Q-M04-007 | A-M04-017 |
| lädt | Zielsuche oder Linkprüfung läuft | FEHLT → Q-M04-007 | A-M04-017 |
| leer | Noch keine Verknüpfung beziehungsweise kein zulässiges Ziel | FEHLT → Q-M04-007 | A-M04-017 |
| Fehler | Link konnte nicht sicher gespeichert werden | FEHLT → Q-M04-007 | A-M04-022 |
| gesperrt | Fachrecht oder Signal-In-Freigabe fehlt | FEHLT → Q-M04-007/016 | A-M04-031/041 |
| In Klärung | Signal ist konkurrierend verknüpft oder veraltet | FEHLT → Q-M04-007 | A-M04-017 |
| In Aufbau | Linkoberfläche noch nicht adoptiert | FEHLT → Q-M04-007 | Mission |

### F-M04-006 — Subscription, Delta und Providergesundheit betreiben

- **Auslöser:** Supabase Cron, bevorstehender Ablauf der delegierten Anmeldung oder eines Graph-Abonnements, neuer Job/Outbox-Eintrag, fehlgeschlagener Lauf oder Adminprüfung.
- **Personen:** Automatisch; technische Details und Re-Consent nur Admin, Status lesbar für alle ohne Secrets.
- **Schritte:** Job/Outbox lesen → Lease erwerben → Ablauf von Identitätsbindung und Graph-Abonnement überwachen → soweit möglich erneuern → Delta fortsetzen → Receipt, Checkpoint und Health persistieren → bei drohendem oder eingetretenem Ablauf Gregors Startseite warnen.
- **Ergebnis:** Nachweisbar aktuelle Verbindung oder klarer fail-closed Zustand mit Warnung auf Gregors Startseite.
- **Fehler:** Consent entzogen, Token nicht nutzbar, Webhook nicht erreichbar, Delta-Token ungültig, Rate Limit.
- **Konflikte:** Nur ein Lease-Owner arbeitet; abgelaufener Checkpoint startet kontrollierten Vollabgleich im festgelegten Fenster.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Health, letzter Sync, Ablauf der delegierten Anmeldung und des Graph-Abonnements sowie Delta-Stand | FEHLT → Q-M04-007 | A-M04-025/026/032/043 |
| lädt | Verbindung beziehungsweise Erneuerung wird geprüft | FEHLT → Q-M04-007 | A-M04-032 |
| leer | Noch keine tenantgebundene Verbindung | FEHLT → Q-M04-007 | D-ARCH-011 |
| Fehler | Klassifizierter Provider-/Webhookfehler und Warnung auf Gregors Startseite bei nicht bestätigter Erneuerung | FEHLT → Q-M04-007 | A-M04-011/025/043 |
| gesperrt | Re-Consent oder Administration fehlt | FEHLT → Q-M04-007 | A-M04-004/031 |
| In Klärung | Health/Delta nicht sicher aktuell | FEHLT → Q-M04-007 | A-M04-026/036 |
| In Aufbau | Providerpfad noch nicht real E2E-abgenommen | FEHLT → Q-M04-007 | A-M04-024 |

### F-M04-007 — Kreile-Kalender in Woche und Monat nachschlagen

- **Auslöser:** Person öffnet nach Freigabe die nicht primäre Nachschlageansicht T-07 und wechselt Zeitraum/Ansicht.
- **Personen:** Alle Personen lesen; Fachbearbeitung bleibt im erzeugenden Modul.
- **Schritte:** App-Auftragstermine aus kanonischen Fachquellen sowie read-only Betriebstermine/Abwesenheiten lesen → Zeitraum/Filter anwenden → Projektionszustand ergänzen → Detail zum Kreile-Objekt verlinken.
- **Ergebnis:** Wochen-/Monatsansicht zum Nachschlagen mit klarer Trennung zwischen App-Wahrheit und read-only Outlook-Information.
- **Fehler:** Fachquelle, Projektion oder Zeitraum nicht ladbar; Teilfehler werden nicht als vollständig ausgegeben.
- **Konflikte:** Kollisionen werden angezeigt, aber nur vom zuständigen Fachmodul entschieden.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Termine im gewählten Zeitraum mit Host- und Projektionsstatus | FEHLT → Q-M04-007 | A-M04-029/034 |
| lädt | Skelett der gewählten Wochen-/Monatsansicht | FEHLT → Q-M04-007 | D-UI-V5-003 |
| leer | Freigegebener Zeitraum ohne App-Termine | FEHLT → Q-M04-007 | A-M04-030 |
| Fehler | Nicht geladener Teil und Wiederholen-Aktion | FEHLT → Q-M04-007 | A-M04-030 |
| gesperrt | Ansicht vor M365-/Owner-Gate vollständig verborgen | FEHLT → Q-M04-002/007 | A-M04-005 |
| In Klärung | Einzelne Projektionen nicht bestätigt | FEHLT → Q-M04-007 | A-M04-036 |
| In Aufbau | Designphase 1b beziehungsweise Modulpriorisierung ausstehend | FEHLT → Q-M04-007 | Plan v1.1 |

### F-M04-008 — Microsoft-365-Verbindung administrieren

- **Auslöser:** Admin verbindet, prüft, erneuert oder trennt die delegierte Verbindung des Kreile-Büropostfachs und seines Hauptkalenders.
- **Personen:** Ausschließlich Admin; nichtadministrative Personen sehen höchstens freigegebenen Health-Status.
- **Schritte:** Kreile-Tenant-/Azure-/Lizenz-/Kosten-/AVV-Inventar prüfen → delegierten Consent starten → Büropostfach und Hauptkalender verifizieren → Health/Read-Test → Freigabestatus setzen; Trennung löscht nichts ohne separaten genehmigten Auftrag.
- **Ergebnis:** Nachgewiesene tenantgebundene Verbindung oder fail-closed Nichtverbunden-Zustand.
- **Fehler:** Falscher Benutzer/Tenant, fehlender Consent, Lizenz, Callback, Token-Transport oder Kalender.
- **Konflikte:** Unfreigegebene Kreile-App-Registrierung, Büropostfachbindung oder Consent blockiert Aktivierung.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Gebundene Identität als Metadaten, Health und letzter erfolgreicher Test | FEHLT → Q-M04-007 | A-M04-004/032 |
| lädt | Anmeldung, Consent oder Health-Prüfung läuft | FEHLT → Q-M04-007 | D-ARCH-011 |
| leer | Keine Produktverbindung eingerichtet | FEHLT → Q-M04-007 | Koordinator-Digest spät |
| Fehler | Freigabefähige Ursache ohne Token-/Secretwert | FEHLT → Q-M04-007 | A-M04-021 |
| gesperrt | Kein Adminrecht oder externe Freigabe fehlt | FEHLT → Q-M04-007/009 | A-M04-031/035 |
| In Klärung | Kreile-App-/Tenant-/Consentinventar ist noch nicht freigegeben | FEHLT → Q-M04-001/014 | OE-2609-18/25; OP-11 |
| In Aufbau | Produktcallback, Tokenablage oder Adapter fehlen | FEHLT → Q-M04-004 | Mission |
