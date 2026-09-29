<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 03 — Optikvorlage

## Verbindliche Quelle

**Datei:** `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`

**SHA-256:** `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`

**Abschnitt/Anker:** JavaScript-Funktion `accountingPage()` und Szene `accounting`; responsive App-Subpage-Regeln in `mountOnlyReferenceFrame()` (`≥900`, `600–899`, `<600`). Für Rechnung/Zahlung in der Auftragskarte gilt zusätzlich die von V5 eingebundene Auftragskarte V8; für `Ware raus` die von V5 eingebundene Phillip-V4-Referenz. HTML-Werte und Personen sind ausschließlich synthetische UX-Referenz und keine Produktdaten.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Geld & Rechnungen — Liste | ✓ | ✓ | ✓ | 1/7 (nur Daten; synthetisch) | V5 `accountingPage()` / Szene `accounting` |
| Rechnung/Zahlung in Auftragskarte | ✓ | ✓ | ✓ | 1/7 (Datenweg; Zustandstexte zusätzlich im Ist-Code) | V5 Referenz `order`; Auftragskarte V8; MODULKARTE D-UI-CORE-001/002 |
| Rechnungsdetail mit PDF/Storno | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 0/7 im Mock; 5/7 im Ist-Code, aber kein Ziel-Freeze | V5 enthält keinen Detailentwurf; `InvoicesClient.tsx` nur Ist-Code |
| Warenausgang-Picker | ✓ | ✓ | fehlt → Designphase 1 | 2/7 visuell; Texte im Ist-Code | V5 Referenz `phillip`; Phillip V4; `WerkstattView.tsx` |
| Kundenfreigabe „Rechnung auf Ziel“ | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 0/7 | OE-2609-11; Q-G07-003 |
| Ausgangs-Export-Element | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 1/7 (`In Klärung` vorgegeben) | Q-G07-002; Anleitung §6 |
| E-Rechnung-Element | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 1/7 (`In Klärung` vorgegeben) | OE-2609-14; Q-G07-001; Anleitung §6 |
| Kartenterminal-Element | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 1/7 (`In Aufbau` vorgegeben) | OE-2609-12; Anleitung §6 |
| Aufbewahrungs-/Anonymisierungsvorschlag | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 1/7 (`In Klärung` vorgegeben) | OE-2609-20; Q-G07-009; administrative Komposition in G10/G01 |

## Was aus V5 übernommen wird

- Informationshierarchie: Titel `Geld & Rechnungen`, keine KPI-Wand, reale Rechnung/Auftrag-Zeile, Status, nächste Handlung, Öffnen-Aktion.
- Responsive Struktur: Tabellenkopf entfällt unter 900 px; Zeilen werden zweispaltig und unter 600 px einspaltig; Touch-Aktionen bleiben mindestens 44 px im Mock und müssen nach Kreile-DS 48 px erreichen.
- Visuelle Richtung: Fraunces + Inter, Navy/Cream, ruhige Statusfarben und eine klare Primärhandlung.
- Nicht übernommen werden `Beleg erfassen`, die drei synthetischen Kennzahlen, Beispielbeträge/-kunden, Mock-Reminder und jedes Inline-/Mock-CSS. `Beleg erfassen` gehört als Eingangsbeleg zu M01, nicht zu G07.

## Zustandsabgleich

| Zustand | V5 belegt | Ist-Code belegt | Zielentscheidung |
|---|---|---|---|
| Daten | ja, aber synthetisch | ja, reale Read-Projektion | Reale Daten behalten, V5-Hierarchie im DS |
| lädt | nein | ja | Text aus `02`, Darstellung Designphase 1 |
| leer | nein | ja | Text aus `02`, Darstellung Designphase 1 |
| Fehler | nein | ja | Fail-closed Text aus `02`, Darstellung Designphase 1 |
| gesperrt | nein | ja, alte Rollenlogik | Auf persönliche G01-Fähigkeit umbauen |
| In Klärung | nein | nein | DS-Zustand für Q-G07-001/002/003/004/006 |
| In Aufbau | nein | nein | DS-Zustand für Terminal/M01-Anschlüsse |

## Designsystem-Bausteine (`kr-`)

wird nach Phase 1 ergänzt

Bis dahin gelten nur semantische Slots, keine selbst erfundenen Komponenten: Seitenkopf, reale Zusammenfassung ohne Fake-KPI, Rechnungsliste, Status, offene Handlung, Detailbereich, Inline-Receipt/Fehler, nicht klickbares Anschluss-Element und responsive Aktionsleiste. Namen, Tokens und Abstände werden erst aus dem Kreile-DS übernommen.

## Designphase-1-Auftrag ohne Rückfrage

1. V5-Hierarchie in `kr-`-Bausteinen für `≥1300`, Tablet und Handy reproduzieren, ohne CSS zu kopieren.
2. Alle sieben Zustände aus `02` als dieselbe Informationsarchitektur entwerfen.
3. Rechnung/Zahlung bleiben in der G04-Auftragskarte; G07-Liste und Detail dürfen keine zweite Auftragskarten-Wahrheit erzeugen.
4. `E-Rechnung — In Klärung`, `Export Ausgangsrechnungen — In Klärung`, `Rechnung auf Ziel — In Klärung`, `Aufbewahrung — In Klärung`, `Kartenterminal — In Aufbau` und `Mahnwesen — In Aufbau` nach Anleitung §6 gedämpft, nicht klickbar und ohne Route darstellen.
5. Keine Eingangsbeleg-, Mahn-, Bank-, Analyse- oder KPI-Fläche in G07 ergänzen.
6. Owner-UX mit Rolf Desktop, Phillip Tablet und Handybreite abnehmen; keine synthetischen Produktwerte im Testlauf außer klar markierten Testfixtures.
