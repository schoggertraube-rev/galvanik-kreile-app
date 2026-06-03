# 17 — Datenschutz, GoBD & Compliance: Modul Buchhaltung

**Version:** 1.0 · **Datum:** 2026-06-02
**Grundsatz (gem. 00_PRIORITY_RULES_KREILE):** Datenschutz als pragmatische Risikosteuerung, nicht als Produktverhinderung. Risiken benennen, einfache Schutzmaßnahmen umsetzen, MVP-fähig bleiben.

---

## 1. Verarbeitete Daten & Rechtsgrundlage

| Datenart | Beispiel | Rechtsgrundlage |
|---|---|---|
| Belegdaten | Lieferant, Betrag, USt | Art. 6 Abs. 1 lit. c (gesetzl. Aufbewahrung) |
| Bewirtungsbeleg | Teilnehmer (personenbezogen) | Art. 6 Abs. 1 lit. c/f |
| Kundendaten Ausgangsrechnung | Name, Adresse | Art. 6 Abs. 1 lit. b |
| Bankumsätze (Stufe 2) | Kontobewegungen | Art. 6 Abs. 1 lit. b + Einwilligung PSD2 |

## 2. Auftragsverarbeiter (AVV erforderlich vor Go-Live)

- **OCR-Anbieter** (Klippa/Eagle Doc) — EU-Region, „no retention" aktivieren.
- **Supabase** (DB/Storage/Auth) — EU-Region.
- **PSD2-Aggregator** (Stufe 2).
- Verarbeitungsverzeichnis (Art. 30) je Verarbeiter ergänzen.

## 3. GoBD-Pflichten (technisch)

- Unveränderbarkeit: append-only + Storno (Datei 15, §3).
- Verfahrensdokumentation: generierbares Dokument, das Belegerfassung → Buchung → Archivierung → Export beschreibt; nach jeder Prozessänderung aktualisieren.
- Revisionssichere Archivierung im Originalformat (E-Rechnung als XML!).
- Datenzugriff Betriebsprüfung: Z1 (Lesezugriff), Z2 (Auswertungen), Z3 (Datenexport CSV + Beschreibung) bereitstellen.
- Aufbewahrung: 8 J. Buchungsbelege/Rechnungen (seit 1.1.2025), 10 J. Abschlüsse, 6 J. Geschäftsbriefe. Frist-Engine konfigurierbar je Belegtyp.

## 4. Rollen & Zugriff (RLS)

- `EMPLOYEE`: nur eigener Upload-Korb, keine Beträge/Auswertung.
- `ACCOUNTING`: Belege/Status/Export, keine Voreinstellungen/Zertifikate.
- `OWNER`: alles.
- `READ_ONLY_AUDIT`: lesend nach Freigabe.
- Row Level Security serverseitig erzwungen; Feature-Flag-Check nie nur clientseitig.

## 5. Sicherheit

- OCR-/Bank-/ELSTER-Keys und Zertifikate serverseitig (Secrets), nie im Client-Bundle.
- ELSTER-.pfx verschlüsselt at-rest, PIN nie persistent loggen.
- Belegfotos im geschützten Storage-Bucket, signierte URLs mit Ablauf.
- Audit-Log append-only, keine Admin-Löschung.

## 6. Kunden-/Mandantenübergabe (Platzhalter-Politik)

Echte Anbindungen werden fest verdrahtet. **Platzhalter nur** dort, wo kundenspezifische Daten eingepflegt werden:
- Bankzugang (Stufe 2)
- ELSTER-Zertifikat + Hersteller-ID
- Lieferanten-Stammdaten + Konten-Mapping
- USt-Profil, Schwellenwerte, Berater-/Mandanten-Nr (DATEV)
Diese liegen im Onboarding-Bereich `/buchhaltung/einstellungen`, der nach Erstbefüllung in den Hintergrund tritt (Zahnrad).

## 7. Akzeptanzkriterien

- [ ] EU-Region für DB/Storage/OCR aktiv; AVV-Liste dokumentiert.
- [ ] Z3-Export (GoBD) erzeugt CSV + Datenbeschreibung.
- [ ] RLS-Tests grün (EMPLOYEE sieht keine Beträge).
- [ ] Verfahrensdokumentation generierbar.
- [ ] Keine Keys/Zertifikate im Client; Secrets serverseitig.
- [ ] Aufbewahrungsfristen je Belegtyp konfigurierbar (6/8/10 J.).
