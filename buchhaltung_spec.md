<USER_REQUEST>
du hast jetzt folgende aufgabe: du wirst das markdown vollständig lesen, jeden einzelnnen schritt analysieren und step by step umsetzen. sollten fehler oder misstände auftreten, stopst du direkt und informierst mich bzw gibst eine auswahl von lösungsvorschlägen. du arbeitest step by step. am ende gibst du einen bericht aus, welcher deine komplette arbeit dokumentiert. fehlstellen aufdeckt und umfänglich dokumentiert             „Lies Datei 30 §1 komplett. Baue das Ausgangsrechnungs-Formular, die Filter, die Detail-Route und die Offene-Posten-Sicht exakt nach diesen Feldern, Validierungen und Queries. Keine eigenen Feld- oder Formatentscheidungen. Persistenz-Smoke-Test: Rechnung anlegen → Reload → Liste → Detail → Filter (Status=offen, Kunde=X) → in Offene-Posten-Sicht sichtbar. Dann lead_id-Feld auf Ausgangsrechnung sicherstellen (Spec 28). Commit F-BHS-03."             # 30 — Buchhaltung: Formulare, Filter, Berechnungen & Export-Formate

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** ausführungsfertig
**Zweck:** Eliminiert Ratearbeit in F-BHS-03 bis F-BHS-06. Jedes Formular, jeder Filter, jede Berechnungszeile und jedes Export-Format ist verbindlich definiert. Antigravity trifft damit keine eigenen UI-/Formatentscheidungen mehr.
**Bindet ein:** Spec 15 (Datenmodell), 29 (Sanierung), Live-Data-Policy

---

## 1. Ausgangsrechnung — Formular, Filter, Detail, Mahnstufen (F-BHS-03)

### 1.1 Anlageformular `/buchhaltung/rechnungen/neu`

| Feld | Typ | Pflicht | Validierung | Default |
|---|---|---|---|---|
| Rechnungsnummer | text | ja | einmalig, Format `RE-YYYY-NNN` (auto-generiert, überschreibbar) | nächste freie |
| Kunde | Select/Autocomplete | ja | muss in Kundenstamm existieren | — |
| Rechnungsdatum | date | ja | ≤ heute | heute |
| Fälligkeitsdatum | date | ja | ≥ Rechnungsdatum | +14 Tage (aus Steuerprofil/Einstellungen) |
| USt-Satz | select (19 / 7 / 0) | ja | — | 19 % |
| Positionen (repeated) | Table / FormList | ja | ≥ 1 Position | — |
| beleg_id | text | nein | opt. Verknüpfung zu Eingangsbeleg | — |

Positionen-Spalten:
- Bezeichnung (text, ja)
- Menge (numeric, ja, > 0)
- Einheit (select: Std / Stk / Pauschal, ja)
- Netto-Einzelpreis (numeric, ja)
- Netto-Gesamtpreis (numeric, ja, schreibgeschützt: Menge * Einzelpreis)
- USt-Satz (berechnet aus Rechnungs-USt-Satz, schreibgeschützt)

### 1.2 Berechnungsregeln (Client & Server)
- Netto-Summe = ∑ Positionen.Netto-Gesamtpreis.
- USt-Betrag = Netto-Summe * (USt-Satz / 100) (auf 2 Nachkommastellen kaufmännisch gerundet).
- Brutto-Summe = Netto-Summe + USt-Betrag.
- Diese Berechnung muss synchron im UI (Formular) und im Server-Action-Validator stattfinden. Bei Abweichungen > 0.01 € lehnt der Server die Transaktion ab (Datenintegrität).

### 1.3 Listenansicht & Filter `/buchhaltung/rechnungen`
- Spalten: Rechnungsnummer, Datum, Kunde, Netto, Brutto, Status (Entwurf / offen / bezahlt / überfällig), Mahnstufe.
- Filter:
  - Kunde (Select)
  - Status (Multi-Select)
  - Datumsbereich (von/bis)
- Sortierung: Standardmäßig nach Rechnungsdatum absteigend, sekundär nach Rechnungsnummer absteigend.

---

## 2. Offene-Posten-Sicht `/buchhaltung/offene-posten` (F-BHS-04)
- Exklusiver Filter auf Rechnungen mit Status `offen` oder `überfällig`.
- Aggregierte Kennzahlen über der Tabelle:
  - Gesamt Offen (Brutto)
  - Davon überfällig (Brutto)
  - Anzahl offener Posten
- Mahnstufen-Steuerung direkt aus der Zeile:
  - Button "Mahnstufe erhöhen" (Entwurf → Zahlungserinnerung → 1. Mahnung → 2. Mahnung → Inkasso).
  - Erhöhung schreibt einen Eintrag in `public.status_events` (actor: current_user, event: "invoice_dunned", metadata: `{ invoice_id, old_level, new_level }`).

---

## 3. Betriebswirtschaftliche Auswertung (BWA) & UStVA-Vorschau `/buchhaltung/bwa` (F-BHS-05)

### BWA-Berechnung (laufender Monat & YTD)
- Umsatzerlöse = Summe aller bezahlten & offenen Rechnungen (Soll-Versteuerung).
- Materialaufwand = Summe aller erfassten Eingangsbelege der Kategorie "Materialeinkauf".
- Personalaufwand = Summe aller erfassten Eingangsbelege der Kategorie "Personal".
- Raumkosten = Summe aller erfassten Eingangsbelege der Kategorie "Raummiete".
- Sonstige Kosten = Summe aller sonstigen erfassten Eingangsbelege.
- Rohertrag = Umsatzerlöse − Materialaufwand.
- Betriebsergebnis (EBIT) = Rohertrag − Personalaufwand − Raumkosten − Sonstige Kosten.

