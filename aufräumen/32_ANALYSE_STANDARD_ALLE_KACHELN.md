# 32 — Analyse-Standard: 7-Ebenen-Drill-Down für ALLE Kacheln

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** ausführungsfertig
**Referenz:** `Showcase_Analyse_Buchhaltung.html` (Energie-Kachel) = Goldstandard
**Gilt für:** JEDE Kachel in Buchhaltung, Marketing, Performance und Home
**Grundregel:** Es gibt **keine Kachel-Endstation.** Jeder Drill-Down endet bei einer echten Entität (Beleg, Rechnung, Auftrag, Kunde, Lieferant).

---

## 0. Keine-Endstation-Regel (nicht verhandelbar)

Jede angezeigte Zahl ist rückverfolgbar bis zu einem **echten Geschäftsobjekt** (Beleg, Rechnung, Auftrag, Kunde, Lieferant, Kostenposten). Von dort verweisen **verknüpfte Bereiche** auf andere Module. Das System ist ein **geschlossener Kreislauf**, keine Sackgasse:

```
Kachel → Drill-Down → Einzelposten (klickbar)
  → Beleg-Detail / Rechnungs-Detail / Auftrags-Detail / Kunden-Detail
    → verknüpfte Bereiche → andere Kacheln/Module
      → wieder Drill-Down → Einzelposten → …
```

**Verboten:** Chips/Links die nirgends hinführen. Listen die nicht klickbar sind. Zahlen ohne Quelle. Endbildschirme ohne Weiternavigation.

---

## 1. Das 7-Ebenen-Template (verbindlich, je Kachel)

Aus dem Showcase abgeleitet — diese 7 Ebenen hat **jede** Kachel im Analyse-Overlay:

| Ebene | Name | Inhalt | Pflicht |
|---|---|---|---|
| **①** | **KPI + Trend + Zeitraum** | Große Zahl, Vergleich Vorperiode (↑↓ + %), Zeitraum-Selektor (Tag/Woche/Monat/Quartal), Bedeutungs-Pill (stabil/auffällig/kritisch) | ja |
| **②** | **Verlaufschart** | Linienchart Ist vs. Vorjahr (gestrichelt) + Ø-Linie; Perioden-Granularität passend zum Zeitraum | ja |
| **③** | **Zusammensetzung** | „Woraus besteht der Betrag" — sortierte Liste der Einzelposten, **jeder klickbar** → Detail-Route (Beleg/Rechnung/Kostenposten). Button „Alle im [Modul]-Cockpit öffnen" | ja |
| **④** | **Wirtschaftlichkeits-KPIs** | 3–5 horizontal scrollbare Karten: Verhältnis zu Umsatz, Deckungsbeitrag, Aufträgen, CO₂ etc. Mit Trend + Bewertung (↑ kritisch / ↔ stabil) | ja |
| **⑤** | **KI-Einschätzung** | Badge „PRO", drei Absätze: **Beobachtung** (Fakten), **Vermutung** (Hypothese), **Vorschlag** (mit Aktions-Buttons: Badregelkarte prüfen, Nachbuchung prüfen, als erledigt markieren) | ja (PRO) |
| **⑥** | **Verknüpfte Bereiche** | Chip-Leiste: Links zu verwandten Modulen/Kacheln (BWA, Bäder, Aufträge, Lieferant, Marketing). Jeder Chip führt zu einer **echten** Seite mit echten Daten | ja |
| **⑦** | **Tabs oben** | Drawer: „vollständig" (Default) / „Daten fehlen" (welche Belege/Posten fehlen) / „So erfasst du das" (Anleitung) / „Zentrale Erfassung" (Formularlink) | ja |

**Plus:** Info-Buttons (i) an Formeln/Kennzahlen → Popover mit Formel + Erklärung.

---

## 2. Buchhaltung — Kachel-für-Kachel-Ausfüllung

### 2.1 UStVA Zahllast (Hero-Band)

