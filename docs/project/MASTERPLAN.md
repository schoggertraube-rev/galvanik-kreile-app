# Masterplan

Stand: 2026-08-27

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
- Nach Abschluss von M0 wird ausschliesslich im kanonischen Checkout `02_app` auf einem sauberen
  kurzen Paketbranch vom live aktuellen `main` gearbeitet; es entsteht kein neuer Worktree pro
  Mission. Ein historischer Handoff-SHA ist niemals die Implementierungsbasis.
- Jedes Paket hat genau einen Writer und einen unabhaengigen Exact-SHA-Reviewer. Ueber alle Lanes
  hinweg gilt `single_active_code_writer_across_frontend_and_f1 = true`: insgesamt genau EIN aktiver
  Code-Writer, nicht je Teilphase einer. Frontend-Writer und F1-Writer laufen niemals parallel;
  read-only Reviewer und Inventare duerfen parallel laufen.
- Umsetzung erfolgt ueber kleine PRs, reproduzierbare reale E2E-Nachweise, GitHub-Gates und
  unabhaengige Abnahme. Preview oder Deployment erfolgen nur, wenn das Paket sie ausdruecklich verlangt.
- Alt-Arbeit wird nicht pauschal gemergt oder geloescht. Sie wird klassifiziert, als Salvage erhalten und nur ueber neue kleine PRs verwertet.
- Ein gemergter Infrastruktur- oder Security-Baustein ist kein Gesamtprodukt-PASS.

## Verbindliche aktive Reihenfolge

1. `M0_REPOSITORY_CONSOLIDATION`: verlustfrei archivieren, genau eine Steuerungs- und Lieferlinie
   herstellen, den F1-R0-Kandidaten integrieren und `02_app` auf sauberes aktuelles `main` bringen.
2. `F1-R0_NO_FAKE_PRODUCTION_GATE`: `REACHABLE_PRODUCTION_MOCKS=0`,
   `UNREGISTERED_VISIBLE_CAPABILITIES=0`, `ACTIVE_CAPABILITY_REAL_E2E=PASS` und unabhaengiger
   Exact-SHA-PASS. R0-A allein ist kein R0-PASS.
3. `F1.2_WERKSTATTDURCHLAUF`
4. `F1.3_LEISTUNGSABSCHLUSS`
5. `F1.4_UNVERAENDERLICHE_RECHNUNG`: Vertragsinhalt ist vom Owner vollstaendig ratifiziert; offen ist
   nur der Implementierungs- und Vertragsabgleich (`RATIFIED_CONTRACT_DRIFT`, `FAIL_INTERNAL`).
6. `F1.5_BESTAETIGTER_ZAHLUNGSEINGANG`: `PENDING_OWNER_RATIFICATION`; Baustart ausschliesslich nach
   F1.4-Merge und neuer Owner- plus Orchestrator-Ratifikation/Startfreigabe. Bis dahin kein
   F1.5-Code, keine F1.5-Migration, keine F1.5-Evidence.
7. `F1.6_REALER_PILOT`

F1.1 Digitaler Wareneingang ist unabhaengig abgenommen und wird nicht erneut geoeffnet, solange sein
Vertrag unveraendert bleibt. Jedes folgende Paket liefert Quelle -> sicherer Vertrag -> Mutation ->
Receipt -> Reload/Readback -> UI-Zustaende -> positiven und negativen realen Nachweis.

## Parallele Frontend-Lane (2026-08-27, als Paket ratifiziert, Implementierung nicht begonnen)

Die Reihenfolge F1.4 -> F1.5 -> F1.6 bleibt unveraendert. Der Owner hat das Frontend als
Parallelpaket ratifiziert; es laeuft unter `missions/FRONTEND_IMPLEMENTATION_001.yml`, ohne Pfad-,
Migrations- oder Datenwahrheitsueberlappung mit der Order-to-Cash-Lane und ohne neue Datenbank-,
Auth- oder Session-Wahrheit.

