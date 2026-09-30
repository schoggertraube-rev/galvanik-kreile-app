<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Steckbrief

**Zweck:** G05 stellt eine verlässliche, tenant-isolierte Kundenwahrheit für Kundenliste, Kundenkarte, Anlage und die Zuordnung zu Aufträgen bereit. Das Modul besitzt Kundenidentität und Kundenstammdaten; Aufträge und Historie liest es ausschließlich über öffentliche Orders-Ports. (Beleg: `01_ANFORDERUNGSKATALOG.md`; `04_SCHNITTSTELLEN_DATEN.md`)

**Stufe:** Grundstamm. (Beleg: `..\00_PROJEKT\PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md`, Phase 2, T-02 und T-11)

**Dossier-Status:** BAUBEREIT — die offenen Struktur- und Designfragen sind in `08_OFFENE_FRAGEN.md` begrenzt und bis zur Entscheidung nicht klickbar als „In Klärung“ ausgewiesen. (Beleg: `08_OFFENE_FRAGEN.md`; `10_CHECKLISTE.md`)

**Modul-Status:** ADOPTIERT — der reale Customer-Kern liegt auf `origin/main`; Zieloberfläche, Designsystem-Umbau und die als fehlend ausgewiesenen Funktionen sind noch nicht vollständig geliefert. (Beleg: `09_QUELLEN_AKTUALITAET.md`; `11_IST_CODE_UMBAU.md`)

**Zuständige Session:** Grundstamm-PL-Kontext, Session `01a0ce4b` (kein Resume). (Beleg: `AUFTRAG_DOSSIER.md`)

**Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\G05_KUNDEN`. (Beleg: `AUFTRAG_DOSSIER.md`; `AUFTRAG_NACHARBEIT_2026-09-26.md`)

**Code-Pfad:** `02_app/src/modules/customers`; Referenzartefakt `02_app/src/modules/customers/customers.manifest.json`, SHA-256 erste 12: `63F9F9BA042C`. (Beleg: `09_QUELLEN_AKTUALITAET.md`; `11_IST_CODE_UMBAU.md`)

**Braucht:** Session-/Tenant-, Permission- und Clock/Correlation-Host-Ports, den öffentlichen Orders-Read-Port, den Conflict-Sink und den Kreile-HostAdapter. (Beleg: `04_SCHNITTSTELLEN_DATEN.md`, Abschnitt „Host-Ports“)

**Wird gebraucht von:** Intake/App für Kundenanlage, Suche und Audit/Projektionen über `CUSTOMER_CREATED_V1` sowie Accounting/Rechnung für Kundenanschrift, Rechnungsempfänger und Zahlungsziel. (Beleg: `04_SCHNITTSTELLEN_DATEN.md`, Abschnitte „Modulgrenze“, „Öffentliche Modul-Ports“ und „Ereignisse“)

**Anbindungszeitpunkt + Gate:** Der belegte Kern ist bereits adoptiert; der weitere Grundstamm-Umbau erfolgt in Phase 2 über T-02 und T-11, nachdem Plan, Designsystem und Dossierstatus gelten, und durchläuft anschließend das Owner-UX-Gate der Phase 3. (Beleg: `..\00_PROJEKT\PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md`, Zeilen „Bau-Voraussetzung“, Phase 2 T-02/T-11 und Phase 3)

**Bis dahin im Grundstamm:** Dublettenschutz, Bearbeiten, Telefonnotiz, Aufbewahrung, Fotos/Dokumente und Kundenkonditionen sind nicht klickbare Elemente; Status `In Klärung`, wörtlicher Text `In Klärung`. (Beleg: `08_OFFENE_FRAGEN.md`, Q-G05-001 bis Q-G05-003 und Q-G05-006 bis Q-G05-008)

**Übertragbarkeit:** Kern app-neutral: ja — Customer-/Contact-/Address-/Receipt-Verträge bleiben neutral; Kreile-spezifische Bezeichnungen, Navigation und Komposition liegen ausschließlich im Kreile-HostAdapter. (Beleg: `04_SCHNITTSTELLEN_DATEN.md`, Abschnitt „Übertragbarkeit“; `AUFTRAG_DOSSIER.md`, Nachtrag 2)

**Rate-Stellen aus Red-Team:** RT-10, RT-16, RT-18, RT-19, RT-22, RT-28, RT-30. (Beleg: `..\00_PROJEKT\REDTEAM_BUILDER_2026-09-26.md`; `06_ENTSCHEIDUNGEN.md`)

**Stand:** 2026-09-26; geprüft gegen den lokal gecachten Tracking-Stand `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`, ohne bestätigten Remote-Abgleich. (Beleg: `09_QUELLEN_AKTUALITAET.md`)

**Bearbeiter:** Codex (Writer der Dossier-Erstellung und dieser Nacharbeit); unabhängige Prüfung: Sonnet, 2026-09-26. (Beleg: `AUFTRAG_DOSSIER.md`; `AUFTRAG_NACHARBEIT_2026-09-26.md`)

**Modul-ID:** `G05_KUNDEN`. (Beleg: `AUFTRAG_DOSSIER.md`)

**Tenant:** `galvanik-kreile`. (Beleg: `..\..\AGENTS.md`)

**Hauptnutzer:** Rolf, Phillip und Michael; grundsätzlich dürfen alle Personen alles, der Admin kann Rechte je Person sperren oder erweitern. (Beleg: `02_FUNKTIONEN_ABLAEUFE.md`; `06_ENTSCHEIDUNGEN.md`, OE-2609-09)

**Einstieg:** `/customers` für Liste/Suche, `/customers/[id]` für die Kundenkarte und der globale Anlageweg „Kunde“. (Beleg: `02_FUNKTIONEN_ABLAEUFE.md`; `03_OPTIKVORLAGE.md`; `11_IST_CODE_UMBAU.md`)

**Besitz:** Kunden-ID, Kundennummer, Kundenstammdaten, Kontakte, Anschrift, Kommunikationspräferenz, interne Hinweise/Eigenheiten sowie kundenbezogene Lese- und Schreibverträge. (Beleg: `04_SCHNITTSTELLEN_DATEN.md`, Abschnitte „Modulgrenze“ und „Datenmodell“)

**Fremddaten:** Aufträge und Historie nur über öffentliche Orders-Ports; Rechnungsempfänger und Zahlungsziel sind Kundenkonfiguration, die Ausführung liegt in den zuständigen Auftrags-/Rechnungsmodulen. (Beleg: `04_SCHNITTSTELLEN_DATEN.md`)

**Verbindliche UI:** `KREILE_GESAMTMOCK_V5_2026-09-14.html` für das Grundsystem und `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` für die Kundenkarte; MODULKARTE, D-UI-V5-003 und Owner-Entscheidungen begrenzen beide. (Beleg: `03_OPTIKVORLAGE.md`; `09_QUELLEN_AKTUALITAET.md`)

**Reale Ausgangslage:** Auf `origin/main@21a23567d51e` sind Kundenliste, Kundenkarte, Such-/Filterleseweg und abgesicherte Kundenanlage mit Receipt/Readback vorhanden. Die Oberfläche nutzt noch Mock-CSS und ist nach Designphase 1 auf das `kr-`-Designsystem umzubauen. (Beleg: `09_QUELLEN_AKTUALITAET.md`; `11_IST_CODE_UMBAU.md`)

**Nicht gebaut:** Sicheres Ändern, belastbarer Dublettenschutz, Telefonnotiz-Schreibweg, Aufbewahrungs-/Anonymisierungsmechanik, Fotos/Dokumente und strukturierte Preisvereinbarungen; diese Funktionen werden nicht vorgetäuscht. (Beleg: `01_ANFORDERUNGSKATALOG.md`; `08_OFFENE_FRAGEN.md`; `11_IST_CODE_UMBAU.md`)

**Explizit nicht im Modul:** Marketing/Analyse, LTV/Marge/Risikoscore, automatische Mails, Buchhaltungsausführung, Auftragswahrheit, eigener Kalender sowie Funktionen anderer Zielapps. (Beleg: `01_ANFORDERUNGSKATALOG.md`; `04_SCHNITTSTELLEN_DATEN.md`; `09_QUELLEN_AKTUALITAET.md`)

**Liefergrenze:** Kein Provider, keine Remote-Migration, kein Deployment und keine Echtdatenänderung; neue dauerhafte Tabellen, Provider oder Schreibwege erst nach den Entscheidungen aus `08_OFFENE_FRAGEN.md`. (Beleg: `AUFTRAG_DOSSIER.md`; `AUFTRAG_NACHARBEIT_2026-09-26.md`; `08_OFFENE_FRAGEN.md`)

## Kanonische Lesereihenfolge für den Builder

1. `01_ANFORDERUNGSKATALOG.md` und `02_FUNKTIONEN_ABLAEUFE.md`.
2. `03_OPTIKVORLAGE.md`, danach `04_SCHNITTSTELLEN_DATEN.md`.
3. `05_REGELN_SPERREN_KONFLIKTE.md` und `07_ABNAHME_TESTS.md`.
4. Vor jeder als „In Klärung“ markierten Funktion `08_OFFENE_FRAGEN.md` prüfen.
5. Bestand ausschließlich nach `11_IST_CODE_UMBAU.md` behalten, umbauen oder ersetzen.

## Wahrheitsregel

Für Architektur und Produktgrenzen gelten die Kanon-Dokumente und Entscheidungen. Für den tatsächlichen Lieferstand gilt der verifizierte Code auf `origin/main`. `CURRENT_STATE.md` ist für G05 durch neuere Commits vom 2026-09-25 überholt; die Abweichung steht in `09_QUELLEN_AKTUALITAET.md` und darf nicht zugunsten des lokalen Dirty-Worktrees aufgelöst werden.
