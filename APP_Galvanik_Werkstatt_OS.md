# APP.md – Galvanik Werkstatt-OS MVP

**Projekt:** Interne Werkstatt-App für einen kleinen Galvanik-/Restaurationsbetrieb  
**Zielbetrieb:** ca. 5 Mitarbeiter, überwiegend Privatkunden, emotionale Einzelstücke, geringe Digitalisierungsreife, viel Papier/Zettelwirtschaft  
**Arbeitsname:** `Galvanik Werkstatt-OS`  
**Version:** MVP-Spezifikation v1.0  
**Erstellt am:** 2026-05-18  
**Zielwerkzeuge:** Antigravity / Gravity + Claude Code  
**Primäres Gerät:** Tablet im Wareneingang und in der Werkstatt  
**Leitidee:** Jeder Auftrag, jedes Teil, jeder Lagerort und jeder nächste Arbeitsschritt muss sofort sichtbar sein.

---

## 1. Zweck der App

Die App soll kein überladenes ERP-System (große Unternehmenssoftware für alle Betriebsbereiche) werden, sondern ein leicht bedienbares **Betriebsnervensystem** für die Werkstatt.

Sie ersetzt nicht das handwerkliche Können, sondern beseitigt die organisatorische Unschärfe:

- keine Teile ohne digitalen Auftrag
- keine Kundenware ohne Foto
- kein Lagerplatz ohne Zuordnung
- kein Auftrag ohne Status
- kein zugesagter Termin ohne realistische Risikoanzeige
- kein Kostenvoranschlag ohne nachvollziehbare Positionen
- keine Rechnung oder Versandmail aus doppelt erfassten Daten
- keine Reklamation ohne Rückgriff auf frühere Fotos, Preise, Zusagen und Bearbeitungsschritte

---

## 2. Hauptprobleme, die gelöst werden müssen

### 2.1 Ist-Zustand

| Bereich | Heute | Problem |
|---|---|---|
| Kundendaten | manuell im Auftragsbuch | schwer suchbar, keine Historie, kein Preisvergleich |
| Auftragserfassung | meist handschriftlich / rudimentär | unvollständig, nicht auswertbar |
| Wareneingang | Teile können verpackt liegen bleiben | unsichtbarer Rückstau |
| Lagerung | Regal grundsätzlich vorhanden, aber ohne systematische Zuordnung | Suchen, Vergessen, Verwechslung |
| Fotos | nicht systematisch | Streitpotenzial bei Vollständigkeit, Zustand, Reklamation |
| KV | oft eine Zeile mit Preis | wenig Transparenz, schwer wiederholbar |
| Terminversprechen | oft optimistisch | Kundenfrust, ständige Nachfragen |
| Produktionssteuerung | Zuruf / Bauchgefühl / wer fragt am lautesten | falsche Prioritäten |
| Büroarbeit | KV, Rechnung, Mails manuell | hoher Zeitverlust |
| Reklamationen | schwer nachvollziehbar | keine saubere Beweislage |
| ähnliche Altaufträge | nicht nutzbar | Preise schwanken, Wissen bleibt im Kopf |

### 2.2 Ziel-Zustand

| Bereich | Ziel |
|---|---|
| Auftrag | digitale Auftragskarte mit Status, Fotos, Positionen, Lagerort |
| Kunde | perfekte Kundenkartei mit Historie, Preisen, Reklamationen, Präferenzen |
| Teil | jedes Teil oder Teilset erhält QR-Code / Barcode |
| Lager | jeder Regalplatz, Kasten oder Wagen erhält Standort-ID |
| Workflow | Standardabläufe pro Teiletyp und Oberfläche |
| Planung | farbliche Durchlaufzeit- und Risikologik |
| KV | transparente Positionen mit Beispielwerten und Erfahrungsdaten |
| Rechnung | Export oder Übergabe an Lexware / DATEV / vorhandenes System |
| Kommunikation | hochwertige Statusmails aus der App |
| Reklamation | vollständige Rückschau auf Fotos, Status, Mitarbeiter, Preise, Notizen |

---

## 3. MVP-Grundsatz

**MVP = klein, aber vollständig nutzbar.**

Die App darf im ersten Schritt bewusst einfach sein. Entscheidend ist, dass sie im Alltag sofort Ordnung schafft.

### Muss im MVP enthalten sein

1. Kundenkartei
2. Auftragserfassung
3. Teileerfassung mit Fotos
4. Lagerortzuweisung
5. QR-/Barcode-Labels
6. Statussystem
7. farbliche Durchlaufzeit- und Risikoanzeige
8. Auftragsboard
9. Produktionsboard nach Stationen
10. KV-Erstellung
11. Status-E-Mail
12. Versand- und Abholstatus
13. Reklamations-/Nacharbeitsfunktion
14. Suche nach ähnlichen Altaufträgen
15. Platzhalter für Lexware / DATEV / Outlook / Hardware

### Nicht im MVP zwingend

| Funktion | Entscheidung |
|---|---|
| vollständiges Kundenportal | Button und Architektur vorbereiten, Inbetriebnahme später |
| WhatsApp Business | nicht erforderlich, Statusmails reichen zunächst |
| KI-Chatbot für Kunden | nicht priorisieren |
| automatische Preisfreigabe durch KI | nicht zulassen |
| vollständige Buchhaltung | nicht nachbauen, Export/Übergabe vorbereiten |
| komplexe Maschinenplanung | nicht nötig, einfache Kapazitäts- und Ampellogik genügt |

---

## 4. Systemname und Tonalität

### Arbeitstitel

`Galvanik Werkstatt-OS`

Alternativen:

- `Kreile WerkstattCockpit`
- `ChromFlow`
- `WerkstattPilot`
- `GalvanoBoard`
- `TeilePilot`

### Tonalität der App

- sachlich
- extrem übersichtlich
- robust
- große Buttons
- wenig Freitext
- viele Vorlagen
- schnelle Erfassung
- keine verspielte Start-up-Optik
- eher Meisterbetrieb als SaaS-Spielzeug

---

## 5. Rollen und Rechte

| Rolle | Rechte |
|---|---|
| Admin / Chef | alles sehen, Preise ändern, Benutzer verwalten, Berichte, Einstellungen |
| Büro | Kunden, Aufträge, KV, Rechnung, Mails, Versand |
| Wareneingang | Kunde suchen/anlegen, Teile fotografieren, Lagerort zuweisen |
| Schleiferei | eigene Warteschlange, Status ändern, Fotos/Notizen ergänzen |
| Galvanik | eigene Warteschlange, Prozessstatus ändern, Probleme melden |
| Versand | fertig melden, Paketdaten, Trackingnummer, Versandmail |
| Lesemodus | nur suchen und ansehen |