Es gibt zwei autorisierte Paket-Lanes, nicht zwei aktive Implementierungen. Belegter Lane-Status ist
heute ausschliesslich `PARALLEL_PLANNING_ACTIVE` / `IMPLEMENTATION_NOT_STARTED`; aktiv ist nur die
Parallelplanung. Disjunktheit der Implementierung ist erforderlich, aber noch nicht belegt und wird
nicht behauptet. Es gilt `single_active_code_writer_across_frontend_and_f1 = true`: insgesamt genau
EIN aktiver Code-Writer ueber Frontend und F1 hinweg; Frontend- und F1-Writer laufen nie parallel,
read-only Reviewer und Inventare duerfen parallel laufen. Ein Frontend-Writer startet erst mit einem
von den Projektregeln erlaubten sauberen kurzen Paketbranch vom live aktuellen `main` (kein
historischer Handoff-SHA als Basis), ohne laufenden F1-Writer oder F1-Gate und mit vorab berechneter
exakter Produkt-Allowlist, deren Schnittmenge zur aktiven Order-to-Cash-Allowlist 0 ist. Kein neuer
Worktree und kein Clone ohne gesonderte Autoritaet. Ist die Trennung nicht beweisbar, wird
sequenziell gearbeitet: erst F1.4 korrigieren und mergen, danach der Frontend-Writer.

1. Phase 0 `INVENTAR_UND_RECONCILE`, read-only: bestehende Routen, Rollen, Tokens, Komponenten und
   die real vorhandenen F1.2/F1.3-Read-Ports inventarisieren; die exakten ratifizierten
   Visual-Referenzdateien aller vier Zieloberflaechen wiederfinden, erhalten und per SHA-256 und
   Bytegroesse binden. Ohne gebundene Referenz entsteht kein UI-Code und wird nicht nach Gefuehl
   gestaltet. Phase 0 darf im aktuellen dirty F1-Checkout read-only inventarisieren; der Modus
   `READ_ONLY` ist keine implizite Repo-Schreibfreigabe. Read-only Auditoutputs bleiben getrennt von
   spaeteren Evidence- oder Missionsschreibungen, die den oben genannten sauberen Kontext brauchen.
   Phase 0 liefert zusaetzlich den exakten Route-Binding-Output `PHILLIP_WERKSTATT_V4` ->
   `/warendurchlauf` samt darunterliegender Stationsunterseiten und muss das harte
   `PHILLIP_ROUTE_BINDING_GATE` bestehen; ohne dieses Gate darf Phase 1 nicht schreiben.
2. Phase 1: genau EIN Phillip-Proofscreen "Werkstatt" auf `/warendurchlauf` als rollenbasierter
   Werkstatt-Einstieg gegen die echten Station-Queue-, Intake-, Evidence- und Auftrags-Ports;
   Stationsunterseiten liegen ausschliesslich darunter, es entsteht keine neue Dashboardroute und es
   gibt keine Demo- oder Mockdaten.
3. Danach nach demselben Muster Rolf "Der Tag" auf `/cockpit`, dann Auftragskarte, dann Kundenkarte.

Ratifizierte Zieloberflaechen: Rolf "Der Tag" V8, Phillip "Werkstatt" V4, Auftragskarte
`MACHART_V8`, Kundenkarte `MACHART_V2`. Ratifiziert heisst ausschliesslich: die vier Zielbildnamen
sind bestaetigt; implementiert ist davon nichts. Diese Namensratifikation ist eigene
Metadatenwahrheit und ersetzt weder gebundene Referenzassets noch `UI_REFERENCE_PASS` oder
`OWNER_UX_PASS`.

Bindende Routen- und Dispositionsentscheidung:

- `/cockpit` ist die einzige Rolf-Oberflaeche "Der Tag"; es ist die bestehende rollenbegrenzte
  Chefroute mit Read-Ports.
- `/start` bleibt ausschliesslich Login- und Sessiongrenze.
- `/` wird spaeter serverseitiger Rollenrouter: admin/Rolf -> `/cockpit`; developer -> `/settings`;
  `werkstatt`, `meister` und `buero` -> `/warendurchlauf`. Eine Rolle `inhaber` wird nicht
  eingefuehrt und bleibt verboten.
- `/today` und `/kontrolle` werden spaeter ausschliesslich Kompatibilitaetsaliase auf `/`, ohne
  eigenes Dashboard und ohne eigene Datenwahrheit. Es entsteht kein fuenftes Dashboard.
