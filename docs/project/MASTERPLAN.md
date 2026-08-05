# Masterplan

Stand: 2026-08-05

## North Star

Das Galvanik-Kreile WerkstattCockpit verwandelt einen papiergefuehrten, inhaberabhaengigen Handwerksbetrieb in ein transparentes, planbares und uebergabefaehiges Unternehmen.

Primaerer Kundennutzen:

1. Kontrolle und Planbarkeit fuer den Inhaber.
2. Reibungsarme Erfassung fuer alle Rollen.
3. Durchgaengiger Wertstrom Eingang -> Produktion -> Ausgang.
4. Belegte Entscheidungen statt Bauchgefuehl oder Schattenlisten.
5. Kein zusaetzlicher Bueroaufwand fuer die Produktion.

## Liefermodell

- `main` ist die einzige Code-Lieferwahrheit.
- Vercel Production und Supabase Production sind getrennte Runtime-Wahrheiten und muessen gegen `main` belegt werden.
- Jede Mission hat einen isolierten Worktree, genau einen Writer und einen unabhaengigen Reviewer.
- Umsetzung erfolgt ueber kleine PRs, reproduzierbare lokale Nachweise, GitHub-Gates, Vercel Preview und Red-Team-Abnahme.
- Alt-Arbeit wird nicht pauschal gemergt oder geloescht. Sie wird klassifiziert, als Salvage erhalten und nur ueber neue kleine PRs verwertet.
- Ein gemergter Infrastruktur- oder Security-Baustein ist kein Gesamtprodukt-PASS.

## Verbindliche aktive Reihenfolge

**Recovery-Gate 2026-08-05:** Vor weiterer Struktur- oder Offline-Arbeit schliesst
`FOUNDATION-RECOVERY-001` ausschliesslich die live verifizierten Luecken in
Migrationswahrheit, Data-API-Grants, PIN-Bestand/Rate-Limit und oeffentlichem
Start-Payload. Das ist kein neuer Masterplan und keine Ordner-Grossoperation.

### Phase 0 - Wahrheiten und Arbeitsflaeche

1. `TRUTH-CLEANUP-001`
   - lokale Worktrees inventarisieren und aktive Kandidaten sauber isolieren,
   - GitHub `main`, offene PRs, Vercel Production sowie Supabase Production/Integration live abgleichen,
   - bestehende kanonische Dokumente aktualisieren,
   - alte Draft-PRs erst nach exaktem Archiv-/Diff-Inventar dispositionieren,
   - externen Windows-Dirty-Checkout getrennt als `UNKNOWN_EXTERNAL` behandeln.

2. `QUALITY-RATCHET-001`
   - aktuellen globalen ESLint-Bestand maschinenlesbar festhalten,
   - jede Erhoehung in CI blockieren,
   - keine `eslint-disable`-, Ignore- oder Regelabsenkungs-Abkuerzung.

`LINT-DEBT-001` ist mit PR #31 bei ESLint 0/0 abgeschlossen. Der Ratchet bleibt
verbindlich und darf fuer Recovery-, Security- oder DB-Arbeit nicht abgesenkt werden.

3. `BRANCH-DISPOSITION-001`
   - fuer PR 8, 15, 19 und 20 exakten Head, historischen PR-Base und aktuellen Merge-Base erfassen,
   - Unique-Commit-/Dateiinventar und dedizierten Archivref erzeugen,
   - erst danach PR mit Dispositionskommentar schliessen; Quellbranch nicht loeschen.

### Phase 1 - Identitaet, Datenbankwahrheit und Strukturvertrag

4. `AUTH-IDENTITY-002`
   - PR-8-Salvage gegen `main` vergleichen,
   - Rolle, Name, Initialen, Permissions und Status als einen atomaren Identity-Snapshot aktualisieren,
   - MK -> Admin -> MK ohne alte Session-, Storage- oder UI-Reste,
   - echten Benutzerwechsel und abgelaufene Sitzung im Browser pruefen.

5. `DB-TRUTH-001`
   - alle 96 angewandten Production-Versionen mit Name und Statement-Hash abbilden,
   - einen vorwaertsgerichteten Manifest-/Replay-Vertrag definieren,
   - Production, Integration, Drizzle und lokale Migrationen vor jeder Mutation vergleichen,
   - keine alte, nachtraeglich umgeschriebene Historie als neue Wahrheit ausgeben.

6. `APP-STRUCTURE-001`
   - Zielgrenzen aus `MODULARITY_STRATEGY.md` als Import-/Ownership-Vertrag festlegen,
   - keine Big-Bang-Verschiebung,
   - erste Modulgrenze fuer den operativen Kern vorbereiten, noch ohne breiten Feature-Umbau.

Breite Struktur- oder Feature-Umbauten beginnen erst, wenn Truth-Dokumente, lokaler Arbeitsstand und Quality-Ratchet verbindlich sind. Der vollstaendige Lint-Nullstand ist Ziel der parallelen Debt-Wellen, aber keine Ausrede, P0-, Auth- oder DB-Fixes aufzuschieben.

### Phase 2 - P0-Sicherheit und Betriebsgrundlage

7. `SEC-PIN-002B`
   - Device-Enrollment/Bindung oder gleichwertige Online-Challenge fuer die kleine vierstellige PIN-Zielmenge,
   - source- und accountbezogener Fehlversuchsschutz ohne Pool-Erschoepfung,
   - Session-Widerruf bei PIN-/Rollenwechsel,
   - kontrollierte Rotation bestehender operativer Nutzer,
   - abschliessender Plaintext-Ausschluss und negativer Browser-/DB-Nachweis.

