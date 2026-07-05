# IDEA REGISTER

Stand: 2026-07-05 · Quelle: 5 Ideenkataloge (`99_AUDIT_INPUT/ideen_zip`, 4.385 Zeilen) + USP-Neupositionierung + User Twins. Umsetzungsstatus stichprobenartig gegen Code geprüft.

Status: NEW / ANALYZED / ACCEPTED / PLANNED / IN_PROGRESS / VERIFIED / LIVE / DEFERRED / REJECTED

| IDEA-ID | Idee | Quelle | explizit/abgeleitet | Nutzen | Zielphase | Umsetzungsstand (Code) | Status |
|---|---|---|---|---|---|---|---|
| I-01 | Startseite beantwortet in 3s „Was ist heute wichtig?" (kritisch/gefährdet/im Plan, Engpass) | 01_HOME_DASHBOARD | explizit | Rolf/Philipp Orientierung | Fundament+ | `page.tsx` lädt echte Orders, zeigt crit/gefährdet — Begrüßung teils Platzhalter „Aktueller Nutzer" | IN_PROGRESS |
| I-02 | Tageszeit-Begrüßung mit echtem Nutzernamen aus Login | 01_HOME_DASHBOARD | explizit | Verbundenheit (SDT) | Fundament | `greeting.ts` vorhanden; Name-Bindung offen | ANALYZED |
| I-03 | Wake-/Morgen-Screen mit Tageszusammenfassung | 01_HOME_DASHBOARD | explizit | Ritual, Motivation | später | nicht belegt umgesetzt | DEFERRED |
| I-04 | Foto/Beleg → Original sichern → OCR/KI → Kunde/Auftrag zuordnen (Slice 1) | 03_WARENDURCHLAUF, PROJECT_TRUTH | explizit | Kern-USP „hürdenlose Erfassung" | Fundament (Slice 1) | teilweise: Capture existiert, Original-Persistenz gebrochen (F-C4), Vor-Auftrags-Event unmöglich (F-D1) | IN_PROGRESS |
| I-05 | „Nur unsichere Angaben prüfen" (feldbezogene Konfidenz) | USP, 03_WARENDURCHLAUF | explizit | Weniger Klicks (Michael) | Fundament+ | Konfidenz im OCR vorhanden, Review-Gate unvollständig | ANALYZED |
| I-06 | Routebasierte erste Produktionskarte (nicht Galvanik-Hardcode) | PROJECT_TRUTH, Slice-Vertrag R12 | explizit | Korrekte Stationsführung | Fundament+ | Stationsdivergenz current_station/_id (F-B3) blockiert | ANALYZED |
| I-07 | Betriebs-Cockpit: Umsatz/Gewinn/Kosten/Liquidität verständlich | 04_BETRIEBS_COCKPIT, USP #1 | explizit | Rolfs Kaufgrund | Phase Cockpit | Views + cockpit/actions vorhanden; Fachlogik teils in TS (F-E1) | IN_PROGRESS |
| I-08 | Engpass/Handlungsbedarf statt bloßer Zahlen (Ursache+Dringlichkeit+nächste Maßnahme) | 04_BETRIEBS_COCKPIT, USP #7, 8-Fragen | explizit | Rolf/Philipp handeln | Phase Cockpit | 8-Fragen-Karte nicht durchgängig belegt | ANALYZED |
| I-09 | Performance-/KI-Analyse: Auslastung, Marge je Auftrag/Kunde/Station | 05_PERFORMANCE_KI | explizit | Datenmacht (Philipp) | Phase Analyse | v_economics/v_analyse vorhanden; Stationskette gebrochen (F-B3) | IN_PROGRESS |
| I-10 | Automatische, kontrollierte Kundenkommunikation (Status, Fertigmeldung, Zahlung) | 02_AUFTRAGSBUCH, USP #8 | explizit | Michael-Entlastung | später | email/send existiert (ungeschützt, F-A9); Automatik nicht belegt | DEFERRED |
| I-11 | Lebendiges Kunden-/Werkstattgedächtnis (Historie, Preise, Reklamationen, Fotos) | 02_AUFTRAGSBUCH, USP #9 | explizit | Inhaberunabhängigkeit | Phase Kundenkartei | Kundenkarte mit 7 Tabs vorhanden (Wasserfall F-G2) | IN_PROGRESS |
| I-12 | Sichtbarer Fortschritt/Gamification (Wochenbilanz, Haken, Level) | 01_HOME, USP #10 | explizit | Motivation (Philipp) | später | animierte Zähler vorhanden; Gamification rudimentär | DEFERRED |
| I-13 | Spracheingabe/Telefonnotiz automatisch strukturieren (Michael) | 02_AUFTRAGSBUCH, Twin Michael | explizit | Kein Tippen | später | phoneNotes/localPhoneAnalysis vorhanden; Reife offen | ANALYZED |
| I-14 | Nur realistische Termine zusagen (Schutz vor Fehlzusage) | Twin Michael | explizit | Fehlervermeidung | später | Kapazitäts-/Terminlogik nicht belegt umgesetzt | DEFERRED |
| I-15 | Nachfolge-/Übergabefähigkeit als Beweisfunktion | USP §8, Twin Philipp | abgeleitet | Unternehmenswert | Vision | konzeptionell; kein Code | DEFERRED |
| I-16 | Rollenspezifische Zugänge (Rolf Desktop-Steuerung, Philipp Tablet, Michael Minimal) | alle Twins | explizit | Akzeptanz je Nutzer | Fundament+ | Rollen/Permissions-Contract vorhanden (P-4); rollenspezifische UI offen | ANALYZED |
| I-17 | Mandantenfähigkeit offenhalten (spätere Kundenprojekte, z.B. Evas Lerninsel) | CLAUDE.md, USP #5 | explizit | Wiederverwendung/Skalierung | Architektur | durch Tenant-Hardcode (F-H1) + tote RLS (F-A1) aktuell blockiert | ANALYZED |