| Ebene | Inhalt |
|---|---|
| ① KPI | Zahllast in €. Trend vs. Vormonat. Pill: „fällig am 10.XX" (gelb) oder „eingereicht" (grün) |
| ② Chart | Zahllast je Monat (12 Mon.), Linie Ist + Ø-Linie |
| ③ Zusammensetzung | **Umsatzsteuer:** je USt-Satz (19%: X €, 7%: Y €) → klick: Rechnungsliste gefiltert. **Vorsteuer:** Top-5 Beleg-Vorsteuer → klick: Beleg-Detail |
| ④ Wirtschaftl. | USt-Quote (Zahllast/Umsatz), Vorsteuer-Quote, Effektive Steuerbelastung, Vergleich Vorjahr |
| ⑤ KI | Beob: „Zahllast +12% vs. Vormonat". Verm: „3 Großaufträge mit 19% USt". Vorschlag: „Dauerfristverlängerung prüfen" → Button |
| ⑥ Verknüpft | Rechnungen, Belege, Steuerprofil, ELSTER-Export, BWA |
| ⑦ Tabs | vollständig / fehlende Belege / Anleitung UStVA / Steuerprofil öffnen |

### 2.2 Kraftstoff & Kfz

| Ebene | Inhalt |
|---|---|
| ① KPI | Gesamtkosten €. Trend vs. Vormonat. Pill: Liter + Ø-Preis/l |
| ② Chart | Kosten je Monat + Ø-Preis/l als zweite Achse |
| ③ Zusammensetzung | Tankungen sortiert: je Beleg (Tankstelle, Datum, Liter, Betrag) → klick: Beleg-Detail. „Alle Belege im Beleg-Cockpit öffnen" |
| ④ Wirtschaftl. | Kraftstoff/Umsatz-Euro (ct), Kraftstoff/Auftrag, Anteil an Gesamtausgaben, km-Pauschale-Vergleich |
| ⑤ KI | Beob: „+15% vs. Vormonat, 3 Tankungen mehr". Verm: „Mehr Auslieferungen im Umland". Vorschlag: „Sammelfahrten prüfen" |
| ⑥ Verknüpft | Belege (Kraftstoff-Filter), BWA Position Kfz, Aufträge mit Lieferung, Lieferanten (Shell, Aral) |

### 2.3 Offene Posten

| Ebene | Inhalt |
|---|---|
| ① KPI | Gesamtsumme offen €. Trend. Pill: „X überfällig" (rot) oder „alle im Zeitrahmen" (grün) |
| ② Chart | Offene Posten je Monat (Balken: offen/teilbezahlt/überfällig gestapelt) |
| ③ Zusammensetzung | Rechnungen sortiert nach Fälligkeit: Kunde, Rechnungs-Nr, Betrag, Restbetrag, Tage überfällig, Mahnstufe → klick: Rechnungs-Detail |
| ④ Wirtschaftl. | Ø Tage bis Zahlung (DSO), Forderungsquote (Offene/Umsatz), Zahlungsmoral-Index |
| ⑤ KI | Beob: „Kunde X seit 28 Tagen offen". Verm: „Erfahrungsgemäß zahlt X erst nach Mahnung". Vorschlag: „Zahlungserinnerung senden" → Button |
| ⑥ Verknüpft | Rechnungen, Kunden, Zahlungen, Mahnwesen, BWA Position Forderungen |

### 2.4 BWA / Monatsübersicht

| Ebene | Inhalt |
|---|---|
| ① KPI | Betriebsergebnis €. Trend. Pill: positiv (grün) / negativ (rot) |
| ② Chart | Einnahmen vs. Ausgaben vs. Ergebnis (3 Linien, 12 Mon.) |
| ③ Zusammensetzung | BWA-Zeilen (Spec 30 §5.1): Umsatzerlöse → klick: Rechnungsliste. Material → klick: Belege (Material). Kraftstoff → klick: Kraftstoff-Kachel. Fixkosten → klick: Kostenposten (fix). Variable → klick: Kostenposten (variabel). **Jede Zeile führt zur Quelle.** |
| ④ Wirtschaftl. | Deckungsbeitrag %, Kostenquote, Personal-/Materialquote, Break-Even-Punkt |
| ⑤ KI | Beob: „Materialquote +3 Pkt." Verm: „Nickelpreis gestiegen". Vorschlag: „Lieferantenvergleich starten" |
| ⑥ Verknüpft | Rechnungen, Belege, Kostenposten, Kraftstoff, Bäder (Material), Lieferanten |

### 2.5 Fixkosten