8. `RLS-CONTRACT-001`
   - reale Rollen, Geräte, Tenant-Grenzen, Grants, Views und Serverzugriffe read-only kartieren,
   - jede Relation fail-closed klassifizieren,
   - danach kleine relationenweise RLS-PRs mit Integrationstest und Advisor-Delta.

9. `OFFLINE-SHELL-001`
   - genau eine Service-Worker-Registrierung,
   - HTML, CSS, JS, Fonts und Kernassets offline,
   - sichere Navigation-Fallbacks,
   - keine Auth-/API-Antworten im allgemeinen Runtime-Cache.

### Phase 3 - Operativer Vertikalschnitt

10. `OPERATIVE-SLICE-001`

```text
Kunde
-> Minimalauftrag
-> Behaelter/Kiste mit QR-Identitaet
-> Teil
-> zugewiesene Arbeitsaktion
-> Today-SQL-Read-Model
-> idempotentes Receipt
-> Reload-Readback
```

Der Ablauf muss mit realem berechtigtem Nutzer auf Tablet und Desktop funktionieren. Loading, Empty, Error, Data, Audit und Tenant-Negativfall gehoeren zur Abnahme.

11. `OFFLINE-48H-001`
   - genau eine Outbox,
   - vorher vollstaendiges Store-/Versions-/Payload-Inventar aller bestehenden IndexedDB-, Service-Worker- und Local-Storage-Warteschlangen,
   - idempotenter Import/Drain bekannter Eintraege und Quarantaene unbekannter Payloads statt Loeschung,
   - sichtbarer Nutzerstatus, Export-/Recovery-Weg und Rollback fuer noch wartende Geraeteaktionen,
   - Neustart, Retry, Idempotenz und Konfliktanzeige,
   - kein simuliertes Erfolgsloeschen,
   - realer 48-Stunden-Tablet-Nachweis.

### Phase 4 - Reibungsarme Erfassung

12. `CAPTURE-ORIGINAL-001`
    - ein kanonischer Originalvertrag vor OCR und Zuordnung.

13. `OFFLINE-CAPTURE-001`
    - Foto/Datei offline sichern, Neustart ueberstehen und genau einmal synchronisieren.

14. `APP-0001D-A`
    - Kamera und Datei-Upload als getrennte sichtbare Wege,
    - Tablet-Rueckkamera, Abbruch, Wiederholung und Berechtigungsfehler.

15. `APP-0001D-B`
    - OCR, privater Storage, `item_photos`, Signed URLs, Tenant-/Auth-Pruefung und Orphan-Cleanup.

16. `OCR-REVIEW-001` und `CAPTURE-ASSIGN-001`
    - Konfidenz je Feld,
    - nur unsichere Felder pruefen,
    - Kunde, Auftrag und Teilgruppe sicher vorschlagen.

### Phase 5 - Erster sichtbarer USP-Beweis

17. `FIRST-WARENEINGANG-E2E-001`

```text
Foto oder Dokument
-> Original gesichert
-> Kunde
-> Auftrag
-> Teil
-> Wareneingangsereignis
-> Timeline
-> Produktionskarte
-> Reload
-> weiterhin vorhanden
```

Dieser Ablauf ist der erste verkaufsrelevante End-to-End-Meilenstein.

## Danach geschuetzte Produktroadmap

1. Auftragstimeline und Kundenakte.
2. Kommunikation und Telefonnotiz.
3. Warenausgang, QS und Reklamation.
4. Buchhaltung, Rechnungen, Zahlungen und Export.
5. Kontroll-Cockpit, Liquiditaet und Investitionsplanung.
6. Such-Gehirn und KI-Entscheidungen mit Quellen und Konfidenz.
7. Marketing-Attribution und Kundenreaktivierung.
8. Lager, Baeder, Energie, Qualitaet und KVP.
9. Backup/Restore, Observability, Performance/Jank und Go-live-Haertung.
10. `LEDGER-CORE-PREP-001` und spaeter einmalig `LEDGER-CORE-EXTRACT-001`, sobald der Buchkern real stabil ist.

Keiner dieser Punkte ist gestrichen. Status, Abhaengigkeiten und Verschiebungsgruende stehen in `NON_LOSS_REGISTER.md`.

## Nutzer-Twins

- **Rolf:** Desktop; Kontrolle, Geld, Termine, Freigaben und Planbarkeit.
- **Philipp:** Tablet; Produktion, naechste Handlung und Zahlen ohne Mehrarbeit.
- **Michael:** stark gefuehrte Aufnahme, Telefon, E-Mail, Eingang und Ausgang.

## STOPP-Regeln

- Ein neuer P0-Befund darf die aktive Reihenfolge nur aendern, wenn er Login, Datenintegritaet, Sicherheit, Offline-Arbeitsfaehigkeit oder den zentralen Erfassungsweg real blockiert.
- Ein neuer Fehler ist nicht automatisch P0; Schweregrad und reproduzierbarer Nachweis sind Pflicht.
- Kein Struktur-Big-Bang auf einem roten oder ungeklärten Truth-/Quality-Vertrag.
- Kein Merge einer grossen Alt-Branch, nur weil sie mehr Funktionen oder Tests enthaelt.
- Keine historische Migrationsumschreibung als Ersatz fuer einen vorwaertsgerichteten Vertrag.
- Kein P0-Abschluss ohne reproduzierbaren Angriffsfall, legitimen Kontrollfall und unabhaengige Abnahme.
- Keine Cockpit-Zahl ohne reale Datenquelle, Definition und Reload-Nachweis.
- Keine weitere Agentur-/Control-Plane-Runde ohne konkreten Lieferblocker.