### UStVA-Vorschau
- Umsatzsteuer (19%) = Summe USt aller Rechnungen (19%) im Zeitraum.
- Umsatzsteuer (7%) = Summe USt aller Rechnungen (7%) im Zeitraum.
- Vorsteuer = Summe aller USt-Beträge aus Eingangsbelegen (unabhängig von Kategorie).
- USt-Zahllast = Umsatzsteuer (19% + 7%) − Vorsteuer.

### UI-Vorgabe (Verbindlich)
- Keine Dritte-Bibliothek-Charts für BWA.
- Reine Tabellenstruktur, eingerückt nach BWA-Standard (Umsatz, Kostenarten, Ergebnisse fett).
- Farbcodierung: EBIT positiv (grün), negativ (rot).
- PDF-Export-Button erzeugt serverseitig ein formatiertes PDF-Dokument (GoBD-konform).

---

## 4. DATEV- & Lexware-Schnittstellen (F-BHS-06)

### 4.1 DATEV-Export (Format: EXTF-Umsatzdaten)
- CSV-Format, Encoding: Windows-1252 (DATEV-Standard) oder UTF-8 mit explizitem Hinweis.
- Dateiname: `EXTF_Umsatz_YYYYMM.csv`.
- Header-Zeile 1 (DATEV-Kennung): `EXTF;1.0;11;[Beraternummer];[Mandantennummer];[Wirtschaftsjahr];...`
- Spalten-Mapping:
  - Umsatz (Bruttobetrag, Format: `#.##0,00`)
  - Soll/Haben-Kennzeichen (`S` oder `H`)
  - Gegenkonto (Debitorenkonto Kunde, Bereich 10000-69999)
  - Konto (Erlöskonto, z. B. 8400 bei 19% USt, 8300 bei 7%)
  - Belegdatum (DDMMYYYY)
  - Belegfeld 1 (Rechnungsnummer)
  - Buchungstext (Kundenname + Rechnungsnummer)

### 4.2 Lexware-Buchungsdaten-Export
- Spaltenstruktur: Belegdatum;Belegnummer;Buchungstext;Sollkonto;Habenkonto;Betrag;USt-Schlüssel.
- Export-Download muss per ZIP-Archiv erfolgen, das die CSV-Datei sowie alle digitalisierten Belege (PDF/PNG) des Export-Zeitraums enthält.

---

## 5. RLS & Sicherheits-Kontrakte (Ergänzung zu Spec 29)
- Jede Tabelle (`invoices`, `invoice_items`, `export_logs`) muss RLS aktiviert haben.
- Policies:
  - `SELECT`: Nur Benutzer der eigenen `tenant_id` (galvanik-kreile).
  - `INSERT/UPDATE/DELETE`: Nur Benutzer mit Rolle `admin` oder `buchhaltung`.
- Die automatische Ermittlung der `tenant_id` muss serverseitig über das JWT-Sicherheits-Token laufen, niemals per Client-Payload (Schutz vor Spoofing).

---

## 6. Validierung & Abnahmetests (Pre-Commit-Bedingungen)
- [ ] Alle Währungsfelder in der DB sind als `numeric(10,2)` definiert, nicht als `float` oder `real`.
- [ ] Jede Rechnungssumme wird vor dem Speichern via Testsuite gegen die Summe der Einzelpositionen validiert (Toleranz: 0.00 €).
- [ ] UStVA-Zahllast = USt aus Rechnungen − Vorsteuer aus Belegen (auf den Cent).
- [ ] Ausgaben-Kategorien summieren sich zum Gesamtwert.
- [ ] Keine Konstante, keine Mock-Zahl — alles berechnet, auch bei leerer DB (dann 0 €).

### Exporte
- [ ] DATEV-EXTF: Kopfzeile mit Berater/Mandanten-Nr aus Steuerprofil, Spaltenreihenfolge exakt §6.2, Festschreibung=1, valides CSV.
- [ ] Lexware-CSV: Spalten exakt §7, UTF-8, Semikolon.
- [ ] Z3-Export: `index.xml` + CSVs + Originale, maschinenlesbar.
- [ ] ZIP: enthält EXTF + Lexware + BWA-PDF + UStVA-PDF + Belege + Index.
- [ ] Jeder Export: real erzeugter Download, nicht Fake-Button.

---

## 11. Annahmen

- Kundenstamm existiert im bestehenden Kunden-/Auftragsmodul; Ausgangsrechnung referenziert per `kunde_id`.
- Rechnungsnummer-Format `RE-YYYY-NNN` ist Startwert; umstellbar in Einstellungen.
- SKR-Konten als String (z. B. „4530"), nicht als FK auf eine Kontentabelle — Kontentabelle ist Stufe 2.
- PDF-Erzeugung für BWA/UStVA über bestehende PDF-Logik der App (falls vorhanden) oder als HTML→PDF (serverseitig).
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-06-05T18:39:13+02:00.

The user's current state is as follows:
Other open documents:
- c:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\src\lib\services\photoService.ts (LANGUAGE_TYPESCRIPT)
- c:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\src\lib\repositories\ordersRepository.ts (LANGUAGE_TYPESCRIPT)
- c:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\src\app\today\page.tsx (LANGUAGE_TSX)
- c:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\src\app\orders\[id]\page.tsx (LANGUAGE_TSX)
- c:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\src\lib\repositories\timelineRepository.ts (LANGUAGE_TYPESCRIPT)
Browser State:
  Page 02C8F82D8914700A288947E118C3EA54 (KREILE WerkstattCockpit) - http://localhost:3000/kommunikation [ACTIVE]
    Viewport: 1038x714, Page Height: 713
</ADDITIONAL_METADATA>