| Ebene | Inhalt |
|---|---|
| ① KPI | Monatssumme €. Trend. Pill: Anzahl Posten |
| ② Chart | Fixkosten je Monat (gestapelt nach Kategorie) |
| ③ Zusammensetzung | Kostenposten (art=fix): Bezeichnung, Kategorie, Betrag, Intervall → klick: Kostenposten-Detail. Beleg verknüpft? → klick: Beleg-Detail |
| ④ Wirtschaftl. | Fixkosten/Umsatz, Fixkosten/Auftrag, Fixkosten-Deckung (ab welchem Umsatz gedeckt) |
| ⑤ KI | Beob: „Strom +8%". Verm: „Tariferhöhung Mainova". Vorschlag: „Anbieterwechsel prüfen" |
| ⑥ Verknüpft | BWA Zeile Fixkosten, Belege (Energie/Miete), Lieferanten, Kostenposten |

### 2.6 Variable Kosten

| Ebene | Inhalt |
|---|---|
| ① KPI | Monatssumme €. Trend. Pill: Veränderung vs. Umsatzveränderung |
| ② Chart | Variable vs. Umsatz (Korrelation) |
| ③ Zusammensetzung | Kostenposten (art=variabel) + Belege (nicht fix) → klick: Detail |
| ④ Wirtschaftl. | Variable/Umsatz, Variable/Auftrag, Grenzkosten |
| ⑤ KI | Beob/Verm/Vorschlag analog |
| ⑥ Verknüpft | BWA, Belege, Aufträge, Lieferanten |

### 2.7 Ausgaben gesamt

| Ebene | Inhalt |
|---|---|
| ① KPI | Gesamtausgaben €. Trend. Pill: Anzahl Belege |
| ② Chart | Ausgaben je Kategorie (Stacked Bar, 6 Mon.) |
| ③ Zusammensetzung | Kategorien: Material, Energie, Kraftstoff, Bewirtung, Büro, Kfz — je Kategorie: Summe → klick: Belege (gefiltert). „Alle Belege öffnen" |
| ④ Wirtschaftl. | Ausgaben/Umsatz, Ausgaben/Auftrag, Ø pro Werktag |
| ⑤ KI | Beob: „Bewirtung +40% vs. Vm." Verm: „3 Kundenevents". Vorschlag: „70% absetzbar (§4 Abs.5 Nr.2) — Anlass bei 2 Belegen ergänzen" |
| ⑥ Verknüpft | Belege, BWA, Kostenposten, Kategorien, Steuerprofil |

### 2.8 Sparzähler

| Ebene | Inhalt |
|---|---|
| ① KPI | Ersparnis € YTD. Trend. Pill: % automatisch |
| ② Chart | Kumulative Ersparnis je Monat |
| ③ Zusammensetzung | Auto-kontierte Belege × Minuten × Stundensatz = Einzelposten. Vergleich: „Ohne App hätte dein Berater X Stunden gebraucht" |
| ④ Wirtschaftl. | Ersparnis/Beleg, Amortisation App-Kosten, Berater-Stunden eingespart |
| ⑤ KI | Beob: „94% automatisch kontiert". Vorschlag: „6 Lieferanten ohne Mapping — ergänzen für 98%" |
| ⑥ Verknüpft | Belege, Steuerprofil (Stundensatz), Einstellungen (Lieferanten-Mapping) |

---

## 3. Marketing — Kachel-für-Kachel-Ausfüllung

### 3.1 Anfragen aus Marketing

| Ebene | Inhalt |
|---|---|
| ① KPI | Anzahl Anfragen. Trend. Pill: „X sicher attribuiert" |
| ② Chart | Anfragen je Woche/Monat + Kanäle (gestapelt: UTM/Mail/Manuell) |
| ③ Zusammensetzung | Leads mit Quelle: Datum, Kunde, Kanal, Aktion → klick: Lead/Anfrage-Detail → klick: Kunde |
| ④ Wirtschaftl. | Kosten/Anfrage, Anfragen/Post, Conversion-Rate (Anfrage→Auftrag) |
| ⑤ KI | Beob: „Instagram bringt 3× mehr als Mail". Vorschlag: „Vorher/Nachher-Post diese Woche" |
| ⑥ Verknüpft | Aktionen, Touchpoints, Kunden, Aufträge, Segmente |

### 3.2 Umsatz daraus

