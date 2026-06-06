# 33 — App-weite Vernetzung: 7-Ebenen-Drill-Down für ALLE Module

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** ausführungsfertig
**Grundlage:** Datei 32 (Analyse-Standard), Live-Data-Policy, Showcase
**Kernprinzip:** Jede Kachel in jedem Modul hat denselben 7-Ebenen-Drill-Down. Jeder Drill-Down endet bei einem echten Geschäftsobjekt. Von dort führen verknüpfte Bereiche zu anderen Modulen. Das Ergebnis ist ein **geschlossener Kreislauf** — keine Sackgasse, egal wo man startet.

---

## 0. Die fünf Kern-Entitäten (alles mündet hier)

Egal aus welchem Modul man kommt — am Ende jeder Drill-Down-Kette steht eine dieser fünf:

| Entität | Was sie ist | Wohin sie weiter verweist |
|---|---|---|
| **Auftrag** | ein konkretes Werkstück/Los | Kunde, Bad, Kontrolle, Rechnung, Warendurchlauf, Zeitstrahl |
| **Kunde** | Firma/Person mit Auftragshistorie | Aufträge, Rechnungen, Offene Posten, Segment, Marketing, CLV |
| **Beleg** | Eingangsrechnung/Tankbeleg/Quittung | Lieferant, Kategorie, BWA-Position, Kostenposten, Export |
| **Rechnung** | Ausgangsrechnung | Kunde, Auftrag, Zahlung, Offene Posten, UStVA |
| **Lieferant** | Chemie-/Material-/Energieversorger | Belege, Bestellungen, Preishistorie, Lager |

**Regel:** Jede klickbare Zeile in jedem Drill-Down führt zu einer Detail-Route einer dieser Entitäten — oder zu einer anderen Kachel. Nie ins Leere.

---

## 1. Vernetzungsmatrix — welches Modul sieht welche Entitäten

```
                     Auftrag  Kunde  Beleg  Rechnung  Lieferant  Bad  Kontrolle
Home                    ●       ●                                         ●
Warendurchlauf          ●       ●                                ●        ●
Kunden & Aufträge       ●       ●             ●
Lager & Chemie                         ●                ●        ●
Bäder                   ●                                ●       ●        ●
Kontrolle               ●       ●                                ●        ●
Buchhaltung                            ●      ●         ●
Marketing               ●       ●             ●
Performance             ●       ●      ●      ●                  ●        ●
Kundenservice           ●       ●
Kommunikation           ●       ●
```

**Leserichtung:** „Warendurchlauf sieht Aufträge, Kunden, Bäder und Kontrolle" — das heißt, jede Kachel in Warendurchlauf kann zu diesen Entitäten verlinken.

---

## 2. Modul-für-Modul: Kacheln + 7-Ebenen-Ausfüllung

### 2.1 Home

| Kachel | ① KPI | ③ Zusammensetzung (klickbar) | ⑥ Verknüpft |
|---|---|---|---|
| **Im Umlauf** | Gesamt/Kritisch | Aufträge je Phase (In Galvanik, Warenausgang, Freigabe) → klick: Auftrag-Detail | Warendurchlauf, Kontrolle, Kunden |
| **Checkliste** | offene Punkte heute | je Punkt: Auftrag/Chemie/QS → klick: Detail + nächste Aktion | Warendurchlauf, Lager, Kontrolle, Bäder |
| **Stressphasen** | Peak-Zeiten | Aufträge in dieser Phase → klick: Auftragsliste gefiltert | Warendurchlauf, Performance |
| **Schnellstart** | — | kein Drill-Down, aber jede Kachel → Zielmodul | alle Module |

### 2.2 Warendurchlauf

