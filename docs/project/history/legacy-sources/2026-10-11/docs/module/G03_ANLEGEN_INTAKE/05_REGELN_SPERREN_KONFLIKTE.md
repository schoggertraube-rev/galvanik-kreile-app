<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Sperren und Konflikte

## Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| explizite Profil-/Fähigkeitssperre | unberechtigten Aufruf | UI + Server | OE-2609-09; bestehende Command-Autorisierung | SPEZ |
| gültige Session, Actor und Tenant | anonyme oder fremdtenantige Mutation | Server + DB | F1.1 Integrationstests | GEBAUT |
| exakte Payload-Schlüssel und Feldgrenzen | zusätzliche/manipulierte Eingaben | Server | `orderIntakeCommand.ts` Unit-Test | GEBAUT |
| 1–20 Positionen und positive Menge | leere oder übergroße Aufträge | UI + Server | F1.1 Command | GEBAUT |
| kanonische Bestandskunden-ID im Tenant | Zuordnung zu fremdem/fehlendem Kunden | Server + DB | F1.1 Command/Readback | GEBAUT |
| Kundendublettenwarnung ohne Auto-Merge | unbeabsichtigte Doppelanlage oder Datenverschmelzung | UI + Server-Port | Red-Team RT-10; Q-G03-003 | SPEZ |
| Idempotenz-ID plus Intent-Hash | Doppelwrite und Wiederverwendung mit verändertem Inhalt | Server + DB | F1.1 Receipt-Vertrag | GEBAUT |
| globale Advisory Lock + UNIQUE-Nummer | doppelte `A-JJJJ-NNNN` | DB | `orderIntakeCommand.ts`; Abnahme G03-T13 | GEBAUT |
| KV-Version und einmalige Conversion | stale Überschreibung oder zweiter Auftrag | Server + DB | Quote-Integrationstest | GEBAUT |
| Zahlungs-/Eingangsregel | unzulässige Kombination aus Versand, Abholung und Rechnung | UI + Server + DB | OE-2609-07/11 | SPEZ |
| getrennte Wunsch-/Zusagefelder | Verlust des Kundenwunsches oder falsche Termintreue | Server + DB | OE-2609-19; Baseline-Schema | SPEZ |
| Erfolg nur nach Receipt + Fresh-Readback | falschen grünen Erfolg | UI + Server | D-RES-001; bestehende Negativmatrix | GEBAUT |
| Originalfoto MIME/Größe/Hash/Pfad/Finalisierung | fremde oder unbestätigte Datei als Beleg | UI + Server + Storage | `OrderIntakePanel.tsx` | GEBAUT |
| Adresse vor Versand/Rechnung | Versand/Rechnung ohne zustell-/rechnungsfähige Anschrift | UI + Server | D-UI-V5-003 | SPEZ |
| Offline-Entwurf plus stabiler Request | Eingabeverlust oder Doppelanlage bei Netzabbruch | UI + Server | OP-23; Q-G03-004 | GEPLANT |
| deaktivierte M04/M06-Adapter | tote Route oder ungeprüften Providerwrite | UI + Server | OE-2609-04; OP-09/11 | SPEZ |

## Konflikte

Alle Konflikte bleiben am Datensatz sichtbar und werden zusätzlich im Startseiten-Bereich `Der Tag` → `Handlungsbedarf` der zuständigen Person gespiegelt. Eine automatische fachliche Auflösung ist unzulässig.

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| G03-K01 | plausible Kundendublette | Kunden-Suchport liefert ähnliche Treffer | Rolf | `Der Tag` → `Handlungsbedarf` und inline | Bestandskunde übernehmen oder bewusst `Trotzdem neu anlegen`; nie auto-merge | SPEZ |
| G03-K02 | gleicher Request mit anderem Intent | Intent-Hash weicht bei gleicher `clientEventId` ab | auslösende Person Rolf/Phillip; technisch Gregor | inline; bei Wiederholung `Handlungsbedarf` | aktuellen Beleg lesen, Entwurf vergleichen, neue Anfrage-ID erst nach bewusster Inhaltsänderung | GEBAUT |
| G03-K03 | KV wurde parallel geändert | `expectedVersion` ist stale | auslösende Person Rolf/Phillip | `Der Tag` → `Handlungsbedarf` und KV | aktuellen KV neu laden, Unterschiede anzeigen, bewusst erneut ändern | GEBAUT |
| G03-K04 | KV wurde parallel vergeben | vorhandene Conversion-/Auftrags-ID | Rolf | `Der Tag` → `Handlungsbedarf` und KV | bestehenden Auftrag öffnen; keinen zweiten anlegen | GEBAUT |
| G03-K05 | Nummernkonkurrenz | Advisory Lock/UNIQUE oder Paralleltest | Gregor | technische Diagnose; Nutzer inline | gleichen Request read-only prüfen/replayen; niemals Nummer lokal raten | GEBAUT, Testgate offen |
| G03-K06 | Terminwunsch und Zusage kollidieren oder Termin wird später verschoben | Terminport meldet Regel-/Versionskonflikt | Rolf | `Der Tag` → `Handlungsbedarf` und Auftrag | Wunsch sichtbar lassen, neue Zusage bewusst bestätigen; M04 folgt erst danach | SPEZ |
| G03-K07 | Eingangsfoto fehlt | keine finalisierte Evidenz je Position | Phillip | Werkstatt/`Handlungsbedarf` und Auftrag | nicht blockierender Hinweis; Foto später ergänzen oder bewusst ohne fortfahren | SPEZ |
| G03-K08 | Foto-Finalisierung unklar | Reserve/Upload/Finalize/Readback stimmen nicht exakt überein | Phillip; technisch Gregor | inline; bei Persistenz `Handlungsbedarf` | Evidenz read-only prüfen, gleichen reservierten Vorgang abschließen; nicht doppelt hochladen | GEBAUT |
| G03-K09 | Anschrift fehlt bei Versand/Rechnung | Adressfelder unvollständig | Rolf | `Der Tag` → `Handlungsbedarf` und Kundenkarte | Kundendaten ergänzen; bis dahin Versand/Rechnung sperren | SPEZ |
| G03-K10 | Verbindung bricht vor bestätigtem Readback ab | Netzwerkfehler und kein eindeutiges Receipt | auslösende Person Rolf/Phillip | inline und nach Wiederkehr `Handlungsbedarf` | Entwurf behalten, Ausgang read-only prüfen, identischen Request sicher wiederholen | GEPLANT |
| G03-K11 | App-Termin gespeichert, Outlook-Projektion fehlt | M04-Projektionsstatus fehlt/fehlerhaft | Rolf; technisch Gregor | `Der Tag` → `Handlungsbedarf` | App-Termin bleibt gültig; Projektion nach M04-Regel erneut anstoßen | GEPLANT |
| G03-K12 | Katalogvorlage wurde während Eingabe geändert | Katalogversion/Port-Read unterscheidet sich vor Submit | Rolf | inline | aktuellen Katalogwert zeigen oder bewusst als Freitext-Snapshot übernehmen | SPEZ |
