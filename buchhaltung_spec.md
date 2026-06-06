<USER_REQUEST>
du hast jetzt folgende aufgabe: du wirst das markdown vollstÃ¤ndig lesen, jeden einzelnnen schritt analysieren und step by step umsetzen. sollten fehler oder misstÃ¤nde auftreten, stopst du direkt und informierst mich bzw gibst eine auswahl von lÃ¶sungsvorschlÃ¤gen. du arbeitest step by step. am ende gibst du einen bericht aus, welcher deine komplette arbeit dokumentiert. fehlstellen aufdeckt und umfÃ¤nglich dokumentiert             â€žLies Datei 30 Â§1 komplett. Baue das Ausgangsrechnungs-Formular, die Filter, die Detail-Route und die Offene-Posten-Sicht exakt nach diesen Feldern, Validierungen und Queries. Keine eigenen Feld- oder Formatentscheidungen. Persistenz-Smoke-Test: Rechnung anlegen â†’ Reload â†’ Liste â†’ Detail â†’ Filter (Status=offen, Kunde=X) â†’ in Offene-Posten-Sicht sichtbar. Dann lead_id-Feld auf Ausgangsrechnung sicherstellen (Spec 28). Commit F-BHS-03."             # 30 â€” Buchhaltung: Formulare, Filter, Berechnungen & Export-Formate

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 Â· **Datum:** 2026-06-02 Â· **Status:** ausfÃ¼hrungsfertig
**Zweck:** Eliminiert Ratearbeit in F-BHS-03 bis F-BHS-06. Jedes Formular, jeder Filter, jede Berechnungszeile und jedes Export-Format ist verbindlich definiert. Antigravity trifft damit keine eigenen UI-/Formatentscheidungen mehr.
**Bindet ein:** Spec 15 (Datenmodell), 29 (Sanierung), Live-Data-Policy

---

## 1. Ausgangsrechnung â€” Formular, Filter, Detail, Mahnstufen (F-BHS-03)

### 1.1 Anlageformular `/buchhaltung/rechnungen/neu`

| Feld | Typ | Pflicht | Validierung | Default |
|---|---|---|---|---|
| Rechnungsnummer | text | ja | einmalig, Format `RE-YYYY-NNN` (auto-generiert, Ã¼berschreibbar) | nÃ¤chste freie |
| Kunde | Select/Autocomplete | ja | muss in Kundenstamm existieren | â€” |
| Rechnungsdatum | date | ja | â‰¤ heute | heute |
| FÃ¤lligkeitsdatum | date | ja | â‰¥ Rechnungsdatum | +14 Tage (aus Steuerprofil/Einstellungen) |
| USt-Satz | select (19 / 7 / 0) | ja | â€” | 19 % |
| Positionen (repeate
<truncated 11777 bytes>
).
- [ ] UStVA-Zahllast = USt aus Rechnungen âˆ’ Vorsteuer aus Belegen (auf den Cent).
- [ ] Ausgaben-Kategorien summieren sich zum Gesamtwert.
- [ ] Keine Konstante, keine Mock-Zahl â€” alles berechnet, auch bei leerer DB (dann 0 â‚¬).

### Exporte
- [ ] DATEV-EXTF: Kopfzeile mit Berater/Mandanten-Nr aus Steuerprofil, Spaltenreihenfolge exakt Â§6.2, Festschreibung=1, valides CSV.
- [ ] Lexware-CSV: Spalten exakt Â§7, UTF-8, Semikolon.
- [ ] Z3-Export: `index.xml` + CSVs + Originale, maschinenlesbar.
- [ ] ZIP: enthÃ¤lt EXTF + Lexware + BWA-PDF + UStVA-PDF + Belege + Index.
- [ ] Jeder Export: real erzeugter Download, nicht Fake-Button.

---

## 11. Annahmen

- Kundenstamm existiert im bestehenden Kunden-/Auftragsmodul; Ausgangsrechnung referenziert per `kunde_id`.
- Rechnungsnummer-Format `RE-YYYY-NNN` ist Startwert; umstellbar in Einstellungen.
- SKR-Konten als String (z. B. â€ž4530"), nicht als FK auf eine Kontentabelle â€” Kontentabelle ist Stufe 2.
- PDF-Erzeugung fÃ¼r BWA/UStVA Ã¼ber bestehende PDF-Logik der App (falls vorhanden) oder als HTMLâ†’PDF (serverseitig).
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