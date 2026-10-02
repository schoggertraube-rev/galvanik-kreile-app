<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Optikvorlage

## Verbindliche Quelle

`02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`  
SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`  
Anker: Referenzschlüssel `rolf_home` und `phillip_home`; Shell-Rahmen und geräteabhängige Navigation. Einzelmocks dienen nur der Kontrolle: Rolf V8 `878fad351778`, Phillip V4 `b3370c79a0fd`.

V5 ist visuelle Referenz, kein Produktcode und keine Datenquelle. Die eingebetteten Handy-Frames sind nicht automatisch Implementierungswahrheit: Die V5-Auswahl verwendet für Rolf unter 1100 px den Tablet-Frame und für Phillip den Tablet-L-Frame. Responsive Verhalten muss deshalb in Designphase 1 aus V5, Einzelmock und D-UI-V5-003 gemeinsam festgelegt und anschließend real getestet werden.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Shell und Hauptnavigation | ✓ | ✓ | ✓ | 4/7 | V5 Shell; D-UI-CORE-002; `MockAppFrame.tsx` |
| Rolf „Der Tag“ | ✓ | ✓ | ✓ | 4/7 | V5 `rolf_home`; Rolf V8 Desktop, `.frame.tablet`, Phone-Frame |
| Phillip „Werkstatt“ | fehlt → Designphase 1 | ✓ | ✓ | 5/7 | V5 `phillip_home`; Phillip V4 `.frame.tabletL` und Phone-Frame; aktueller Desktop-Code ist nur IST-Evidenz |
| Gregor „Einstellungen“ als Startseite | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 3/7 | Kein kanonischer Gregor-Startseitenmock; `/settings` ist durch Code/Tests belegt |
| Rolf Handlungsbedarf mit G09-Konfliktkarten | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 2/7 | OE-2609-10, OE-2609-26; Inhaltsvertrag in G09 |
| Phillip Handlungsbedarf mit G09-Konfliktkarten | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 2/7 | OE-2609-10, OE-2609-26; Inhaltsvertrag in G09 |
| Tagesüberblick Termine und Abwesenheiten | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 2/7 | OE-2609-19, OE-2609-26; M04 noch nicht angebunden |
| Wiederaufnahmefall D-RES-001 | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 1/7 | D-RES-001; keine gebaute Konfliktsektion |

## Designsystem-Bausteine

`kr-`-Bausteine: **wird nach Phase 1 ergänzt**.

Phase 1 muss mindestens folgende Bausteine liefern, ohne Mock-CSS zu kopieren:

- `kr-app-shell`, `kr-desktop-sidebar`, `kr-mobile-dock`, `kr-more-sheet`
- `kr-page-heading`, `kr-section-heading`, `kr-status-region`
- `kr-attention-list`, `kr-attention-card`, `kr-order-card`, `kr-summary-tile`
- `kr-source-status`, `kr-skeleton`, `kr-empty-state`, `kr-error-state`, `kr-denied-state`
- `kr-pending-state` für „In Aufbau“ und „In Klärung“

Gestaltungsregeln: Fraunces für Display-Überschriften, Inter für Bedien- und Lesetext, Navy/Cream aus Tokens, Touch-Ziele mindestens 48 px, Präfix `kr-`, keine neuen Einzel-Farbwerte.

## Designphase-1-Briefing für fehlende Varianten

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| Phillip Desktop | Phillip | Begrüßung, Dringend/Weitere, Konfliktkarten, Bündelung, WIP, heute raus, fällig diese Woche, Termine, Abwesenheiten, Quellstatus | Auftrag öffnen, WIP öffnen, Ware raus; keine Kalenderroute | alle 7 aus F-G02-003 | Phillip V4; OE-2609-19, OE-2609-26 |
| Gregor Einstellungen-Start | Gregor | Identität, autorisierte Einstellungsbereiche, Systemstatus nur aus G01/G10 | autorisierten Bereich öffnen, abmelden | alle 7 aus F-G02-001; fachliche Leere ohne erfundene Kacheln | `src/app/page.tsx`; OE-2609-09 |
| Handlungsbedarf Rolf | Rolf | `ConflictItem`: Schwere, Titel, Grund, Objektbezug, nächste Handlung, Quelle/Aktualität | Besitzerobjekt öffnen | Daten, lädt, leer ohne Container, Fehler, gesperrt, In Klärung, In Aufbau | G09; OE-2609-10, OE-2609-26 |
| Handlungsbedarf Phillip | Phillip | wie Rolf, aber ausschließlich Phillip-Zuständigkeit und G09-Anzeigeort | Besitzerobjekt öffnen | alle 7 aus F-G02-004 | G09; OE-2609-10, OE-2609-26 |
| Termine und Abwesenheiten | Rolf, Phillip | Typ, Beginn/Ende, Betroffene, Auftragsnummer, Kundenkurzname, Objektlink, Quelle, Aktualität | Auftrag oder Kunde öffnen; keine Kalender-Primäraktion | alle 7 aus F-G02-004 | OE-2609-19; M04-Vertrag |
| Wiederaufnahme | Rolf, Phillip | Ausgang ungeklärt, Objekt, Zeitpunkt, Korrelations-/Supportreferenz, nächste sichere Handlung | Besitzerobjekt öffnen | alle 7 aus F-G02-005 | D-RES-001; G09 |

## Visuelle Abnahme

- Vergleich bei 1914×917, 1220×880, 768×1024 und 390×844.
- Fokusreihenfolge, sichtbarer Fokus, Kontrast, Zoom 200 %, Tastatur und Touch-Ziele prüfen.
- Keine horizontale Seitenbewegung; Dock verdeckt keinen Inhalt; „Mehr“ ist Dialog/Sheet mit Fokusfang und Escape.
- Handlungsbedarf steht vor Tagesüberblick; leere Handlungsbedarfe erzeugen keine Erklärfläche.
- Analyse zeigt keine KPI-Kacheln; nicht angebundene ganze Routen fehlen vollständig.
