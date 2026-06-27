# Masterplan

Stand: 2026-06-27

## North Star

Das Galvanik-Kreile WerkstattCockpit verwandelt einen papiergefuehrten, inhaberabhaengigen Handwerksbetrieb in ein transparentes, planbares und uebergabefaehiges Unternehmen.

Primaerer Kundennutzen:

1. Kontrolle und Planbarkeit fuer den Inhaber.
2. Reibungsarme Erfassung fuer alle Rollen.
3. Durchgaengiger Wertstrom Eingang -> Produktion -> Ausgang.
4. Belegte Entscheidungen statt Bauchgefuehl oder Schattenlisten.
5. Kein zusaetzlicher Bueroaufwand fuer die Produktion.

## Liefermodell

- `main` ist die einzige Lieferwahrheit.
- Eine Mission hat genau einen Writer und einen unabhaengigen Reviewer.
- Umsetzung erfolgt ueber kleinen PR, GitHub `quality`, Vercel Preview und explizite Merge-/Production-Freigabe.
- Alt-Arbeit wird nicht pauschal gemerged oder geloescht, sondern ueber neue kleine PRs verwertet.

## Aktive Reihenfolge

### Phase 0 – Plan- und Dokumentwahrheit

1. `PLAN-SYNC-001` - abgeschlossen mit PR 7
   - `AGENTS.md`, Masterplan und Current State aktualisieren.
   - Dokumentenautoritaet festlegen.
   - Non-Loss-Register anlegen.
   - Keine Altdatei automatisch loeschen.

### Phase 1 – P0-Stabilitaet und Sicherheit

2. `AUTH-IDENTITY-002`
   - MK -> Admin -> MK ohne alte Rolle, Initialen, Rechte, Local-Storage-, Supabase- oder App-Sessionreste.
   - Production-Debug-/Tablet-Bypass entfernen.
   - Identitaet im PermissionsProvider vollstaendig aktualisieren.

3. `OFFLINE-SHELL-001`
   - genau eine Service-Worker-Registrierung,
   - HTML, CSS, JS, Fonts und Kernassets offline,
   - sichere Navigation-Fallbacks,
   - keine Auth-/API-Antworten im allgemeinen Runtime-Cache.

4. `OFFLINE-48H-001`
   - Outbox, Neustart, Retry, Idempotenz, Konflikte und sichtbarer Sync-Status,
   - realer Tablet-Test ueber den geforderten Zeitraum.

5. `SEC-PIN-002`
   - PINs hashen,
   - Default-PIN entfernen,
   - bestehende Nutzer kontrolliert migrieren,
   - Fehlversuchsschutz ohne Aussperren.

### Phase 2 – Reibungsarme Erfassung

6. `CAPTURE-ORIGINAL-001`
   - ein kanonischer Originalvertrag vor OCR und Zuordnung.

7. `OFFLINE-CAPTURE-001`
   - Foto/Datei offline sichern, Neustart ueberstehen und genau einmal synchronisieren.

8. `APP-0001D-A`
   - Kamera und Datei-Upload als getrennte sichtbare Wege,
   - Tablet-Rueckkamera, Abbruch, Wiederholung, Berechtigungsfehler.

9. `APP-0001D-B`
   - OCR, privater Storage, `item_photos`, Signed URLs, Tenant-/Auth-Pruefung und Orphan-Cleanup,
   - Remote-Schema, Migrationshistorie und Drizzle vor jeder DB-Aenderung abgleichen.

10. `OCR-REVIEW-001` und `CAPTURE-ASSIGN-001`
    - Konfidenz je Feld,
    - nur unsichere Felder pruefen,
    - Kunde, Auftrag und Teilgruppe sicher vorschlagen.

### Phase 3 – Erster sichtbarer USP-Beweis

11. `FIRST-WARENEINGANG-E2E-001`

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
3. Buchhaltung, Rechnungen, Zahlungen und Export.
4. `LEDGER-CORE-PREP-001`, sobald die Buchhaltungsstruktur ausreichend stabil ist.
5. `LEDGER-CORE-EXTRACT-001` erst nach produktiver Stabilitaet und belegter End-to-End-Nutzung.
6. Weitere Kandidaten wie Capture, Suche, Timeline, Offline-Outbox und Analyse werden erst anhand realer stabiler Vertraege katalogisiert.
7. Kontroll-Cockpit, Liquiditaet und Investitionsplanung.
8. Such-Gehirn und KI-Entscheidungen mit Quellen und Konfidenz.
9. Marketing-Attribution und Kundenreaktivierung.
10. Lager, Baeder, Energie, Qualitaet, Reklamationen und KVP.
11. Backup/Restore, Performance/Jank und Go-live-Haertung.

Keiner dieser Punkte ist gestrichen. Status, Abhaengigkeiten und Verschiebungsgruende stehen in `NON_LOSS_REGISTER.md`.

## Modularitaet und Wiederverwendung

- Kreile bleibt Referenzprodukt und wird zuerst stabil und verkaufsfaehig.
- Neue oder geaenderte Module werden fortlaufend ueber stabile Vertraege, Provider-/Port-Schnittstellen, Typen, Props und zentrale Konfiguration entkoppelt.
- Kreile-spezifische Begriffe, Rollen, Tenant-Werte, Tabellen und UI-Texte bleiben ausserhalb wiederverwendbarer Kerne.
- Waehrend Auth-, Offline- und Capture-P0-Arbeit erfolgt keine vorschnelle Paketextraktion.
- Erstes Zielmodul ist `ledger-core`.
- `LEDGER-CORE-PREP-001` bleibt reine Analyse: Inventar, Cross-Imports, Direktzugriffe, gemeinsame Typen und spaetere Modulgrenze; keine Verschiebungen, Importaenderungen oder Extraktion.
- `LEDGER-CORE-EXTRACT-001` folgt erst nach stabiler Kreile-Buchhaltung und belegter End-to-End-Nutzung; Kreile bleibt Referenzkonsument, weitere Apps nutzen Adapter.
- Verbindliche Detailregeln stehen in `docs/project/MODULARITY_STRATEGY.md`.

## Nutzer-Twins

- **Rolf:** Desktop; Kontrolle, Geld, Termine, Freigaben und Planbarkeit.
- **Philipp:** Tablet; Produktion, naechste Handlung und Zahlen ohne Mehrarbeit.
- **Michael:** stark gefuehrte Aufnahme, Telefon, E-Mail, Eingang und Ausgang.

## STOPP-Regeln

- Neuer P0-Befund darf die aktive Reihenfolge nur aendern, wenn er den Login, Datenintegritaet, Sicherheit, Offline-Arbeitsfaehigkeit oder den zentralen Erfassungsweg real blockiert.
- Ein neuer Fehler wird nicht automatisch zum P0; Schweregrad und reproduzierbarer Nachweis sind Pflicht.
- Keine weitere Control-Plane- oder Agentur-Ausbaurunde ohne konkreten Lieferblocker.