### Sprachoptionen

Mindestens:

- Deutsch
- Französisch für Werkstattnutzer, insbesondere Schleiferei

Platzhalter:

```yaml
languages:
  default: de
  enabled:
    - de
    - fr
```

---

## 6. Software- und Hardware-Platzhalter

Diese Werte werden später konkret ersetzt.

```yaml
software:
  accounting:
    current_system: "[PLATZHALTER: Lexware-Version eintragen]"
    datev_available: true
    datev_method: "[PLATZHALTER: DATEV Export / Rechnungsdatenservice / Steuerberater]"
  email:
    current_system: "Outlook"
    smtp_or_graph_api: "[PLATZHALTER]"
    sender_address: "[PLATZHALTER: z.B. status@firma.de]"
  storage:
    provider: "[PLATZHALTER: lokal / OneDrive / SharePoint / S3 / Supabase Storage]"
  hosting:
    provider: "[PLATZHALTER]"
  domain:
    domain_name: "[PLATZHALTER]"
  ai:
    provider: "[PLATZHALTER: OpenAI / Anthropic / lokal / deaktiviert]"
    vision_enabled: true
    structured_output_enabled: true

hardware:
  tablets:
    intake_tablet: "[PLATZHALTER: z.B. iPad / Android Tablet]"
    workshop_tablet: "[PLATZHALTER]"
  scanner:
    type: "[PLATZHALTER: Kamera-Scan / Bluetooth-Scanner / USB-Scanner]"
  label_printer:
    model: "[PLATZHALTER: Brother / Zebra / Dymo]"
    label_size: "[PLATZHALTER: z.B. 50x25 mm]"
  photo_station:
    lighting: "[PLATZHALTER]"
    background: "[PLATZHALTER]"
  network:
    wifi_quality: "[PLATZHALTER]"
```

---

## 7. Kernobjekte des Datenmodells

### 7.1 Übersicht

| Objekt | Zweck |
|---|---|
| Customer | Kunde / Auftraggeber |
| CustomerContact | abweichende Kontaktperson |
| CustomerAsset | Fahrzeug, Möbel, Besteckserie, Motorrad, Oldtimerprojekt etc. |
| Order | Hauptauftrag |
| OrderItem | einzelnes Teil oder Teilgruppe |
| ItemPhoto | Foto je Teil / Zustand / Arbeitsschritt |
| Location | Regal, Fach, Wagen, Kiste |
| WorkflowTemplate | Standardablauf je Teiletyp |
| WorkflowStep | konkreter Arbeitsschritt eines Auftrags |
| Quote | Kostenvoranschlag |
| QuoteLine | einzelne KV-Position |
| InvoiceReference | Rechnungsdaten / Lexware-/DATEV-Bezug |
| Shipment | Versand, Abholung, Tracking |
| CommunicationLog | E-Mails, Telefonnotizen, Zusagen |
| Complaint | Reklamation / Nacharbeit |
| PriceReference | historische Preisreferenz |
| Blocker | Hindernis: Kunde, Material, Schaden, Freigabe |
| AuditLog | Wer hat wann was geändert? |
| SystemSetting | Einstellungen |
| Employee | Mitarbeiter |
| CapacityCenter | Wareneingang, Schleiferei, Galvanik etc. |

---

## 8. Perfekte Kundenkartei

Die Kundenkartei ist ein zentrales Element. Sie muss so gut sein, dass ein Büro-Mitarbeiter nach 10 Sekunden versteht:

1. Wer ist der Kunde?
2. Was hat er früher gebracht?
3. Welche Preise wurden berechnet?
4. Gab es Probleme?
5. Welche Oberfläche wurde gewünscht?
6. Welche Besonderheiten gibt es?
7. Wie empfindlich ist der Kunde bei Terminen oder Preis?
8. Gibt es ähnliche Teile als Preisreferenz?

### 8.1 Kundendaten

```yaml
customer:
  customer_id: "K-000123"
  customer_type: "Privatkunde"
  company_name: ""
  salutation: "Herr"
  first_name: "Max"
  last_name: "Mustermann"
  street: "Musterstraße 12"
  zip: "60327"
  city: "Frankfurt am Main"
  country: "Deutschland"
  phone: "+49 170 1234567"
  email: "max.mustermann@example.de"
  preferred_contact_channel: "E-Mail"
  language: "de"
  tax_id: ""
  created_at: "2026-05-18"
  customer_since: "2024-03-12"
  source: "Empfehlung"
  notes_internal: "Oldtimerkunde, legt großen Wert auf Originaloptik."
```

### 8.2 Kundenprofil im UI

| Feld | Beispiel | Zweck |
|---|---|---|
| Kundennummer | K-000123 | eindeutige Suche |
| Name | Max Mustermann | Identifikation |
| Kontakt | Telefon, E-Mail | schnelle Rückfrage |
| Adresse | vollständig | Versand/Rechnung |
| Sprache | Deutsch | E-Mail-Vorlagen |
| Kundentyp | Privatkunde | Preis-/Kommunikationslogik |
| Quelle | Empfehlung / Google / Stammkunde | Marketingauswertung |
| Zuverlässigkeit | zahlt pünktlich / diskutiert oft | interne Einschätzung |
| Terminsensibilität | hoch / mittel / niedrig | Planung |
| Preisniveau | normal / sensibel / premium | KV-Kommunikation |
| Reklamationshistorie | keine / vorhanden | Risikohinweis |
| emotionale Relevanz | Oldtimer / Erbstück / Möbel / Besteck | Tonalität der Kommunikation |

### 8.3 Kundenkarte: Tabs

Die Kundenkartei bekommt Tabs:

1. **Übersicht**
2. **Aufträge**
3. **Teilehistorie**
4. **Preisreferenzen**
5. **Fahrzeuge / Objekte**
6. **Kommunikation**
7. **Reklamationen**
8. **Dokumente**
9. **Interne Notizen**

---

## 9. Kundenkarte – UI-Layout

### 9.1 Obere Kopfzeile

