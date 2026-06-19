# Kreile Website — Vollständige Spezifikation v3.1

**Quelle:** WEBSITE_Galvanik_Kreile_v3_1.md + v1–v3  
**Stand:** 18. Juni 2026 (Spec-Datum: 20. Mai 2026)  
**Status:** Spec vollständig, noch nicht gebaut

---

## 1. Stammdaten

- **Firmierung:** Galvanischer Betrieb Rolf Kreile
- **Inhaber:** Rolf Kreile
- **Adresse:** Kölner Str. 80, 60327 Frankfurt am Main
- **Telefon:** +49 69 735765 | **Fax:** +49 69 73900976
- **E-Mail:** info@galvanik-kreile.de
- **Website:** https://www.galvanik-kreile.de/
- **Social:** facebook.com/GalvanikKreile · instagram.com/galvanikkreile
- **Gründung:** 1962 (Richard Kreile → Rolf → Phillip — 3. Generation)
- **Öffnungszeiten:** Mo 10–13, Di–Do 10–19, Fr 10–20, Sa/So geschlossen
- **Besonderheit:** "Meisterbetrieb seit 1962" — einheitlich verwenden (nicht 1989!)

---

## 2. Ausgangslage

**Bisherige Website:** One-Pager mit Anchor-Navigation (Über uns, Service, Portfolio, Kontakt)  
**Tools aktuell:** Vimeo, Google Fonts, Google Maps, Google reCAPTCHA, Host Europe (DE)

**Schwächen der alten Site:**
- One-Pager → kein SEO, keine differenzierte Conversion
- Unstrukturiertes Kontaktformular → soll 5-Schritte-Wizard werden
- Keine Vorher/Nachher-Wirkung → Portfolio mit Split-Slider
- Keine Erwartungssteuerung (Preis, Dauer)
- Keine Versandhinweise
- Leere Statistik-Counter → mit echten oder konservativen Werten füllen

---

## 3. Produktprinzip

Website = öffentlicher Eingang zur Marke Kreile.  
Phase 1: sammelt Anfragen in eigener Supabase-Instanz.  
Phase 2: teilt sich gemeinsamen Datenkern mit der App.

**Ziel:** Besser performen, besser konvertieren, besser wirken als bisherige Site.  
Zusätzlich: Basis für Kundenportal, Marketing-Tracking, Chef-Dashboard mit Funnel-Daten.

---

## 4. Stack

```
Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
Supabase (Phase 1: Anfragen-DB; Phase 2: gemeinsam mit App)
Vimeo Background Player (bestehendes Hero-Video)
Plausible oder Umami für DSGVO-konformes Analytics
```

---

## 5. Seitenstruktur

| Seite | Zweck |
|---|---|
| `/` | Startseite — Hero, Emotion, Kernbotschaft, CTA |
| `/leistungen` | Service-Übersicht: Galvanik, Verchromung, Restauration etc. |
| `/leistungen/[slug]` | Detailseite je Leistung |
| `/oldtimer` | Oldtimer-Spezialseite (emotional, Konversions-stark) |
| `/industrie` | Industriekunden-Seite |
| `/portfolio` | Referenz-Übersicht mit Filter |
| `/portfolio/[slug]` | Story-Seite je Referenzprojekt (Vorher/Nachher) |
| `/ablauf` | So funktioniert ein Auftrag + Erwartungssteuerung |
| `/versand` | Versandhinweise + PDF-Packliste |
| `/ueber-uns` | Geschichte, Team, Werkstatt, 4. Generation |
| `/presse` | Pressestimmen, Downloads |
| `/anfrage` | 5-Schritte-Wizard |
| `/kontakt` | Kontaktdaten, Karte |
| `/impressum` | Pflichtseite |
| `/datenschutz` | Pflichtseite |

---

## 6. Hero-Seite (/)

**Hero-Video:** Vimeo `415243473` — Background-Player mit `background=1&dnt=true`

Kernbotschaft:
```
Galvanik Kreile
Meisterbetrieb für Galvanik und Restauration seit 1962
Frankfurt am Main · 3. Generation

[Anfrage stellen] [Portfolio ansehen]
```

Konversionshebel:
- Counter: "Seit 1962 · Über X restaurierte Objekte · Kunden aus ganz Deutschland"
- Referenzlogos (12 Referenzkunden)
- Pressezitat prominent

---

## 7. Anfrage-Wizard (5 Schritte)

**Pflicht-Foto-Upload** — kein Absenden ohne Foto.