- Die Baeder-Disposition laeuft als eigener kleiner Task `BAEDER_DISPOSITION_001`, nicht als
  Frontend Phase 1, und ist noch nicht erledigt. Akzeptanz: alle sichtbaren `/baeder`-Links und
  Baeder-Bezeichnungen sind aus der produktiven Navigation entfernt; `/baeder` leitet nach
  `/warendurchlauf/galvanik` um; `/performance/baeder-material` ist entfernt oder leitet identisch
  um; es existiert kein erreichbarer toter oder gemockter Bath-Adapter; Galvanik bleibt exakt ein
  Step. Tabellen, Daten, Migrationen und Provenienz bleiben technische `PROTECTED_SALVAGE`; keine
  Remote- oder Datenloeschung. Es entsteht keine Baeder-UI und kein spaeteres Baeder-Produktziel.

Verbindliche UI- und Statusgates der Lane (Details in der Mission):

- Screenshotmatrix exakt `390x844`, `768x1024`, `1024x768`, `1366x1024`, `1440x900`.
- Getrennte Statusachsen `FUNCTIONAL_SLICE_PASS`, `DATA_TRUTH_PASS`, `UI_REFERENCE_PASS`,
  `OWNER_UX_PASS`, `PRODUCT_READY`; Initialwerte `NOT_STARTED` beziehungsweise `false`.
  `OWNER_UX_PASS` steht auf `OPEN_NOT_GRANTED`, blockiert den Merge ausdruecklich nicht und wird
  niemals als erteilt dargestellt.
- Merge-Autoritaet aus dem Autonomie-Mandat, semantisch getrennt: `authority_status:
  STANDING_GRANTED`, `additional_owner_merge_approval_required: false`, `valid_from: 2026-08-27`,
  `valid_until: NEXT_REAL_JOINT_OWNER_ORCHESTRATOR_DECISION`, `owner_ux_pass_blocks_merge: false`.
  Das Mandat ist weiterhin gueltig; sein Teil 3 war Abschluss derselben Uebergabe und keine
  Revokation. Davon getrennt steht die Reife des konkreten Pakets: `eligibility_status: NOT_MATURED`,
  weil noch nicht alle mergeblockierenden Gates am exakten SHA gruen sind, der Scope-Abgleich offen
  ist und Review, CI und E2E noch nicht `PASS` melden. Die Autoritaet ist also erteilt, das konkrete
  Paket ist heute noch nicht merge-eligible. Manuelle Production-Promotion und manueller Deploy
  bleiben `FORBIDDEN`; ein bereits bestehendes automatisches Vercel-Deployment als Folge eines
  spaeter autorisierten `main`-Merges wird nicht manuell ausgeloest, sondern danach nur beobachtet
  und belegt.

## Historische Vor-F0-Roadmap (Erhalt, nicht aktive Ausfuehrungsreihenfolge)

Der folgende Planstand vom 2026-08-05 bleibt als Produkt- und Herkunftsschutz erhalten. Er darf die
oben festgelegte aktive F1-Reihenfolge nicht ueberschreiben.

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
8. Lager, Energie, Qualitaet/QS und KVP. Baeder sind nach `D-ARCH-010` kein Produktziel und keine
   Roadmapzeile; sie existieren ausschliesslich als technische `PROTECTED_SALVAGE` unter
   `BAEDER_DISPOSITION_001` (Tabellen, Daten, Migrationen, Provenienz) ohne Baeder-UI.
9. Backup/Restore, Observability, Performance/Jank und Go-live-Haertung.
10. `LEDGER-CORE-PREP-001` und spaeter einmalig `LEDGER-CORE-EXTRACT-001`, sobald der Buchkern real stabil ist.

Keiner dieser Punkte ist gestrichen. Status, Abhaengigkeiten und Verschiebungsgruende stehen in `NON_LOSS_REGISTER.md`.

## Nutzer-Twins

- **Rolf:** Desktop; Kontrolle, Geld, Termine, Freigaben und Planbarkeit.
- **Phillip:** Tablet; Produktion, naechste Handlung und Zahlen ohne Mehrarbeit.
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
- Kein UI-Code der Frontend-Lane, bevor Phase 0 die exakten Referenzassets aller betroffenen
  Oberflaechen mit SHA-256 und Bytegroesse gebunden hat; ein bekannter HTML-Kandidat wird nicht
  still zur Autoritaet erklaert.
- Kein Teilgate der Frontend-Lane wird als Gesamt-PASS, als Merge oder als Produktreife dargestellt.