```text
┌──────────────────────────────────────────────────────────────┐
│ K-000123 | Max Mustermann                         Stammkunde │
│ max.mustermann@example.de | +49 170 1234567                  │
│ Frankfurt am Main | bevorzugt E-Mail | Sprache: DE           │
│ Risiko: niedrig | Terminsensibel: hoch | Reklas: 0           │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Schnellaktionen

Buttons:

- Neuer Auftrag
- Neue Anfrage
- Ähnliche Teile suchen
- E-Mail schreiben
- Adresse kopieren
- Reklamation erfassen
- Preisreferenz anzeigen
- Kundenportal öffnen *(deaktiviert / später)*

### 9.3 Historie

| Datum | Auftrag | Teil | Oberfläche | Preis netto/brutto | Dauer | Ergebnis |
|---|---|---|---|---:|---:|---|
| 2025-08-12 | A-2025-0087 | Stoßstangenecke Mercedes W108 | Chrom hochglanz | 420 € | 47 Tage | abgeschlossen |
| 2025-11-03 | A-2025-0142 | Türgriff Porsche 911 | Chrom hochglanz | 180 € | 33 Tage | abgeschlossen |
| 2026-02-19 | A-2026-0021 | Lampenring BMW R75 | Nickel/Chrom | 95 € | 28 Tage | Nacharbeit Politur |

---

## 10. Preisreferenz-System

Ziel: Bei ähnlichen Teilen sollen alte Preise gefunden werden, damit Angebote konsistenter werden.

### 10.1 Preisreferenz-Felder

```yaml
price_reference:
  reference_id: "PR-000456"
  customer_id: "K-000123"
  order_id: "A-2025-0087"
  item_type: "Oldtimer-Stoßstange"
  vehicle_or_object: "Mercedes W108"
  material_guess: "Stahl"
  old_coating: "Chrom alt, rostig"
  surface_target: "Chrom hochglanz"
  damage_level: "mittel"
  repair_needed: true
  soldering_needed: false
  polishing_level: "hoch"
  quote_price_gross: 420.00
  final_price_gross: 420.00
  labor_hours_estimated: 3.5
  labor_hours_actual: 4.0
  throughput_days: 47
  notes: "Rostpickel stärker als auf Foto sichtbar. Zwischenschliff nach Kupfer nötig."
```

### 10.2 Ähnliche Teile suchen

Filter:

- Teiletyp
- Fahrzeug / Objekt
- Material
- Altbeschichtung
- gewünschte Oberfläche
- Schadensgrad
- Größe
- Reparaturbedarf
- Preisbereich
- Jahr

UI-Ausgabe:

```text
Ähnliche historische Fälle:

1. A-2025-0087 | Stoßstangenecke Mercedes W108 | Chrom | 420 € | 47 Tage | Schaden mittel
2. A-2024-0199 | Stoßstange Opel Rekord C | Chrom | 690 € | 62 Tage | Schaden hoch
3. A-2025-0111 | Motorradlenker BMW | Chrom | 240 € | 38 Tage | Schaden niedrig

Vorschlag: KV-Spanne 550–750 € brutto, abhängig von Rosttiefe und Richt-/Lötbedarf.
```

---

## 11. Digitales Auftragsbuch

Das heutige Auftragsbuch wird nicht einfach digital kopiert, sondern operativ erweitert.

### 11.1 Mindestfelder

| Feld | Beispiel |
|---|---|
| Auftragsnummer | A-2026-0042 |
| Eingangsdatum | 2026-05-18 |
| Kunde | Max Mustermann |
| Kundennummer | K-000123 |
| Teileanzahl | 4 |
| Kurzbeschreibung | Stoßstange Opel Rekord C, 2 Hörner, 2 Halter |
| gewünschte Oberfläche | Chrom hochglanz |
| Status | In Schleiferei |
| aktueller Lagerort | R2-F3-Kiste07 |
| Priorität | Normal |
| zugesagter Termin | 2026-07-15 |
| Risikostatus | Rot |
| KV-Status | angenommen |
| KV-Betrag | 890 € brutto |
| Rechnung | offen |
| Versand / Abholung | Versand |
| Tracking | noch nicht vorhanden |
| letzter Kundenkontakt | 2026-05-24 |
| interne Notiz | Kunde hat Oldtimer-Termin Anfang August |

### 11.2 Beispiel-Aufträge

| Auftrag | Kunde | Teil | Eingang | Status | Farbe | Nächster Schritt |
|---|---|---|---|---|---|---|
| A-2026-0042 | Mustermann | Stoßstange Opel Rekord C | 18.05.2026 | Wareneingang geprüft | Grün | KV erstellen |
| A-2026-0039 | Schneider | Möbelbeschläge | 12.05.2026 | wartet auf Freigabe | Grau | Kunde erinnern |
| A-2026-0028 | Weber | Motorradlenker | 28.04.2026 | Schleiferei | Gelb | bis Freitag polieren |
| A-2026-0017 | Berger | Stoßstange Mercedes | 08.04.2026 | Galvanik | Rot | heute prüfen |
| A-2026-0008 | Klein | Besteckteile | 25.03.2026 | blockiert | Grau | fehlende Teile klären |

---

## 12. Auftragsnummern und Teile-IDs

### 12.1 Nummernlogik

```text
Auftrag: A-YYYY-NNNN
Kunde: K-NNNNNN
Teil: T-YYYY-NNNN-XX
Lagerort: L-Bereich-Regal-Fach
KV: KV-YYYY-NNNN
Rechnung: nach Lexware/DATEV oder Platzhalter
```

Beispiel:

```text
Auftrag: A-2026-0042
Teil 1: T-2026-0042-01
Teil 2: T-2026-0042-02
Lagerort: L-WE-R2-F3
```

### 12.2 QR-Label-Inhalt

QR-Code enthält:

```json
{
  "type": "order_item",
  "order_id": "A-2026-0042",
  "item_id": "T-2026-0042-01",
  "url": "https://app.domain.de/orders/A-2026-0042/items/T-2026-0042-01"
}
```

Auf dem Label sichtbar:

```text
A-2026-0042 / T-01
Mustermann
Stoßstange Opel Rekord C
Chrom hochglanz
```

---

## 13. Lagerort-System

### 13.1 Bereiche

| Kürzel | Bereich |
|---|---|
| WE | Wareneingang |
| PR | Prüfung / KV |
| ENT | Entmetallisierung |
| REP | Reparatur / Löten |
| SCH | Schleiferei |
| POL | Politur |
| GAL | Galvanik |
| QS | Qualitätskontrolle |
| VER | Versand |
| ABH | Abholung |
| BLO | blockierte Ware |

### 13.2 Lagerort-Beispiele

```text
L-WE-R1-F1
L-WE-R1-F2
L-SCH-R2-F4
L-GAL-WAGEN-01
L-QS-TISCH-02
```

### 13.3 Scan-Ablauf

1. Teil scannen
2. Lagerort scannen
3. App fragt: „Teil T-01 nach L-SCH-R2-F4 bewegen?“
4. Nutzer bestätigt
5. Ereignis wird protokolliert

---

## 14. Statussystem

### 14.1 Hauptstatus

| Status | Bedeutung |
|---|---|
| Anfrage | Kunde hat angefragt, Ware noch nicht da |
| Wareneingang offen | Ware da, aber noch nicht vollständig geprüft |
| Geprüft | Teile fotografiert, gezählt, Zustand erfasst |
| KV offen | KV muss erstellt werden |
| Wartet auf Freigabe | KV gesendet, Kunde muss zustimmen |
| Freigegeben | Bearbeitung darf starten |
| In Bearbeitung | Auftrag ist aktiv in Produktion |
| Blockiert | Bearbeitung kann nicht weitergehen |
| QS | Qualitätskontrolle |
| Versandbereit | fertig, wartet auf Versand |
| Abholbereit | fertig, wartet auf Abholung |
| Versendet | Paket unterwegs |
| Abgeschlossen | Auftrag erledigt |
| Reklamation | Kunde reklamiert oder Nacharbeit läuft |
| Storniert | Auftrag abgebrochen |

### 14.2 Werkstattstatus

| Substatus | Station |
|---|---|
| Unausgepackt | Wareneingang |
| Ausgepackt / fotografiert | Wareneingang |
| Vollständigkeit unklar | Wareneingang |
| Altbeschichtung prüfen | Prüfung |
| Entmetallisieren | Entmetallisierung |
| Entmetallisiert | Entmetallisierung |
| Reparatur nötig | Reparatur |
| Löten / Richten | Reparatur |
| Schleifen grob | Schleiferei |
| Schleifen fein | Schleiferei |
| Polieren | Politur |
| Verkupfern | Galvanik |
| Kupfer schleifen | Schleiferei |
| Nickel | Galvanik |
| Chrom | Galvanik |
| Nachpolitur | Politur |
| QS bestanden | QS |
| QS Nacharbeit | QS |
| Verpacken | Versand |
| Tracking erstellt | Versand |

---

## 15. Farblogik und Ampel

### 15.1 Farben

| Farbe | Bedeutung | Aktion |
|---|---|---|
| Grün | im Plan | normal bearbeiten |
| Gelb | Risiko steigt | beobachten / in Tagesplan aufnehmen |
| Orange | kritisch | aktiv priorisieren |
| Rot | überfällig oder negativer Puffer | sofortige Entscheidung nötig |
| Grau | blockiert | Grund klären, nicht in normale Planung zählen |
| Blau | fertig / Versand / Abholung | Büro/Versand |
| Lila | Eilauftrag | bewusst gesetzte Priorität |

### 15.2 Regeln

```yaml
color_rules:
  green:
    condition: "days_until_due > estimated_remaining_days + 10"
  yellow:
    condition: "days_until_due <= estimated_remaining_days + 10"
  orange:
    condition: "days_until_due <= estimated_remaining_days + 5"
  red:
    condition: "days_until_due < estimated_remaining_days OR days_in_current_status > max_allowed_days"
  gray:
    condition: "blocked == true"
  blue:
    condition: "status in ['Versandbereit', 'Abholbereit', 'Versendet']"
  purple:
    condition: "priority == 'Eilauftrag'"