| Kachel | ① KPI | ③ Zusammensetzung | ④ Wirtschaftl. | ⑥ Verknüpft |
|---|---|---|---|---|
| **Termintreue** | % pünktlich | Aufträge: pünktlich/verspätet, je → Auftrag-Detail | Ø Verspätung, Kosten der Verspätung, Kundenimpact | Kunden, Kontrolle, Bäder, Performance |
| **Durchlaufzeit** | Ø Tage | Aufträge sortiert nach DLZ → Detail. Top-3 Langläufer. Engpass-Station | DLZ/Umsatz, DLZ vs. Branche, DLZ-Trend | Bäder (Engpass), Kontrolle (Nacharbeit), Aufträge |
| **Engpass** | aktuelle Station | Aufträge an dieser Station → Detail. Kapazität vs. Last | Auslastung %, Wartezeit, Opportunity-Kosten | Bäder, Mitarbeiter, Aufträge |
| **Aufträge offen** | Anzahl + Wert | Liste: Auftrag, Kunde, Status, Wert → Detail | Auftragseingangsrate, Ø Auftragswert, Pipeline-Wert | Kunden, Rechnungen, Anfragen |

**KI-Einschätzung (Beispiel Termintreue):** „76 % Termintreue — 9 Pkt. unter Vormonat. Engpass Schleifen: 23 Aufträge warten. Vorschlag: Kapazität Schleifen prüfen → [Auftragsliste Schleifen öffnen]"

### 2.3 Kunden & Aufträge

| Kachel | ① KPI | ③ Zusammensetzung | ④ Wirtschaftl. | ⑥ Verknüpft |
|---|---|---|---|---|
| **Kundenwert (CLV)** | Top-Kunden-CLV € | Kunden sortiert nach CLV → Kunden-Detail (Auftragshistorie, Umsatz, Segment, Zahlungsmoral) | CLV/Akquisekosten, Wiederkaufrate, Ø Auftragswert | Aufträge, Rechnungen, Marketing (Segment), Offene Posten |
| **Auftragseingänge** | Anzahl + Wert | Aufträge: Datum, Kunde, Wert, Quelle (Marketing?) → Detail | Conversion (Anfrage→Auftrag), Ø Angebotserfolg, Trend | Anfragen, Marketing (Attribution), Warendurchlauf |
| **Kundensegmente** | Kunden je Segment | Segmente: Oldtimer/Schmuck/… → klick: Kundenliste gefiltert → Kunden-Detail | Umsatz/Segment, CLV/Segment, Wachstum | Marketing (Segmente), Aufträge, Rechnungen |

### 2.4 Lager & Chemie

| Kachel | ① KPI | ③ Zusammensetzung | ④ Wirtschaftl. | ⑥ Verknüpft |
|---|---|---|---|---|
| **Bestandswert** | Gesamtwert € | Artikel: Name, Menge, Einheit, Wert, Mindestbestand → klick: Artikel-Detail (Verbrauchshistorie, Lieferant, letzte Bestellung) | Umschlagshäufigkeit, Bestand/Umsatz, Kapitalbindung | Belege (Einkauf), Lieferanten, Bäder (Verbrauch), BWA |
| **Unter Mindestbestand** | Anzahl Artikel | Artikel unter Schwelle → Detail. „Jetzt bestellen" → Lieferant | Lieferverzögerungsrisiko, Produktionsstillstandkosten | Lieferanten, Bäder (betroffene), Aufträge (gefährdete) |
| **Verbrauch/Monat** | Chemie-Verbrauch € | Chemikalien: Menge, €, Verbrauchsrate → Detail | Verbrauch/Auftrag, Verbrauch/Bad, Trend vs. Vorjahr | Bäder (welches Bad verbraucht was), Belege, BWA Position Material |

### 2.5 Bäder

| Kachel | ① KPI | ③ Zusammensetzung | ④ Wirtschaftl. | ⑥ Verknüpft |
|---|---|---|---|---|
| **Badstatus** | X aktiv / Y gesamt | Bäder: Name, Typ, Konzentration, Temperatur, Status → klick: Bad-Detail (Regelkarte, Dosierhistorie, Messwerte) | Kosten/Bad, Aufträge/Bad, Standzeit | Lager (Chemie-Verbrauch), Aufträge (in Bad), Kontrolle, Energie (Kosten) |
| **Konzentration/Regelkarte** | aktueller Wert vs. Soll | Messwerte chronologisch → klick: Einzelmessung | Abweichung, Nachdosierungskosten, Ausfallrisiko | Lager (Nachdosierung), Aufträge (Qualitätsrisiko), Kontrolle |
| **Nachdosierung fällig** | Anzahl Bäder | Bäder mit Bedarf → Detail: was, wie viel, Kosten | Kosten Nachdosierung vs. Neuansatz (Spec 16: KI-Spartipp!) | Lager (Bestand prüfen), Belege (letzte Chemie-Bestellung), BWA |