| Ebene | Inhalt |
|---|---|
| ① KPI | Attribuierter Umsatz €. Trend. Pill: Modell (Last-Touch) |
| ② Chart | Umsatz je Monat + nach Kanal (gestapelt) |
| ③ Zusammensetzung | Aufträge mit Attribution: Auftrag-Nr, Kunde, Quelle/Aktion, Brutto → klick: Auftrags-Detail → klick: Kunde. Sichten: nach Kanal / nach Segment |
| ④ Wirtschaftl. | Umsatz/Post, Umsatz/Anfrage, Anteil Marketing-Umsatz am Gesamtumsatz |
| ⑤ KI | Beob: „Oldtimer-Segment bringt 55% des Marketing-Umsatzes". Vorschlag: „Segment verstärken" |
| ⑥ Verknüpft | Aufträge, Kunden, Rechnungen, Aktionen, Segmente, BWA |

### 3.3 ROI

| Ebene | Inhalt |
|---|---|
| ① KPI | ROI als Faktor (9,1×). Trend. Pill: Kosten vs. Umsatz |
| ② Chart | ROI je Monat + kumulativ |
| ③ Zusammensetzung | **Kosten:** Aufstellung je Kanal/Kampagne → klick: Kostenposten. **Umsatz:** → klick: Aufträge (attribuiert). Verhältnis als Balken |
| ④ Wirtschaftl. | ROI netto (Deckungsbeitrag), Amortisationszeit, Break-Even-Punkt |
| ⑤ KI | Beob: „E-Mail ROI 14×, Instagram ROI 6×". Vorschlag: „E-Mail-Budget kann sich verdoppeln" |
| ⑥ Verknüpft | Kostenposten (Marketing), Aufträge, Rechnungen, Aktionen, BWA |

### 3.4 Kundenzufriedenheit

| Ebene | Inhalt |
|---|---|
| ① KPI | Ø Zufriedenheit (1–5). Trend. Pill: Anzahl Feedbacks |
| ② Chart | Zufriedenheit je Monat + Feedback-Rücklaufquote |
| ③ Zusammensetzung | Feedbacks: Kunde, Datum, Score, Fotos?, Google-Klick? → klick: Feedback-Detail → klick: Kunde → klick: Auftrag |
| ④ Wirtschaftl. | Zufriedenheit ↔ Wiederkaufrate, Bewertungs-Klickrate, Foto-Rücklauf |
| ⑤ KI | Beob: „Museen-Segment hat 4,8/5". Vorschlag: „Dieses Segment für Referenzfotos ansprechen" |
| ⑥ Verknüpft | Feedback-Mails, Kunden, Aufträge, Google-Bewertungen, Segmente, Marketing-Assets |

---

## 4. Performance-Kacheln (Spiegelung)

Performance-Kacheln „Marketing-Wirkung" und „Online-Sichtbarkeit" nutzen **dieselben** Berechnungen wie Marketing (§3) — kein zweiter Datentopf. Verknüpfte Bereiche verweisen zurück zum Marketing-Cockpit.

---

## 5. Dreckecken-Bereinigung (systematisch)

### 5.1 Scan-Auftrag für Antigravity

```text
Prüfe JEDE Kachel in /buchhaltung und /marketing gegen Datei 32 §1:

Für jede Kachel diese Tabelle ausfüllen:
| Kachel | ① KPI echt? | ② Chart? | ③ Einzelposten klickbar? | ④ Wirtschaftl.-KPIs? | ⑤ KI? | ⑥ Verknüpft (Links leben)? | ⑦ Tabs? |

Markiere jede Ebene: ✅ vorhanden / ❌ fehlt / ⚠️ Mock/Konstante.
Liste alle ❌ und ⚠️ als konkrete To-Dos.
```

### 5.2 Typische Dreckecken (häufig bei Antigravity)

| Muster | Problem | Fix |
|---|---|---|
| Chip „BWA" → führt zu `/buchhaltung/bwa` mit Mock-Konstanten | Kreislauf, kein Mehrwert | BWA muss echte Berechnung zeigen (Spec 30 §5.1) |
| Liste von Posten, nicht klickbar | Endstation | Jede Zeile → Detail-Route mit echten Daten |
| „Alle Belege öffnen" → Link fehlt oder geht ins Leere | Toter Link | → `/buchhaltung/belege?kategorie=X&von=Y&bis=Z` |
| Wirtschaftlichkeits-KPIs als Konstanten | Mock versteckt | Berechnung aus echten Daten (Formeln in §2/§3) |
| KI-Einschätzung mit Platzhaltertext | Nicht nützlich | Regelbasierte Aussagen aus echten Daten (Schwellen, Vergleiche) |
| Verknüpfte Bereiche mit toten Chips | Sackgasse | Nur Chips mit echtem, existierendem Ziel |