```

### 15.3 Liegezeit-Regeln je Station

| Station | Warnung gelb nach | Rot nach |
|---|---:|---:|
| Wareneingang unausgepackt | 1 Tag | 2 Tage |
| KV offen | 2 Tage | 4 Tage |
| Wartet auf Freigabe | 5 Tage | 10 Tage |
| Entmetallisierung | 3 Tage | 7 Tage |
| Schleiferei | 7 Tage | 14 Tage |
| Galvanik | 5 Tage | 10 Tage |
| QS | 2 Tage | 4 Tage |
| Versandbereit | 1 Tag | 3 Tage |

Diese Werte sind Platzhalter und müssen nach 4 Wochen Echtdaten angepasst werden.

---

## 16. Prioritätslogik

### 16.1 Prioritätswert

Jeder Auftrag bekommt einen Score.

```text
Prioritätswert =
  Alter des Auftrags
+ Terminrisiko
+ Eilaufschlag
+ Kundentyp
+ Blocker-Schwere
+ Reklamationsrisiko
- Wartezeit auf Kundenfreigabe
```

### 16.2 Beispielgewichtung

```yaml
priority_score:
  days_since_arrival: 1.0
  due_date_risk: 3.0
  express_order: 25
  complaint: 30
  high_value_customer: 10
  blocked_waiting_customer: -20
  current_station_overdue: 15
```

### 16.3 Ergebnis im UI

| Auftrag | Score | Farbe | Empfehlung |
|---|---:|---|---|
| A-2026-0017 | 94 | Rot | heute Galvanik prüfen |
| A-2026-0028 | 67 | Orange | bis Freitag schleifen |
| A-2026-0042 | 22 | Grün | normaler Lauf |
| A-2026-0039 | -5 | Grau | Kunde muss freigeben |

---

## 17. Kapazitätslogik

Die App soll keine industrielle Feinplanung simulieren, sondern simpel helfen.

### 17.1 Bearbeitungszentren

| Center | Kürzel | Kapazität pro Tag – Platzhalter |
|---|---|---:|
| Wareneingang / Büro | WE | 3 Aufträge |
| Prüfung / KV | KV | 3 Aufträge |
| Entmetallisierung | ENT | 4 Aufträge |
| Reparatur / Löten | REP | 2 Stunden |
| Schleiferei | SCH | 6 Stunden |
| Politur | POL | 4 Stunden |
| Galvanik | GAL | 5 Stunden |
| QS / Versand | QS | 4 Aufträge |

### 17.2 Beispiel-Konfiguration

```yaml
capacity_centers:
  - id: "SCH"
    name: "Schleiferei"
    daily_capacity_hours: 6
    responsible_role: "Schleiferei"
    default_warning_wip_hours: 24
  - id: "GAL"
    name: "Galvanik"
    daily_capacity_hours: 5
    responsible_role: "Galvanik"
    default_warning_wip_hours: 20
```

### 17.3 WIP-Anzeige

WIP = Work in Progress (Umlaufbestand / gerade im System befindliche Arbeit).

| Center | aktueller Restaufwand | Tageskapazität | Auslastung | Farbe |
|---|---:|---:|---:|---|
| Wareneingang | 7 Aufträge | 3 Aufträge | 233 % | Rot |
| Schleiferei | 31 h | 6 h | 517 % | Rot |
| Galvanik | 12 h | 5 h | 240 % | Orange |
| Versand | 3 Aufträge | 4 Aufträge | 75 % | Grün |

---

## 18. Standardworkflow: verchromte Oldtimer-Stoßstange

### 18.1 Beispiel-Auftrag

```yaml
order_example:
  order_id: "A-2026-0042"
  customer: "Max Mustermann"
  object: "Opel Rekord C Stoßstange vorne"
  items:
    - "Stoßstangenmittelteil"
    - "Stoßstangenhorn links"
    - "Stoßstangenhorn rechts"
    - "2 Halter"
  target_surface: "Chrom hochglanz"
  condition: "rostig, alte Chromschicht matt, kleine Dellen"
  desired_due_date: "2026-07-15"
  quote_range_initial: "750–1.050 € brutto"
