# Galvanik-Kreile WerkstattCockpit — Phase-0- und V1-Funde

## Belastbare Funde

1. Zwei aktive Capture-Wege existieren.
2. Der kanonische Vertrag ist nicht abschließend akzeptiert.
3. Mindestens ein Pfad hält das Original nur temporär im RAM.
4. Vor-Auftrags-Ereignisse sind nicht belastbar geklärt.
5. Der operative Pfad nutzt aktuell TypeScript-/Drizzle-Anreicherung; eine akzeptierte Slice-SQL-View fehlt.
6. Ein statischer Pfad bis zu Produktionsansichten existiert.
7. Ein echter Foto-zu-DB-zu-Zielkarte-Laufzeitnachweis fehlt.
8. Korrektur/Undo und Revisionspfad sind nicht vollständig.
9. Rollenautorisierung, Tenant, Remote-RLS und Storage sind nicht vollständig verifiziert.
10. Mehrere Capture-/Konvertierungswege bergen Duplikat- und Wartungsrisiko.

## V1-Vertrag: anerkannte Grundlage

- `scan_uploads` ist ein plausibler Kandidat als Objekt vor Auftragserstellung.
- Original, Hash, Idempotenz, Review, Offline, Korrektur und SQL-Verträge wurden als Pflichtbereiche erkannt.
- Ein fachliches Ereignismodell soll keine doppelte Auditwahrheit erzeugen.
- Relevante Konsumenten wurden umfangreich inventarisiert.

## V1-Vertrag: zwingend zu korrigieren

1. Erste Produktionsstation nicht auf Galvanik hardcoden.
2. Keine automatische Löschung unsynchronisierter Originale nach 48 Stunden.
3. Kein Last-Writer-Wins für den gesamten Record.
4. Atomare Transaktion ohne verschachtelte unabhängige Transaktionen.
5. Vor-Auftrags-Ereignisse gegen reales Schema/Repository prüfen.
6. Alle SQL-Typen, Spalten und Constraints belegen.
7. `SET LOCAL` nur innerhalb garantierter gleicher DB-Transaktion.
8. Keine Vertagung sicherheitsrelevanter Tenant-/Storage-Lücken für den neuen Kernpfad.
9. Storage-Download mit serverseitiger Rollen- und Tenantprüfung.
10. Aufbewahrungs- und Löschvertrag statt „nie löschen“.
11. Globale `getOperationalOrders()`-Ablösung nicht ohne Konsumentenbeweis.
12. Keine neue vereinfachte Dringlichkeitswahrheit.
13. Acht-Fragen-Karte mit echter Handlung und Evidenzherkunft.
14. Konfidenzschwelle als Hypothese und Pilotkalibrierung.
15. Zukunftswirkungen nicht als `K` oder „behoben“ markieren.
16. Akzeptanzkriterien um Build, Remote-Migration, RLS, Storage, Hash, Offline-Neustart und Performance ergänzen.
17. Umsetzung in mehrere sequenzielle Missionen teilen.