**KI-Einschätzung (Beispiel Nickelbad):** „Konzentration bei 71 %. Nachdosieren spart ~620 € vs. Neuansatz (erst unter 55 % nötig). → [Badregelkarte öffnen] [Lager: Nickel-Bestand prüfen]"

### 2.6 Kontrolle

| Kachel | ① KPI | ③ Zusammensetzung | ④ Wirtschaftl. | ⑥ Verknüpft |
|---|---|---|---|---|
| **Reklamationen** | X / gesamt | Reklamationen: Auftrag, Kunde, Grund, Status → klick: Reklamations-Detail → Auftrag → Kunde | Reklamationsquote, Kosten/Reklamation, Nacharbeitszeit | Aufträge, Kunden, Bäder (Ursache?), Warendurchlauf |
| **QS-Prüfungen** | bestanden/geprüft | Prüfungen: Auftrag, Ergebnis, Prüfer → klick: Auftrag-Detail | Erstprüfungsquote (First Pass Yield), Nacharbeitsquote, Ø Prüfzeit | Aufträge, Bäder, Warendurchlauf |
| **Nacharbeit** | Stunden/Anzahl | Nacharbeits-Aufträge → Detail. Ursachenverteilung | Nacharbeitkosten, Stunden/Auftrag, Trend | Aufträge, Bäder, Kunden (betroffen) |

### 2.7 Performance (Zentrales Dashboard)

| Kachel | ① KPI | ③ Zusammensetzung | ⑥ Verknüpft |
|---|---|---|---|
| **Werkstatt-Puls** | Termintreue + DLZ | → identisch Warendurchlauf, verlinkt dorthin | Warendurchlauf |
| **Umsatz & Erträge** | Deckungsbeitrag € | Aufträge/Rechnungen nach Segment/Kunde → Detail | Rechnungen, Kunden, BWA, Marketing |
| **Marketing-Wirkung** | Anfragen + Umsatz aus MK | → identisch Marketing-Funnel, verlinkt dorthin | Marketing |
| **Kundenzufriedenheit** | Ø Score | → identisch Marketing-Zufriedenheit | Marketing, Kunden |
| **Online-Sichtbarkeit** | Google-Treffer + Website | → Marketing-Statistik | Marketing |
| **Chancen & Risiko** | Reklamationen + Frühwarnungen | → identisch Kontrolle + Bäder | Kontrolle, Bäder |

### 2.8 Kundenservice

| Kachel | ① KPI | ③ Zusammensetzung | ⑥ Verknüpft |
|---|---|---|---|
| **Anfragen offen** | Anzahl | Anfragen: Kunde, Datum, Status → klick: Anfrage-Detail → Kunde → ggf. Auftrag | Kunden, Aufträge, Marketing (Quelle) |
| **Ø Reaktionszeit** | Stunden/Tage | Anfragen sortiert nach Reaktionszeit → Detail | Reaktionszeit/Segment, Trend, SLA-Einhaltung | Kommunikation, Kunden |
| **Zufriedenheit** | → Marketing-Feedback | → Feedback-Drill-Down | Marketing, Kunden |

### 2.9 Kommunikation

| Kachel | ① KPI | ③ Zusammensetzung | ⑥ Verknüpft |
|---|---|---|---|
| **Telefonnotizen** | Anzahl heute/Woche | Notizen: Datum, Kunde, Betreff, Quelle → klick: Notiz-Detail → Kunde → ggf. Auftrag/Anfrage | Kunden, Anfragen, Aufträge |
| **E-Mails** | unbeantwortet | Mails: Absender, Betreff, Datum → klick: Mail → Kunde | Kunden, Aufträge |
| **Letzte Aktivitäten** | Timeline | Aktivitäten: Typ, Kunde, Datum → klick: Detail | alle Module je Aktivitätstyp |

---

## 3. Kreislauf-Beispiele (so funktioniert „vernetzt")