```

### 18.2 Vorgeschlagener Ablauf

| Schritt | Center | geschätzter Aufwand | Pflichtfoto |
|---|---|---:|---|
| Wareneingang, zählen, fotografieren | WE | 20 min | ja |
| Zustand prüfen, Rost/Dellen markieren | PR | 20 min | ja |
| Entmetallisierung | ENT | 30 min aktiv + Prozesszeit | optional |
| Dellen/Löten/Richten prüfen | REP | 0–2 h | ja bei Schaden |
| Grobschliff | SCH | 1–3 h | ja nach Schliff |
| Kupfer | GAL | 30 min aktiv + Prozesszeit | optional |
| Kupfer schleifen | SCH | 1–3 h | ja |
| Politur | POL | 1–2 h | ja |
| Nickel/Chrom | GAL | 30 min aktiv + Prozesszeit | ja nach Bad |
| QS | QS | 15 min | ja |
| Verpacken/Versand | VER | 20 min | Foto Paket optional |

### 18.3 Pflichtinformationen

- Fahrzeug / Objekt
- Teileanzahl
- Zustand
- Altbeschichtung
- sichtbare Schäden
- gewünschte Oberfläche
- gewünschter Termin
- Eilauftrag ja/nein
- realistische Frist
- Kundenzusage
- KV-Spanne
- endgültiger KV
- Fotos vor Bearbeitung
- Fotos nach Bearbeitung
- Versandart

---

## 19. Wareneingang-Flow auf Tablet

### 19.1 Persönliche Abgabe

1. Button: „Neuer Wareneingang“
2. Kunde suchen oder neu anlegen
3. Auftrag erstellen
4. Teile zählen
5. Teilegruppen oder Einzelteile erfassen
6. Fotos aufnehmen
7. gewünschte Oberfläche auswählen
8. Schadensgrad auswählen
9. Teiletyp auswählen
10. Lagerort scannen
11. QR-Label drucken
12. Empfangsbestätigung senden oder drucken
13. Auftrag erscheint auf KV-Board

### 19.2 Posteingang

1. Paket öffnen
2. Paketfoto machen
3. Lieferschein / Zettel fotografieren
4. Kunde suchen
5. falls unbekannt: Kunde aus Paketdaten anlegen
6. Teile erfassen
7. Vollständigkeit unklar markieren, falls keine Liste vorhanden
8. E-Mail „Wareneingang erhalten“ senden
9. Lagerort scannen
10. QR-Label drucken

### 19.3 Wareneingangsmaske

Pflichtfelder:

- Kunde
- Empfangsart: persönlich / Post / Spedition
- Eingangsdatum
- Teileanzahl
- Teilebeschreibung
- gewünschte Oberfläche
- Fotos
- Lagerort
- Bearbeitungswunsch
- grobe Preisindikation, falls vorhanden
- zugesagter oder gewünschter Termin
- interne Notiz

---

## 20. Fotodokumentation

### 20.1 Fototypen

| Typ | Pflicht? | Zweck |
|---|---|---|
| Paket außen | bei Versand ja | Transportschaden |
| Paket innen | bei Versand ja | Verpackungszustand |
| Gesamtübersicht Teile | ja | Vollständigkeit |
| Detailfoto Schaden | ja bei Schaden | Reklamationsschutz |
| Detailfoto Oberfläche | ja | Zustand |
| Zwischenstand | optional | Arbeitsschritte |
| Endfoto | ja | Qualität |
| Versandfoto | optional | Nachweis Verpackung |

### 20.2 Foto-Metadaten

```yaml
photo:
  photo_id: "F-000789"
  order_id: "A-2026-0042"
  item_id: "T-2026-0042-01"
  photo_type: "Wareneingang Detail Schaden"
  taken_by: "Mitarbeiter Büro"
  taken_at: "2026-05-18T10:42:00"
  station: "WE"
  notes: "Rostpickel links außen, kleine Delle Mitte."
```

---

## 21. KV-Modul

### 21.1 Ziel

Der Kostenvoranschlag muss seriös, schnell und nachvollziehbar sein, ohne den Betrieb mit Bürokratie zu ersticken.

### 21.2 KV-Arten

| Art | Verwendung |
|---|---|
| Grobeinschätzung | Telefon / Vorabfoto / ohne Ware |
| Vorläufiger KV | Ware da, aber noch nicht entmetallisiert |
| Verbindlicher KV | nach Prüfung / nach Entmetallisierung |
| Nachtrags-KV | zusätzlicher Schaden sichtbar |
| Eilaufschlag | bewusste Priorisierung |

### 21.3 KV-Positionen

| Position | Beispiel |
|---|---|
| Grundbearbeitung | Stoßstange entmetallisieren, schleifen, polieren |
| Reparatur | Delle richten / löten |
| Kupferaufbau | galvanischer Aufbau, Zwischenschliff |
| Endoberfläche | Nickel/Chrom hochglanz |
| Verpackung | Spezialverpackung |
| Versand | DHL / Spedition |
| Eilaufschlag | +25 % |

### 21.4 Beispiel-KV

```yaml
quote:
  quote_id: "KV-2026-0042"
  order_id: "A-2026-0042"
  customer_id: "K-000123"
  quote_type: "vorläufiger KV"
  valid_until: "2026-06-18"
  total_gross: 890.00
  notes_customer: "Der endgültige Aufwand kann nach Entmetallisierung abweichen, falls verdeckte Rostnarben oder Lötstellen sichtbar werden."
  lines:
    - description: "Stoßstange entmetallisieren und vorbereiten"
      quantity: 1
      price_gross: 160.00
    - description: "Schleifen und Polieren, Zustand mittel"
      quantity: 1
      price_gross: 320.00
    - description: "Kupferaufbau mit Zwischenschliff"
      quantity: 1
      price_gross: 210.00
    - description: "Nickel/Chrom hochglanz"
      quantity: 1
      price_gross: 160.00
    - description: "Verpackung und Versandpauschale"
      quantity: 1
      price_gross: 40.00
