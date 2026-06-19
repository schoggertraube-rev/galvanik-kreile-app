# 09 — TEST-, ABNAHME- UND GO-LIVE-PLAN
## Kreile WerkstattCockpit

---

## 1. Testpyramide

| Ebene | Inhalt | Phase |
|---|---|---|
| Vertragstests | Auth-Chain, Tenant-Filter, kritische Server Actions (`createOrderFromScan`, `customers.actions.ts`) | Phase 1/2 |
| Datenbanktests | RLS-Policies pro Tabelle, Migrationen remote verifiziert | Phase 1 |
| Rollenprüfungen | admin/meister/office/workshop/quality/viewer — je Rolle korrekte Sicht- und Schreibrechte | Phase 2 |
| Performanceprüfungen | Core Web Vitals (LCP < 2.5s, CLS < 0.1), kein unnötiger Dauer-Animations-CPU-Verbrauch | Phase 2/8 |
| Responsive-Prüfungen | Desktop, Tablet quer (primär!), Tablet hochkant, Smartphone | Phase 1/3 |
| Realistische Nutzerszenarien | Siehe Abschnitt 3 (Persona-Walkthroughs) | Phase 3/8 |
| Sicherheitsprüfung | RLS vollständig, Secrets rotiert, kein Klartext-Passwort in History | Phase 1/8 |
| Migrationstest | Jede Migration mit Rollback-Pfad dokumentiert | laufend |
| Backup und Restore | Supabase-Backup-Restore mindestens einmal real getestet | Phase 8 |
| Smoke Test | Kernpfade (Login, Auftrag anlegen, Status ändern, Suche) nach jedem Deploy | laufend |

---

## 2. Vertragstest-Nachweis (Pflicht je Kernfeature)

Jedes der folgenden Features muss die vollständige Kette aus Dok. 05 Abschnitt 1 nachweisen, bevor es als `VERIFIED` gilt:

| Feature | Nachweis-Status |
|---|---|
| Scan → Auftrag | Ausstehend (Bauprompt 03) |
| Beleg-OCR → Buchhaltung | Ausstehend (Bauprompt 01/02) |
| Kunde suchen → Status anzeigen | Ausstehend (Bauprompt 04/05) |
| Station wechseln → StatusEvent | Bereits nachgewiesen (laut QS-03, einziger durchgängig funktionierender Pfad) |
| Cockpit-Kachel → echte Daten | Teilweise (AgingKachel, EngpassKachel, TopKundenKachel laut QS-06 bereits DB-backed) |

---

## 3. Realistische Nutzerszenarien (Persona-Walkthroughs, aus Dok. 04 übernommen als Testfälle)

### Szenario 1 — Inhaber, Morgenstart ohne aktive Session
**Erwartung:** Sichtbarer Hinweis/Redirect statt leerer Liste. **Test besteht, wenn:** kein einziger Datenbereich ohne Erklärung leer erscheint.

### Szenario 2 — Büro, Kundenanruf „Wann ist Auftrag X fertig?"
**Erwartung:** Antwort in unter 10 Sekunden über GlobalSearch. **Test besteht, wenn:** Suche nach Name UND nach Fahrzeug-/Teilebeschreibung Treffer liefert (VS-10).

### Szenario 3 — Inhaber, Auftrag scannen
**Erwartung:** Erfolgsmeldung erscheint nur nach echtem DB-Write. **Test besteht, wenn:** DB-Zeilenzahl nachweislich steigt UND die Meldung erst danach erscheint.

### Szenario 4 — Werkstatt-Mitarbeiter, Tablet in der Halle
**Erwartung:** Navigation ohne Hover bedienbar. **Test besteht, wenn:** alle Hauptfunktionen auf 1024px-Touch-Viewport ohne Maus erreichbar sind.

### Szenario 5 — Nachfolger, Cockpit öffnen
**Erwartung:** Klartext-Kennzahlen mit Handlungsbutton, kein unerklärter Fachbegriff. **Test besteht, wenn:** Sohn (oder Testperson in dieser Rolle) jede sichtbare Kachel korrekt erklären kann.

### Szenario 6 — Auftragserfassung durch Telefonanruf unterbrochen
**Erwartung:** Keine Datenverluste. **Test besteht, wenn:** nach Tab-Schließung und Wiederöffnen die Eingabe wiederhergestellt wird (VS-05, Phase 3).

---

## 4. Sicherheitsprüfung — Checkliste