---

## 6. KI-Einschätzungen — regelbasiert, nicht geraten

Die KI-Absätze (Beobachtung/Vermutung/Vorschlag) sind **keine LLM-Freitexte**, sondern regelbasiert:

```ts
function generateInsight(kachel: string, daten: KachelDaten): Insight {
  const beobachtungen: string[] = [];
  const vermutungen: string[] = [];
  const vorschlaege: Vorschlag[] = [];

  // Beispiel: Kraftstoff
  if (kachel === 'kraftstoff') {
    const delta = daten.trend.prozent;
    if (delta > 10) beobachtungen.push(`Kraftstoffkosten ${delta}% über Vormonat`);
    if (daten.tankungenCount > daten.vormonat.tankungenCount + 2)
      vermutungen.push('Mehr Auslieferungen im Umland');
    if (delta > 15)
      vorschlaege.push({ text: 'Sammelfahrten prüfen', aktion: '/buchhaltung/kraftstoff' });
  }
  
  // Muster: Schwellenwerte, Vergleiche, Kategorien
  return { beobachtungen, vermutungen, vorschlaege };
}
```

Regeln je Kachel in einer zentralen `insights.ts` — erweiterbar, nachvollziehbar, keine Halluzinationen.

---

## 7. Antigravity-Bauauftrag

```text
Lies Datei 32 und die Live-Data-Policy.

PHASE 1: Dreckecken-Scan (F-ANALYSE-00)
  Prüfe jede Kachel gegen §1 (7-Ebenen-Template). Ergebnis: Tabelle §5.1.

PHASE 2: Fehlende Ebenen nachbauen (F-ANALYSE-01 bis F-ANALYSE-XX)
  Pro Kachel: die fehlenden Ebenen ergänzen, Daten aus echten Queries (Spec 30),
  Einzelposten klickbar → Detail-Route, verknüpfte Bereiche mit echten Zielen.
  
  Reihenfolge: UStVA → Kraftstoff → Offene Posten → BWA → Fixkosten →
  Variable → Ausgaben → Sparzähler → Anfragen → Umsatz → ROI → Zufriedenheit.

PHASE 3: KI-Einschätzungen (F-ANALYSE-KI)
  insights.ts mit regelbasierten Schwellen/Vergleichen je Kachel (§6).

PHASE 4: Verknüpfte Bereiche + Keine-Endstation-Prüfung (F-ANALYSE-LINKS)
  Jeder Chip muss zu einer echten Seite mit echten Daten führen.
  Jede Drill-Down-Liste muss klickbare Zeilen haben → Detail.
  Jede Detail-Seite hat Rückweg + verknüpfte Bereiche.

Nach jeder Phase: Nachweis (Screenshot/Tabelle), nicht "erledigt".
```

---

## 8. Akzeptanzkriterien

- [ ] Jede Kachel (Buchhaltung + Marketing) hat alle 7 Ebenen (Scan-Tabelle §5.1 komplett grün).
- [ ] Jeder Einzelposten im Drill-Down ist klickbar → führt zu Beleg/Rechnung/Auftrag/Kunde.
- [ ] Jede Wirtschaftlichkeits-KPI ist berechnet, nicht Konstante.
- [ ] KI-Einschätzungen sind regelbasiert (insights.ts), zeigen echte Daten-Fakten.
- [ ] Verknüpfte Bereiche: jeder Chip führt zu einer echten Seite mit echten Daten.
- [ ] Keine Sackgasse: von jedem Detail-Screen kommt man weiter oder zurück.
- [ ] Tabs „Daten fehlen" zeigt real fehlende Posten; „So erfasst du das" führt zum Erfassungsformular.
- [ ] Demo-/Leerzustand: bei leerer DB zeigt jede Ebene 0 € / leere Liste / „Noch keine Daten", NICHT Mock-Werte.
