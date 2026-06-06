# 20 — Hauptspezifikation: Modul Marketing

**Projekt:** Kreile WerkstattCockpit · **Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** baubar
**Stack:** React PWA + TypeScript, Data-Provider-Pattern, Supabase (Postgres/Storage/Auth/RLS), Drizzle ORM
**Bindet ein:** 00_PRIORITY_RULES_KREILE, SPEC_LICENSE_FEATURE_TOGGLES_v1, 19 (Constraints)

---

## 1. Ziel

Aus einer toten Demo-Seite ein **lebendiges, lernendes Marketing-Cockpit** machen, das ein Betrieb ohne Marketing-Erfahrung in Sekunden bedienen kann. Leitsätze:

- **Eine empfohlene Aktion im Vordergrund** („das bringt heute am meisten"), Rest sortier-/filterbar.
- **Jede Aktion trägt Aufwand, Kosten und erwarteten Umsatz** — vorher sichtbar.
- **End-to-End-Attribution:** Post/Mail → Reichweite → Klick → Anfrage → Auftrag → Umsatz.
- **Das System lernt** aus jeder Aktion (was wirkt bei diesem Betrieb) und verbessert Vorschläge.
- **Vollintegriert:** Kosten → Buchhaltung (Ausgabe), Umsatz → Performance/Buchhaltung (Einnahme).
- Bedienbar „ohne 5 Seiten Anleitung". Abschaltbar per Feature-Toggle.

## 2. Nutzerrollen

| Rolle | Rechte |
|---|---|
| `OWNER` | alles: freigeben, posten, Budget, Kanäle verbinden, Dev-Telemetrie sehen |
| `MARKETING` (optional) | Aktionen vorbereiten/vorschlagen, kein Budget/Kanal-Connect |
| `EMPLOYEE` | nur Foto/Material beisteuern (z. B. Vorher-/Nachher) |
| `READ_ONLY_AUDIT` | lesend |

Plan-Sichtbarkeit gem. `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` (Marketing als eigenes Modul, Pro/Premium-Staffelung — siehe §11).

## 3. Funktionsumfang (Bestand erhalten + neu)

**B** = Bestand, **N** = neu, **Z** = Zusammenführung.

| Funktion | Quelle | Stufe |
|---|---|---|
| Lern-Hero „beste Aktion heute" (1 Klick) | N | 1 |
| Attributions-Funnel (Post→…→Umsatz, ROI) | N | 1 (Web/Mail) / 2 (Social-Insights) |
| Empfohlene Aktionen, sortier-/filterbar (Output/Einfach/Relevanz/Kanal) | N | 1 |
| KI-Ideengebung (Vorschläge + Texte + Hashtags) | N | 1 |
| Kundenreaktivierung (Segmente, personalisierte Mail) | B | 1 |
| Kundensegmente (Oldtimer, Schmuck, Besteck/Silber, Kirchen, Museen, Geschäfts-, Privatkunden) | B | 1 |
| Mailentwürfe + Versandfenster-Empfehlung | B | 1 |
| Wirkung & ROI | B/Z | 1 (real, sobald Attribution greift) |
| Kanal-Verwaltung (Instagram, E-Mail, Google, Web/Anzeigen) | N | 1 (E-Mail) / 2 (Social, Ads) |
| Kosten-/Umsatz-Verknüpfung mit Buchhaltung & Performance | N | 1 |
| Entwickler-Telemetrie (Nutzungs-/Annahmequote) | N | 1 |
| Bezahlte Anzeigen (Budget, Prognose) | N | 2 |

## 4. Sortier-/Filterlogik (Kern der Bedienbarkeit)

Jede empfohlene Aktion hat ein **Wirkungs-Score** und Metadaten:

```
score = w1·erwarteter_output + w2·(1/aufwand) + w3·relevanz_segment + w4·lern_konfidenz − w5·kosten
```

Sortier-Modi (vom Nutzer wählbar, Default „Meister Output"):

| Modus | Sortierschlüssel |
|---|---|
| Meister Output | erwarteter Umsatz/Anfragen absteigend |
| Am einfachsten | Aufwand aufsteigend |
| Relevanz | Segment-Passung + Saisonalität |
| Nach Kanal | gruppiert je Kanal |

Filter: Kanal, Segment, Kosten (0 € / mit Budget), Status. **Alle Aktionen tragen Aufwand-, Kosten- und Output-Tag.**

## 5. Struktur: „Marketing Studio" mit Sub-Navigation (Untermenüs)

Das Modul ist **bewusst auf wenig Inhalt pro Screen** ausgelegt — Tiefe steckt in Untermenüs (Sub-Navigation als Pill-Tabs unter dem Titel, mit animiertem Gleiter). Das nimmt dem Nutzer den Schrecken: jede Sub-View hat genau eine Aufgabe.

```text
/marketing                     Studio (Standard-Sub-View)
  Sub-Views (Tabs, kein Full-Reload — clientseitig umgeschaltet):
   • Studio       Composer-Hero (beste Aktion) + Story-Ideen + 3-Schritte + Wirkung-Mini + Untermenü-Einstiege
   • Ideen        Ideenpool, sortier-/filterbar (Output/Einfach/Relevanz/Kanal)
   • Kampagnen    laufende/geplante Kampagnen + Mini-Timeline + ROI
   • Reichweite   animierter Attributions-Funnel + ROI
   • Kunden       Segmente + Reaktivierungskandidaten
   • Wirkung      Lern-Insights („GELERNT"-Karten) + ROI je Kanal/Segment
/marketing/aktion/[id]         Aktions-Detail: Vorschau, Text/Hashtags anpassen, freigeben
/marketing/kanaele             Kanal-Verbindungen + Status + Einwilligungen
/marketing/einstellungen       Voreinstellungen, Gewichte, Feature-Toggle, Dev-Telemetrie
```

Detailliertes visuelles System, Animationsinventar und Interaktionen siehe **Datei 26 (UI & Designsprache)**.

## 6. Kern-Workflows

### 6.1 Aktion ausführen (1 Klick)
```
System schlägt Aktion vor (Score) → Inhaber öffnet → Vorschau (KI-Text/Bild/Hashtags)
→ optional anpassen → Freigeben → Channel-Adapter führt aus (oder plant)
→ Touchpoint wird erzeugt → Attribution-Tracking startet → Kosten gebucht (falls Budget)
```

### 6.2 Attribution & Lernen
```
Touchpoint (Post/Mail) → UTM/Tracking-Link → Web-Besuch/Anfrage → Lead → Auftrag → Umsatz
→ Ergebnis zurück an Aktion → Lern-Loop aktualisiert Gewichte/Vorschläge (Datei 21)
```

### 6.3 Reaktivierung (Bestand)
```
Segment wählen → Kandidaten (kein Auftrag seit X) → KI-Mail je Kunde → prüfen → senden (mit Einwilligung)
→ Antworten/Aufträge attribuiert → Wirkung & ROI aktualisiert
```

## 7. UI-Prinzipien (verbindlich, „nach Marketing aussehen, ohne Anleitung bedienbar")

- **Rahmen unverändert** (linke Leiste, obere Leiste). Marketing aktiver Menüpunkt; „Performance" als Menüpunkt ergänzen (für Kacheln §10).
- **Eigene Marketing-Identität:** lebendiger Verlaufs-Akzent (Instagram-Energie, Kreile-Magenta integriert), sparsam und gezielt — Hero/Composer, Story-Ringe, aktiver Tab, CTAs, „GELERNT"-Badge. Basis bleibt die warme App-Fläche.
- **Wenig pro Screen, Tiefe in Untermenüs** (§5). Studio-Reihenfolge: **Composer-Hero (beste Aktion) → 3-Schritte-Leiste → Story-Ideen → Wirkung-Mini → Untermenü-Einstiege**.
- **Animiert & interaktiv** (Pflicht, Detail in Datei 26): animierter Composer mit Post-Vorschau, Story-Karussell, hochzählende Kennzahlen, wachsender Funnel, Tab-Gleiter, Hover-Lift, Schimmer auf „GELERNT". Bewegung dezent, nie Selbstzweck; `prefers-reduced-motion` respektieren.
- **Den Schrecken nehmen:** 3-Schritte-Leiste („Foto → Text kommt automatisch → ein Tipp, fertig"), Composer mit fertiger Vorschau, Varianten durchblättern, ein klarer CTA.
- Lern-Badge („GELERNT") als Vertrauens- und Wow-Anker, wo Vorschläge aus Historie stammen.
- „In Vorbereitung" nie tot — führt zu Kanal-Connect/Info. Touch-/Tablet-tauglich, responsiv. Hell/Dunkel über bestehenden Schalter.
- **Referenz-Mockup: `kreile_marketing_studio.html`** (maßgeblich; ersetzt das frühere statische `kreile_marketing.html`).

## 8. Analytics (Inhaber-Sicht)

ROI je Kampagne/Kanal/Segment, Kosten vs. attribuierter Umsatz, beste Zeitfenster, bestes Format, Reaktivierungsquote. Verknüpfung in Performance- und Buchhaltungs-Kacheln (§10).

## 9. Datenschutz

E-Mail nur mit Einwilligung; Tracking mit Consent; Opt-out je Kontakt; EU-Region. Details Datei 24.

## 10. Ergänzungskacheln in anderen Modulen (Pflicht zur Vollintegration)

| Modul | Neue Kachel | Inhalt |
|---|---|---|
| **Performance** | „Marketing-Wirkung" | Anfragen/Aufträge/Umsatz aus Marketing, ROI-Trend, bestes Segment |
| **Performance** | „Akquise-Funnel" | Reichweite → Anfrage → Auftrag, Conversion je Kanal |
| **Buchhaltung** | „Marketingkosten" | Ausgaben je Kanal/Kampagne, automatisch als Ausgabe gebucht |
| **Buchhaltung** | „Umsatz nach Quelle" | Einnahmen-Attribution (Marketing vs. Bestand vs. Empfehlung) |

Diese Kacheln zeigen **dieselben Daten** wie das Marketing-Cockpit, dort wo der Nutzer sie erwartet — keine getrennten Datentöpfe.

## 11. Feature-Toggle / Lizenz

- Gesamtmodul über Feature-Flag `marketing_enabled` abschaltbar (dann verschwindet Menüpunkt + Kacheln).
- Staffelung (Vorschlag, an `SPEC_LICENSE_FEATURE_TOGGLES_v1` andocken): Reaktivierung + E-Mail = Pro; Multi-Channel + Attribution + Lernen + Ads = Premium. Final mit bestehender Plan-Matrix abstimmen (offene Frage).

## 12. Akzeptanzkriterien (Modul)

- [ ] Bestandsfunktionen (Reaktivierung, Segmente, Mailentwürfe, Versandfenster, ROI) erhalten und echt angebunden.
- [ ] Eine empfohlene Aktion steht im Vordergrund; jede Aktion zeigt Aufwand/Kosten/Output.
- [ ] Sortier-Modi und Filter funktionieren.
- [ ] Attributions-Funnel zeigt Post→…→Umsatz mit ROI; Web/Mail real (Stufe 1).
- [ ] Kosten erscheinen automatisch in Buchhaltung, Umsatz in Performance/Buchhaltung.
- [ ] Lern-Loop verändert nachweislich Vorschläge (Datei 21-Test).
- [ ] Dev-Telemetrie vorhanden, abschaltbar, anonymisiert.
- [ ] Gesamtmodul per Feature-Toggle abschaltbar.
- [ ] Bedien-Test: Aktion in ≤ 2 Taps absetzbar, ohne Anleitung verständlich.

## 13. Annahmen

- Instagram = Business-Konto vorhanden/erstellbar (API-Voraussetzung, Datei 22).
- Umsatz-/Auftragsdaten kommen aus bestehenden Modulen (read-only).
- Segmente entsprechen den Bestands-Segmenten + sind erweiterbar.

## 14. Offene Fragen

1. Plan-Staffelung Marketing in der bestehenden Lizenz-Matrix (Pro vs. Premium-Grenze)?
2. E-Mail-Versandprovider-Wahl (Brevo / Resend / Postmark) — Zustellbarkeit + DSGVO.
3. Social-Reichweite: nur eigene Insights (Stufe 1) oder auch bezahlte Anzeigen (Stufe 2) zum Start?
