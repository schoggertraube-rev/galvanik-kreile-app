# Projektanalyse: Galvanik Werkstatt-OS (Phase 1)

## 1. Projektverständnis
Die App "Galvanik Werkstatt-OS" dient als leicht bedienbares Betriebsnervensystem für einen kleinen Galvanik-/Restaurationsbetrieb. Das Hauptziel ist die Beseitigung der organisatorischen Unschärfe und die Schaffung von Transparenz über Aufträge, Teile, Lagerorte und Bearbeitungsschritte.

**Fokus für Phase 1 (MVP - Kernsystem):**
- Keine externen Integrationen (Lexware, DATEV, Outlook, Hardware-Drucker bleiben Platzhalter oder werden weggelassen).
- Fokus auf die interne Werkstatt-Steuerung.
- Kern-Features: Kundenkartei, Auftragserfassung, Teileerfassung (mit Fotologik), Lagerortverwaltung, Statussystem mit Ampellogik, Produktionsboard, manuelles KV-Modul.

## 2. Datenmodell (Kernentitäten)
Das Datenmodell fokussiert sich auf die wesentlichen Objekte ohne Überladung:

- **Customer:** Kundendaten (Privat/Gewerblich), Kontaktdaten, Präferenzen.
- **Order (Auftrag):** Hauptauftrag mit Status, Priorität, Risikofarbe, Fälligkeitsdatum und KV-Daten.
- **OrderItem (Teil):** Einzelnes Teil (z.B. Stoßstange), Material, Altbeschichtung, Zieloberfläche, Zustand, Lagerort (Location).
- **ItemPhoto (Foto):** Bilddokumentation (Eingang, Schaden, Zwischenstand, Ende).
- **Location (Lagerort):** Systematische Lagerplätze (z.B. L-SCH-R2-F4).
- **StatusEvent (Historie):** Protokollierung von Status- oder Lagerortänderungen.
- **Quote / QuoteLine (Kostenvoranschlag):** Manuelle Angebotspositionen.
- **CommunicationLog / Complaint:** Protokoll der Kommunikation und Reklamationen.

## 3. Rollen & Rechte
- **Admin / Chef:** Vollzugriff (Benutzerverwaltung, Preise, alle Berichte).
- **Büro:** Kunden, Aufträge, KV, Mails, Versand.
- **Wareneingang:** Kunden suchen/anlegen, Teile fotografieren, Lagerort zuweisen.
- **Schleiferei / Galvanik:** Warteschlange einsehen, Prozessstatus ändern, Fotos ergänzen.
- **Versand:** Fertig melden, Versand vorbereiten.
- **Lesemodus:** Nur Ansicht.

## 4. Kern-Workflows
1. **Wareneingang:**
   - Kunde identifizieren / anlegen.
   - Auftrag erstellen.
   - Teile zählen, Zustand prüfen und fotografieren (Pflicht für Schaden/Zustand).
   - Zieloberfläche und Lagerort (per QR/Scan) festlegen.
2. **Produktionsdurchlauf (Ampellogik):**
   - Aufträge durchlaufen Stationen (WE -> Prüfung -> Entmetallisierung -> Reparatur -> Schleiferei -> Galvanik -> QS -> Versand).
   - Farbcodierung (Grün/Gelb/Orange/Rot) steuert die Priorität anhand der Liegezeit und des Fälligkeitsdatums.
3. **KV-Erstellung (Manuell):**
   - Büro nutzt Fotos und historische Preisreferenzen, um schnell Positionen zusammenzustellen.
   - Versand (simuliert/manuell) an Kunde zur Freigabe.
4. **Tagesansicht / Dashboard:**
   - Mitarbeiter sehen fokussiert die anstehenden Aufträge für ihre Station, sortiert nach Priorität (Rot/Gelb zuerst).

## Fazit Phase 1
Mit diesem Fundament ist die digitale Auftragskartei und Produktionssteuerung sichergestellt. Auf externe Systeme (z.B. Lexware/DATEV-Exporte) und Kundenportale wird bewusst verzichtet, um die schnelle Einführung in der Werkstatt zu garantieren.