```
Schritt 1: Was möchten Sie bearbeiten lassen?
  → Auswahl: Oldtimer-Teil / Motorradteil / Möbel/Beschlag / Industrieteil / Kunstobjekt / Anderes

Schritt 2: Was soll gemacht werden?
  → Auswahl: Verchromen / Vernickeln / Polieren / Entlacken / Restauration / Ich bin unsicher

Schritt 3: Foto hochladen
  → Pflicht: mindestens 1 Foto des Teils
  → Optional: 2. Foto, Begleitzettel
  → Hinweis: je besser das Foto, desto präziser die Antwort

Schritt 4: Kontaktdaten
  → Name, Telefon, E-Mail
  → Optional: Firma, Adresse

Schritt 5: Zusammenfassung + Absenden
  → Vorschau aller Angaben
  → Datenschutzhinweis
  → "Anfrage absenden"

Nach Absenden:
  → Bestätigungs-E-Mail automatisch
  → Supabase speichert Anfrage + Fotos
  → (Phase 2: direkt in App-Inbox)
```

---

## 8. Portfolio

**Referenzprojekte (15 vorhanden):**
- Ben R. Clement
- Pontiac Radkappe
- Harley Davidson (Porsche-Motor)
- Columbus 1919 (Rahmen)
- BMW BBS RC Felge (E30)
- Louis Vuitton
- Mercedes 220b Cabrio
- Hermès
- Bianchi
- BMW Motorrad
- Kunstprojekte verkupfert (mehrere)

**Story-Seite je Referenz:**
- Vorher/Nachher Split-Slider
- Herausforderung / Lösung / Ergebnis
- Material, Technik, Bearbeitungszeit
- Kundenaussage (wenn vorhanden)

---

## 9. Assets — Übernahme

| Asset | Verwendung |
|---|---|
| Hero-Video Vimeo `415243473` | 1:1 übernehmen |
| Logo `galvanikkreile_logo_white.png` | übernehmen + als SVG vektorisieren |
| Über-uns-Foto `about.jpg` | übernehmen |
| Service-Bilder (6) | 1:1 übernehmen |
| 12 Referenzlogos (Sony Music, DFB, Eintracht, MMK, Continental, Jensen Classics, Rosso Bianco, Mansory, Feierabend, Buchmann, Stickel, Inntal) | übernehmen, normalisiert auf weißem Grund |
| 15 Portfolio-Projekte | übernehmen + Vorher-Fotos ergänzen |
| Pressestimmen × 5 (MOTORRAD Classic 2023, Autobild-Klassik 2012, Kabel 1 2004, Motor Klassik 2002/1991/1988) | übernehmen, eigenes Pressezentrum |

---

## 10. Conversion-Logik

**Primäres Ziel:** Anfrage über Wizard.  
**Sekundäres Ziel:** Telefon-CTA.

**CTA-Hierarchie:**
1. "Anfrage stellen" (Wizard) — überall sichtbar
2. Telefon als zweite Option
3. E-Mail als dritte Option

**Vertrauen aufbauen:**
- Pressestimmen (5 bekannte Medien)
- 12 prominente Referenzkunden
- 60+ Jahre Tradition
- 3. Generation
- Foto-Beweise (Portfolio)
- Ablauf-Seite: Erwartungen steuern, Ängste reduzieren

**Ablauf-Seite Inhalt:**
- So funktioniert ein Auftrag (Schritte)
- Typische Preisrahmen (wenn möglich)
- Typische Bearbeitungszeit
- Versandhinweise + Packliste PDF
- FAQ

---

## 11. Analytics & Tracking

**Phase 1:** Plausible oder Umami (DSGVO-konform, kein Cookie-Banner nötig)

**Wichtigste Events:**
- Wizard gestartet
- Wizard Schritt 1–5 abgeschlossen
- Foto hochgeladen
- Anfrage abgesendet
- Telefon-Link geklickt
- Portfolio-Seite geöffnet

**Chef-Dashboard (Phase 2):**
- Funnel-Daten: Besucher → Wizard-Start → Anfrage gesendet
- Top-Referenzprojekte (nach Klicks)
- Anfragen pro Woche/Monat
- Herkunft der Anfragen (Oldtimer / Industrie / Möbel etc.)

---

## 12. DSGVO / Datenschutz

- Cookie-Banner nur wenn notwendig (Plausible/Umami: kein Banner nötig)
- Fotos aus Anfragen: in Supabase, nur für internen Zugriff
- Vimeo mit `dnt=true`-Parameter
- Kontaktformular: Einwilligung explizit

---

## 13. Verhältnis Website ↔ App

| Phase | Integration |
|---|---|
| Phase 1 | Website hat eigene Supabase-Instanz für Anfragen |
| Phase 2 | Anfragen aus Website landen direkt in App-Inbox |
| Phase 3 | Kundenportal: Kunden sehen Auftragsstatus online |

---

## 14. Akzeptanzkriterien

1. Conversion Rate Anfragen > bisherige Site (Baseline: messen ab Launch)
2. Google Lighthouse: ≥ 90 Performance, ≥ 95 Accessibility
3. Wizard-Abschlussrate ≥ 60% (wer Schritt 1 macht, macht auch Schritt 5)
4. Jede Service-Seite hat mind. 1 Portfolio-Referenz
5. Ablauf-Seite reduziert Anfragen mit fehlenden Informationen
6. Site funktioniert ohne JavaScript als Fallback (kein total leerer Screen)