```

### 21.5 KV-Builder UI

Die App zeigt:

- Kunde
- Auftrag
- Fotos
- ähnliche historische Aufträge
- Preisvorschlag aus Historie
- manuelle Positionen
- Eilaufschlag
- Risikohinweis
- Freigabe per E-Mail
- Status: gesendet / angenommen / abgelehnt / geändert

---

## 22. Produktionsboard

### 22.1 Hauptansicht

Spalten:

1. Wareneingang
2. KV offen
3. Wartet auf Kunde
4. Entmetallisierung
5. Reparatur
6. Schleiferei
7. Galvanik
8. QS
9. Versand / Abholung
10. Blockiert

### 22.2 Karteninhalt

```text
A-2026-0042 | Mustermann
Stoßstange Opel Rekord C | 4 Teile
Status: Schleiferei
Lager: L-SCH-R2-F4
Fällig: 15.07.2026
Alter: 28 Tage
Risiko: GELB
Nächster Schritt: Kupfer schleifen
```

### 22.3 Karten-Aktionen

- öffnen
- Status ändern
- Foto hinzufügen
- Lagerort ändern
- Notiz
- Blocker setzen
- E-Mail an Kunde
- als Eilauftrag markieren
- Reklamation starten

---

## 23. Tagesansicht

### 23.1 Zweck

Jeder Mitarbeiter sieht morgens sofort, was zu tun ist.

### 23.2 Beispiel

```text
Heute wichtig – Schleiferei

1. A-2026-0017 | Mercedes Stoßstange | ROT | seit 18 Tagen in Schleiferei
2. A-2026-0028 | Motorradlenker | ORANGE | Termin in 6 Tagen
3. A-2026-0042 | Opel Stoßstange | GELB | Kupfer schleifen
4. A-2026-0050 | Möbelgriffe | GRÜN | Standardauftrag
```

### 23.3 Chef-/Büroansicht

- neue Wareneingänge
- KV offen
- Aufträge rot
- blockierte Aufträge
- wartende Kundenfreigaben
- versandbereite Aufträge
- neue Reklamationen
- heutige Rückrufe

---

## 24. Kommunikationslogik

### 24.1 Kommunikation wird protokolliert

Jede relevante Kommunikation wird am Auftrag und Kunden gespeichert:

| Typ | Beispiel |
|---|---|
| Telefonnotiz | Kunde fragt nach Dauer |
| E-Mail | KV gesendet |
| Statusmail | Auftrag in Bearbeitung |
| Zusage | Fertigstellung bis 15.07.2026 |
| Warnhinweis | Termin gefährdet |
| Reklamation | Kunde meldet Kratzer |
| Versand | Trackingnummer |

### 24.2 Statusmails

Im MVP automatisch vorbereiten, aber zunächst manuell freigeben.

Mailtypen:

1. Wareneingang bestätigt
2. KV gesendet
3. KV-Erinnerung
4. Freigabe erhalten
5. Auftrag in Bearbeitung
6. sichtbarer Zusatzschaden / Nachtrag
7. Auftrag fertig
8. Versand mit Tracking
9. Abholbereit
10. Reklamation erhalten

### 24.3 Beispiel: Wareneingang

Betreff:

```text
Ihre Teile sind bei uns eingetroffen – Auftrag A-2026-0042
```

Text:

```text
Sehr geehrter Herr Mustermann,

Ihre Teile sind bei uns eingetroffen und wurden unter der Auftragsnummer A-2026-0042 erfasst.

Erfasste Teile:
- Stoßstangenmittelteil Opel Rekord C
- Stoßstangenhorn links
- Stoßstangenhorn rechts
- 2 Halter

Im nächsten Schritt prüfen wir Zustand, Vollständigkeit und den voraussichtlichen Bearbeitungsaufwand. Anschließend erhalten Sie Ihren Kostenvoranschlag oder eine Rückfrage, falls etwas unklar ist.

Mit freundlichen Grüßen
Galvanik Kreile
```

---

## 25. Reklamationsmodul

### 25.1 Warum wichtig?

Bei emotionalen Einzelstücken und hochpreisiger Restaurierung muss nachvollziehbar sein:

- Wie kam das Teil an?
- Was wurde zugesagt?
- Welche Schäden waren vorher da?
- Welche Arbeitsschritte wurden gemacht?
- Wann wurde was kommuniziert?
- Wer hat die QS gemacht?
- Gab es frühere ähnliche Fälle?

### 25.2 Reklamationsfelder

```yaml
complaint:
  complaint_id: "R-2026-0003"
  order_id: "A-2026-0042"
  customer_id: "K-000123"
  complaint_date: "2026-08-02"
  complaint_type: "Oberfläche / Kratzer"
  customer_description: "Kunde meldet matte Stelle an Stoßstangenhorn rechts."
  internal_assessment: "Endfoto zeigt Stelle bereits leicht sichtbar, vermutlich Materialnarbe."
  status: "in Prüfung"
  decision: "Nacharbeit Kulanz"
  cost_internal: 45.00
  photos_linked:
    - "F-000789"
    - "F-000812"