- [ ] Alle in Phase 1 priorisierten Tabellen zeigen `rowsecurity = true`
- [ ] Datenbankpasswort rotiert, nicht mehr in Shell-History sichtbar
- [ ] Kein API-Key im Frontend-Bundle sichtbar (Build-Output geprüft)
- [ ] `tenant_id`-Filter in jeder mandantengebundenen Query nachgewiesen
- [ ] Admin-Konsole (`/admin/workshops`) nur für `anbieter_admin`-Rolle erreichbar, 2FA aktiv
- [ ] Audit-Log (`LicenseAuditEntry`) ist append-only, keine Löschfunktion vorhanden

---

## 5. Migrationstest

Für jede Migration seit Projektbeginn (70+ laut QS-06):
- Migration ist in `drizzle/migrations/` vorhanden UND auf Supabase remote tatsächlich ausgeführt (nicht nur lokal — bekanntes Risiko aus Projektgedächtnis: „Seed-Scripts nicht ausgeführt").
- Rollback-Pfad ist dokumentiert oder zumindest beschreibbar.

---

## 6. Backup und Restore

- Supabase automatische Backups aktiv (Standard) — **Restore-Test bisher nie durchgeführt (QS-09 Punkt 1)**.
- RTO/RPO sind aktuell nicht definiert. Vor Go-live: mindestens einen echten Restore-Test gegen eine Kopie der DB durchführen und Ergebnis dokumentieren.

---

## 7. Abnahmeprotokoll

| Kriterium | Nachweisform | Status |
|---|---|---|
| Alle MVP-Anforderungen (Phase 1) erfüllt | Bauprompt-Prüfphasen 01–09 | Ausstehend |
| Keine offenen P0/P1-Befunde | Dok. 02 Abschnitt 4 | Ausstehend |
| Kernprozesse end-to-end nachgewiesen | Dok. 05 Abschnitt 1 Kette | Ausstehend |
| Kundenfragen belastbar beantwortbar | Szenario 2 | Ausstehend |
| Teile auffindbar | Szenario 4 | Ausstehend |
| Statusfluss stabil | Szenario 4 + Stationsworkflow | Bereits teilweise belegt |
| Wirtschaftliche Daten nachvollziehbar | Phase 4/5 Abschluss | Noch nicht in Scope von Phase 1 |
| Nutzersimulation 12/12 DoD-Kriterien | Dok. 04 + erneute Simulation nach Phase 3 | Ausstehend (aktuell 0/12) |
| Plattformcheck mindestens 14/20 DoD-Kriterien | Dok. 03 + erneute Prüfung nach Phase 7 | Ausstehend (aktuell 0/20) |

---

## 8. Go-live-Checkliste

```
[ ] Phase 0 abgeschlossen (Sicherung, Secrets, Migrationsstand verifiziert)
[ ] Phase 1 abgeschlossen (alle 13 Arbeitspakete VERIFIED)
[ ] Phase 2 abgeschlossen (Kernvernetzung, Token-System, Feature-Flags)
[ ] Mindestens Phase 3 (operative Bedienung) abgeschlossen
[ ] Sicherheitsprüfung (Abschnitt 4) vollständig grün
[ ] Backup/Restore mindestens einmal real getestet
[ ] Schulung Inhaber + Nachfolger durchgeführt
[ ] Account-/E-Mail-Handover an Kunde abgeschlossen
[ ] Hypercare-Zeitraum definiert (Empfehlung: 2 Wochen mit täglichem Check-in)
[ ] Rollback-Plan für den Go-live-Tag selbst dokumentiert
```

---

## 9. Hypercare

Nach Go-live: 2-wöchiger Zeitraum mit täglicher Erreichbarkeit für kritische Störungen. Fokus auf reale Nutzungsmuster von Franz Kreile und Sohn — Abweichungen von den simulierten Personas (Dok. 04) werden dokumentiert und fließen in Phase 9 (kontinuierliche Weiterentwicklung) ein.

---

## 10. Rollback

Für jeden Deploy gilt: Git-Tag vor Deploy + DB-Snapshot vor Migration sind Pflichtvoraussetzung (siehe Dok. 00 Prinzip 9, Dok. 07 Phase 0). Rollback-Fähigkeit wird vor dem ersten Produktions-Deploy einmal real geübt, nicht nur theoretisch dokumentiert.

---

*Eine Einstufung als „VOLLSTÄNDIG LIVE UND ÜBERGEBEN" (siehe Dok. 11 für Statuskonventionen) ist erst zulässig, wenn alle Punkte in Abschnitt 7 und 8 nachweislich erfüllt sind.*