### Beispiel 1: Vom Sparzähler zum Lieferanten
```
Buchhaltung → Sparzähler → Drill-Down → „6 Lieferanten ohne Mapping" 
  → klick: Lieferant „Riedel Chemie" → Lieferant-Detail 
    → verknüpft: Belege (3 Rechnungen) → Beleg-Detail 
    → verknüpft: Lager (Chemie-Bestand) → Artikel-Detail 
    → verknüpft: Bäder (Nickelbad nutzt diesen Stoff) → Bad-Detail 
    → verknüpft: Aufträge (12 Aufträge in diesem Bad) → Auftrag-Detail 
    → verknüpft: Kunde → Kunden-Detail 
    → verknüpft: Marketing (Segment Museen) → zurück zum Cockpit
```

### Beispiel 2: Vom Marketing-Funnel zum Auftrag
```
Marketing → Umsatz daraus → Drill-Down → Auftrag #8061 (Schmid GmbH, 1.840 €) 
  → klick: Auftrag-Detail 
    → verknüpft: Kunde Schmid GmbH → Kunden-Detail (CLV, Auftragshistorie) 
    → verknüpft: Warendurchlauf (Status: in Galvanik, Bad 3) 
    → verknüpft: Rechnung RE-2026-042 → Rechnungs-Detail 
    → verknüpft: Offene Posten (bezahlt am 15.06.) 
    → verknüpft: BWA (Einnahmen-Zeile)
```

### Beispiel 3: Vom Bad zur BWA
```
Bäder → Nickelbad → Bad-Detail → Verbrauch: 340 € Nickel diesen Monat 
  → klick: Belege (Chemie-Einkauf) → Beleg Riedel Chemie 1.190 € 
    → verknüpft: BWA Position Material → BWA-Drill-Down 
    → verknüpft: Lieferant Riedel → Preishistorie 
    → verknüpft: Kostenposten (variabel, Chemie)
```

---

## 4. Detail-Seiten der Kern-Entitäten (Pflichtinhalt)

Jede Kern-Entität hat eine Detail-Seite. Diese ist kein Endpunkt, sondern ein **Knotenpunkt** mit verknüpften Bereichen:

### Auftrag-Detail `/auftraege/[id]`
- Kopf: Auftragsnummer, Kunde (klickbar), Status, Wert, Zeitstrahl
- Positionen/Teile
- Warendurchlauf-Phase (in welchem Bad, welche Station)
- Kontrollergebnis (QS bestanden/Nacharbeit)
- Rechnung (verknüpft, klickbar)
- Quelle (Marketing-Attribution, wenn vorhanden)
- **Verknüpft:** Kunde, Rechnung, Bad, Kontrolle, Warendurchlauf, Marketing

### Kunden-Detail `/kunden/[id]`
- Kopf: Name, Segment, CLV, Zahlungsmoral
- Auftragshistorie (klickbar)
- Rechnungen + Offene Posten
- Kommunikations-Timeline (Telefonnotizen, Mails)
- Marketing: Quelle der Erstanfrage, Reaktivierungs-Status, Feedback
- **Verknüpft:** Aufträge, Rechnungen, Kommunikation, Marketing, Segment

### Beleg-Detail `/buchhaltung/belege/[id]`
- Kopf: Lieferant, Datum, Betrag, Kategorie, Absetzbarkeit
- Belegbild (Original)
- Kontierung (SKR-Konto, USt)
- Zugeordneter Bankumsatz (wenn vorhanden)
- **Verknüpft:** Lieferant, BWA-Position, Kostenposten, Lager (wenn Chemie), Bad (wenn Chemie)

### Rechnung-Detail `/buchhaltung/rechnungen/[id]`
- Kopf: Nummer, Kunde (klickbar), Datum, Betrag, Status
- Positionen
- Zahlungshistorie
- Mahnstufe
- **Verknüpft:** Kunde, Auftrag, Offene Posten, UStVA, BWA

### Lieferant-Detail `/lieferanten/[id]`
- Kopf: Name, Typ, Kontakt
- Belege/Bestellhistorie (klickbar)
- Preishistorie
- Verbrauch der gelieferten Artikel
- **Verknüpft:** Belege, Lager (Artikel), Bäder (Chemie-Nutzung), BWA