```

### 25.3 UI bei Reklamation

Die App zeigt automatisch:

- Auftrag
- Kunde
- Endfotos
- Eingangsfotos
- KV
- Rechnung
- frühere Beschwerden
- ähnliche Teile
- verantwortliche Stationen
- Zeitachse

---

## 26. KI-Funktionen

KI soll helfen, aber keine handwerkliche Verantwortung übernehmen.

### 26.1 MVP-nah sinnvoll

| KI-Funktion | Zweck |
|---|---|
| Foto-Vorklassifikation | Teiletyp, sichtbare Schäden, Oberfläche vorschlagen |
| Text aus Paketbeilage erkennen | Kundendaten / Hinweise erfassen |
| ähnliche Aufträge finden | Preis- und Dauerreferenz |
| KV-Text formulieren | eleganter, professioneller Text |
| Statusmail formulieren | hochwertig, freundlich, sachlich |
| Anomalie erkennen | Auftrag liegt ungewöhnlich lange |
| Routing vorschlagen | Standardablauf anhand Teiletyp/Oberfläche |

### 26.2 Nicht automatisieren

- verbindliche Preisentscheidung
- verbindliche Terminzusage
- technische Machbarkeit ohne Meisterprüfung
- Reklamationsentscheidung
- rechtlich relevante Aussagen
- automatische Kundenantworten ohne Freigabe

### 26.3 KI-Ausgabe immer als Vorschlag markieren

```text
KI-Vorschlag:
Teiletyp: Oldtimer-Stoßstange
Material vermutlich: Stahl
Altoberfläche: Chrom
sichtbarer Schaden: Rostpickel, Delle links
empfohlener Workflow: Entmetallisieren → Reparatur prüfen → Schleifen → Kupfer → Zwischenschliff → Nickel/Chrom
Sicherheit: mittel
```

---

## 27. App-Screens

### 27.1 Pflichtscreens MVP

| Screen | Zweck |
|---|---|
| Login | Nutzer erkennen |
| Dashboard | Gesamtzustand |
| Neuer Wareneingang | Auftrag + Teile erfassen |
| Auftragsbuch | Liste aller Aufträge |
| Auftragsdetail | vollständige Auftragskarte |
| Teiledetail | Fotos, Status, Lagerort |
| Kundenkartei | Kundenprofil und Historie |
| Produktionsboard | Stationen und Prioritäten |
| Tagesplan | konkrete Aufgaben heute |
| Lagerorte | scanbare Lagerstruktur |
| KV-Builder | Angebote erstellen |
| Kommunikation | Mails, Telefonnotizen |
| Reklamation | Nacharbeit erfassen |
| Versand | Tracking / Abholung |
| Einstellungen | Stammdaten, Workflows, Hardware |

### 27.2 Dashboard-Kacheln

- Neue Wareneingänge ungeprüft
- KV offen
- Wartet auf Kundenfreigabe
- Rot überfällig
- Gelb kritisch
- Blockiert
- Versandbereit
- Reklamationen
- Schleiferei-Auslastung
- Galvanik-Auslastung

---

## 28. Auftragsdetail – Idealbild

```text
┌────────────────────────────────────────────────────────────┐
│ A-2026-0042 | Max Mustermann | Stoßstange Opel Rekord C     │
│ Status: In Schleiferei | Risiko: GELB | Fällig: 15.07.2026 │
│ Lager: L-SCH-R2-F4 | KV: 890 € angenommen                  │
└────────────────────────────────────────────────────────────┘

[ Fotos ] [ Teile ] [ Workflow ] [ KV ] [ Kommunikation ] [ Rechnung ] [ Versand ] [ Reklamation ]

Nächster Schritt:
→ Kupfer schleifen und Oberfläche prüfen

Teile:
- T-01 Stoßstangenmittelteil | Schleiferei | Foto vorhanden
- T-02 Horn links | Schleiferei | Foto vorhanden
- T-03 Horn rechts | Reparatur nötig | Foto vorhanden
- T-04 Halter Set | fertig entmetallisiert

Timeline:
18.05. Eingang
18.05. Fotos erstellt
19.05. KV erstellt
21.05. Kunde freigegeben
22.05. Entmetallisiert
29.05. Schleiferei begonnen
```

---

## 29. Datenbank-Schema – Entwurf

### 29.1 customers

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  customer_number TEXT UNIQUE NOT NULL,
  customer_type TEXT NOT NULL,
  salutation TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  zip TEXT,
  city TEXT,
  country TEXT DEFAULT 'Deutschland',
  language TEXT DEFAULT 'de',
  preferred_contact_channel TEXT DEFAULT 'email',
  notes_internal TEXT,
  risk_level TEXT DEFAULT 'normal',
  price_sensitivity TEXT DEFAULT 'normal',
  deadline_sensitivity TEXT DEFAULT 'normal',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 29.2 orders

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  title TEXT NOT NULL,
  intake_type TEXT,
  intake_date DATE NOT NULL,
  status TEXT NOT NULL,
  substatus TEXT,
  priority TEXT DEFAULT 'normal',
  desired_due_date DATE,
  promised_due_date DATE,
  risk_color TEXT DEFAULT 'green',
  current_location_id UUID,
  quote_status TEXT DEFAULT 'not_created',
  quote_total_gross NUMERIC(10,2),
  invoice_reference TEXT,
  shipping_method TEXT,
  tracking_number TEXT,
  internal_notes TEXT,
  customer_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 29.3 order_items

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  item_number TEXT UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id),
  name TEXT NOT NULL,
  item_type TEXT,
  object_context TEXT,
  material_guess TEXT,
  old_coating TEXT,
  target_surface TEXT,
  condition_level TEXT,
  damage_description TEXT,
  repair_needed BOOLEAN DEFAULT false,
  current_status TEXT,
  current_location_id UUID,
  estimated_labor_hours NUMERIC(6,2),
  actual_labor_hours NUMERIC(6,2),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 29.4 photos

```sql
CREATE TABLE item_photos (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  item_id UUID REFERENCES order_items(id),
  photo_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  taken_by UUID,
  station TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 29.5 locations

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY,
  location_code TEXT UNIQUE NOT NULL,
  area TEXT NOT NULL,
  rack TEXT,
  shelf TEXT,
  bin TEXT,
  description TEXT,
  active BOOLEAN DEFAULT true
);
```

### 29.6 status_events

```sql
CREATE TABLE status_events (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  item_id UUID REFERENCES order_items(id),
  old_status TEXT,
  new_status TEXT,
  old_location_id UUID,
  new_location_id UUID,
  user_id UUID,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 30. API-Endpunkte – MVP

```yaml
api:
  customers:
    - GET /api/customers
    - POST /api/customers
    - GET /api/customers/:id
    - PATCH /api/customers/:id
    - GET /api/customers/:id/history
  orders:
    - GET /api/orders
    - POST /api/orders
    - GET /api/orders/:id
    - PATCH /api/orders/:id
    - POST /api/orders/:id/status
    - POST /api/orders/:id/email
  items:
    - POST /api/orders/:orderId/items
    - PATCH /api/items/:id
    - POST /api/items/:id/photos
    - POST /api/items/:id/move
  locations:
    - GET /api/locations
    - POST /api/locations
    - GET /api/locations/:id/items
  quotes:
    - POST /api/orders/:id/quote
    - PATCH /api/quotes/:id
    - POST /api/quotes/:id/send
  shipments:
    - POST /api/orders/:id/shipment
    - PATCH /api/shipments/:id
  complaints:
    - POST /api/orders/:id/complaint
```

---

## 31. Technischer Architekturvorschlag

### 31.1 Empfohlener MVP-Stack

```yaml
frontend:
  framework: "Next.js"
  ui: "React + Tailwind + shadcn/ui"
  mobile: "Responsive Web-App / PWA"
  tablet_mode: true

backend:
  runtime: "Node.js"
  framework: "Next.js API routes oder NestJS"
  database: "PostgreSQL"
  orm: "Prisma"
  file_storage: "[PLATZHALTER: Supabase Storage / S3 / lokaler Server]"
  auth: "Auth.js / Clerk / Supabase Auth"

documents:
  pdf_generation: "React-PDF oder serverseitige PDF-Erzeugung"
  labels: "PDF/PNG Labeldruck"

email:
  provider: "[PLATZHALTER: Microsoft Graph / SMTP / Resend / Sendgrid]"
  templates: "HTML + Text"

ai:
  provider: "[PLATZHALTER]"
  use_cases:
    - "Fotoanalyse"
    - "Ähnliche Fälle"
    - "E-Mail-Entwürfe"
    - "KV-Textvorschläge"

integrations:
  lexware: "CSV/DATEV Export vorbereiten"
  datev: "DATEV-kompatible Exporte vorbereiten"
  outlook: "Statusmail-Versand / Kalender optional"
```

### 31.2 Warum PWA?

PWA = Progressive Web App (Website, die sich wie eine App bedienen lässt).

Vorteile:

- läuft auf Tablet, PC, Smartphone
- kein App-Store nötig
- einfacher MVP
- Kamera kann genutzt werden
- QR-Scan über Kamera möglich
- Updates sofort verfügbar

---

## 32. Sicherheits- und Datenschutzanforderungen

- Login erforderlich
- rollenbasierte Rechte
- Kundendaten nicht öffentlich
- Fotos geschützt speichern
- automatische Backups
- Audit-Log für Änderungen
- keine KI-Verarbeitung sensibler Daten ohne Einstellung
- Kundenportal später nur über sicheren Link oder Login
- E-Mail-Versand nur mit Freigabe, solange MVP

---

## 33. Beispiel-Prompts für Antigravity / Claude Code

### 33.1 Initialer Bauprompt

```text
Baue eine produktionsnahe Full-Stack-PWA namens "Galvanik Werkstatt-OS" für einen kleinen Galvanik-/Restaurationsbetrieb. Nutze Next.js, React, TypeScript, Tailwind, shadcn/ui, Prisma und PostgreSQL. Ziel ist eine tablet-optimierte interne Werkstatt-App mit Kundenkartei, digitalem Auftragsbuch, Wareneingang mit Fotodokumentation, QR-/Barcode-Logik, Lagerortverwaltung, Produktionsboard, farblicher Durchlaufzeit- und Risikoanzeige, KV-Builder, Statusmails, Versandstatus und Reklamationsmodul.

Implementiere zuerst das Datenmodell, Seed-Daten und klickbare MVP-Screens. Verwende große Buttons, klare Karten, Ampelfarben, Suchfunktion und wenige Pflichtfelder. Baue Platzhalter für Lexware, DATEV, Outlook, Labeldrucker, Tablet-Hardware und KI-Funktionen. Keine unnötige ERP-Komplexität.
```

### 33.2 UI-Prompt

```text
Gestalte die App wie ein seriöses Werkstatt-Cockpit: große Touch-Flächen, klare Karten, starke Suchfunktion, farbliche Priorisierung, wenig Dekoration. Die Hauptnavigation enthält Dashboard, Wareneingang, Auftragsbuch, Produktionsboard, Kunden, Lager, KV, Versand, Reklamationen und Einstellungen. Jede Auftragskarte zeigt Auftragsnummer, Kunde, Teile, Status, Lagerort, Fälligkeitsdatum, Alter, Risikofarbe und nächsten Schritt.
```

### 33.3 Datenmodell-Prompt

```text
Erzeuge Prisma-Modelle für customers, customer_assets, orders, order_items, item_photos, locations, workflow_templates, workflow_steps, quotes, quote_lines, shipments, communication_logs, complaints, price_references, employees, capacity_centers, status_events und system_settings. Achte auf sinnvolle Indizes für Suche nach Kundennummer, Name, Auftragsnummer, Teiletyp, Oberfläche, Status, Lagerort und Datum.
```

### 33.4 KI-Prompt

```text
Implementiere KI nur als Assistenz. Baue eine Funktion "AI Intake Assist", die aus Fotos und Notizen Vorschläge für Teiletyp, Schadensgrad, Altbeschichtung, Zieloberfläche, Workflow und KV-Risiko erzeugt. Die Ausgabe muss immer als Vorschlag markiert sein und vom Nutzer bestätigt werden. Keine automatische Preis- oder Terminzusage.
```

---

## 34. Abnahmekriterien MVP

Das MVP gilt als einsatzfähig, wenn folgende Tests bestanden sind:

### 34.1 Wareneingang

- neuer Kunde kann angelegt werden
- bestehender Kunde wird gefunden
- Auftrag kann in unter 2 Minuten angelegt werden
- mindestens 3 Fotos können aufgenommen und gespeichert werden
- QR-Label wird erzeugt
- Lagerort wird zugewiesen
- Statusmail kann vorbereitet werden

### 34.2 Auftragssteuerung

- Auftrag erscheint im Auftragsbuch
- Auftrag erscheint im Produktionsboard
- Status kann geändert werden
- Lagerort kann geändert werden
- Risikofarbe wird berechnet
- überfällige Aufträge werden rot angezeigt

### 34.3 Kundenkartei

- Kunde zeigt alle Aufträge
- ähnliche Teile können gesucht werden
- alte Preise sind sichtbar
- Reklamationen sind sichtbar
- Kommunikation ist sichtbar

### 34.4 KV

- KV kann aus Auftrag erstellt werden
- Positionen können hinzugefügt werden
- historische Preisreferenzen werden angezeigt
- KV-PDF oder HTML-Vorschau wird erzeugt
- Status „KV gesendet“ wird gespeichert

### 34.5 Versand

- Auftrag kann als versandbereit markiert werden
- Trackingnummer kann gespeichert werden
- Versandmail kann vorbereitet werden

---

## 35. Spätere Ausbaustufen

### Phase 2

- Kundenportal aktivieren
- Kunden können Status sehen
- Freigabe des KV online
- Upload neuer Fotos durch Kunden
- automatische Erinnerungen bei KV-Freigabe
- bessere Kapazitätsplanung

### Phase 3

- KI-Fallvergleich auf Basis historischer Aufträge
- Preisvorschläge aus tatsächlichem Aufwand
- automatische Durchlaufzeit-Prognose
- Lexware-/DATEV-Vertiefung
- Outlook-Integration
- mehrsprachige Kundenkommunikation
- Reklamationsstatistik
- Auswertung Deckungsbeitrag je Teiletyp

---

## 36. Wichtigste Designentscheidung

Die App muss jeden Morgen die Frage beantworten:

> Was liegt wo, seit wann, warum, und was muss heute zuerst passieren?

Wenn diese Frage auf einen Blick beantwortet wird, reduziert sich die Zettelwirtschaft, der Kundenfrust und der Druck auf Chef und Büro massiv.