---

## 5. Antigravity-Bauauftrag (phasenweise)

```text
Lies Datei 33 + 32 + Live-Data-Policy.
Grundregel: Das 7-Ebenen-Template (Datei 32 §1) gilt für JEDE Kachel in JEDEM Modul.
Jeder Drill-Down endet bei Auftrag/Kunde/Beleg/Rechnung/Lieferant.
Von dort führen verknüpfte Bereiche zu anderen Modulen. Geschlossener Kreislauf.

PHASE 1: Kern-Detail-Seiten (Knotenpunkte, §4)
  Prüfe: existieren /auftraege/[id], /kunden/[id], /buchhaltung/belege/[id],
  /buchhaltung/rechnungen/[id], /lieferanten/[id] als echte Detail-Routen mit
  echten Daten + verknüpften Bereichen? Fehlende anlegen/vervollständigen.
  Commit: F-VERNETZUNG-01

PHASE 2: Warendurchlauf + Kontrolle (§2.2, §2.6)
  Kacheln Termintreue, Durchlaufzeit, Engpass, Reklamationen, QS, Nacharbeit:
  7-Ebenen-Overlay mit echten Queries. Drill-Down → Auftrag-Detail.
  Verknüpfte Bereiche: Bäder, Kunden, BWA.
  Commits: F-VERNETZUNG-02a (Warendurchlauf), F-VERNETZUNG-02b (Kontrolle)

PHASE 3: Lager & Chemie + Bäder (§2.4, §2.5)
  Kacheln Bestandswert, Unter Mindestbestand, Badstatus, Konzentration, Nachdosierung:
  7-Ebenen-Overlay. Drill-Down → Artikel/Bad-Detail → Aufträge/Belege.
  Commits: F-VERNETZUNG-03a (Lager), F-VERNETZUNG-03b (Bäder)

PHASE 4: Kunden & Aufträge + Performance (§2.3, §2.7)
  CLV, Auftragseingänge, Segmente, Werkstatt-Puls, Umsatz & Erträge:
  7-Ebenen-Overlay. Performance-Kacheln verlinken zu Quell-Modulen.
  Commits: F-VERNETZUNG-04a (Kunden), F-VERNETZUNG-04b (Performance)

PHASE 5: Home + Kundenservice + Kommunikation (§2.1, §2.8, §2.9)
  Im Umlauf, Checkliste, Stressphasen, Anfragen, Telefonnotizen:
  7-Ebenen wo sinnvoll (Home-Checkliste: mind. Ebene ③+⑥).
  Commits: F-VERNETZUNG-05

PHASE 6: Kreislauf-Prüfung
  Starte bei 5 zufälligen Kacheln in 5 verschiedenen Modulen.
  Navigiere NUR durch Drill-Downs und verknüpfte Bereiche.
  Dokumentiere den Pfad. Teste: kommt man von jedem Startpunkt zu jedem
  Kern-Entitätstyp und zurück? Wo bricht die Kette? → fixen.
  Commit: F-VERNETZUNG-06

Nach jeder Phase: Nachweis (Pfad-Dokumentation), nicht "erledigt".
```

---

## 6. Akzeptanzkriterien

- [ ] Jede Kachel in jedem Modul hat das 7-Ebenen-Overlay (oder begründet weniger bei reinen Navigations-Kacheln).
- [ ] Jeder Einzelposten im Drill-Down ist klickbar → führt zu Auftrag/Kunde/Beleg/Rechnung/Lieferant.
- [ ] Jede Detail-Seite der 5 Kern-Entitäten hat verknüpfte Bereiche zu mindestens 3 anderen Modulen.
- [ ] Kreislauf-Prüfung (Phase 6): von jedem Startmodul kommt man über Drill-Downs zu jedem Kern-Entitätstyp.
- [ ] Keine Sackgasse, kein toter Link, kein Mock-Wert in Drill-Downs.
- [ ] KI-Einschätzungen sind regelbasiert aus echten Daten (nicht Platzhaltertext).
- [ ] Performance-Kacheln verlinken zu Quell-Modulen (gleiche Daten, kein Duplikat).
