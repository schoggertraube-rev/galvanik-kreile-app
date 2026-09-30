<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Funktionen und Abläufe

## Gemeinsamer Command-Vertrag

Jede Mutation erhält Tenant und Akteur ausschließlich aus der verifizierten Sitzung. Der Request enthält `orderId`, `expectedVersion`, `clientEventId` und nur die fachlich nötigen Nutzdaten. Erfolg bedeutet immer: persistiertes Ereignis/Receipt gelesen, Aggregate-Version geprüft und fachlicher Readback stimmt. Nach einem technisch unklaren Ausgang wird `AUSGANG_UNGEKLÄRT` mit `correlationId` angezeigt; dieselbe Absicht wird nicht blind mit neuer Anfragekennung wiederholt.

### F-G04-001 — Aufträge finden und Karte öffnen

**Auslöser:** Person öffnet `/orders`, Suche, Kundenakte oder einen Auftrags-Deep-Link.

**Personen:** Alle mit `orders.read`; Admin kann die Fähigkeit je Person sperren.

**Schritte:** 1. Session und Tenant prüfen. 2. Liste über den G04-Read-Port laden und serverseitig nach Suchtext/Filter eingrenzen. 3. Zeile öffnen. 4. Detail mit Teilen, Terminen, Verlauf und verlinkten Fremdfakten lesen. 5. Rückweg mit Such-/Filter-/Scrollzustand erhalten.

**Ergebnis + Receipt/Readback:** Read-only; kein Receipt. Der Detail-Readback enthält `orderId`, `orderNumber`, `version` und `readAt`.

**Fehlerfälle:** Nicht gefunden; fremder Tenant; Capability fehlt; Read-Modell unvollständig; technische Nichtverfügbarkeit.

**Sperren/Konflikte:** S-G04-001, S-G04-002; K-G04-008.

### F-G04-002 — Auftrag annehmen

**Auslöser:** `Neuer Eingang` oder bestätigter KV-Zuschlag.

**Personen:** Alle mit `orders.create`; Anlage eines Neukunden zusätzlich mit Kunden-Fähigkeit.

**Schritte:** 1. Bestehenden Kunden wählen oder über G05 anlegen. 2. Teile, Material, Zieloberfläche, Menge, Notiz und bestätigten Auftragstermin erfassen. 3. Bei KV-Zuschlag Wunsch- und bestätigten Termin getrennt übernehmen. 4. Command einmal absenden. 5. Nummer unter Datenbank-Lock vergeben. 6. Auftrag, Teile, Ereignis und Receipt in einer Transaktion schreiben. 7. Receipt lesen und Auftrag fachlich zurücklesen.

**Ergebnis + Receipt/Readback:** Neuer Auftrag in `angenommen`, Version 1, Nummer `A-JJJJ-NNNN`, `ORDER_INTAKE_CREATED_V1`, Durable Receipt und identischer Readback.

**Fehlerfälle:** Kunde fehlt; Pflichtfeld ungültig; Anfragekennung anders wiederverwendet; Nummernvergabe/Readback nicht eindeutig; Ausgang unklar.

**Sperren/Konflikte:** S-G04-003, S-G04-004; K-G04-001, K-G04-002.

### F-G04-003 — Lebenszyklus fortschreiben

**Auslöser:** `In Galvanik`, `Fertig melden` oder `Abholung`.

**Personen:** Alle mit der jeweiligen Command-Fähigkeit.

**Schritte:** 1. Aktuellen Zustand und Version laden. 2. Nur den nächsten erlaubten Übergang anbieten. 3. Command mit `expectedVersion` und `clientEventId` ausführen. 4. Ereignis und Receipt lesen. 5. Auftrag zurücklesen. 6. Bei `fertig` Freeze und Fertig-Zeitpunkt, bei `abgeholt` Abholereignis prüfen.

**Ergebnis + Receipt/Readback:** Genau ein neuer Zustand und genau eine erhöhte Version; UI bestätigt erst nach Readback.

**Fehlerfälle:** Ungültiger Übergang; veraltete Version; fehlender historischer Stundensatz; Zahlungs-/Warenausgangsgate; unklarer Ausgang.

**Sperren/Konflikte:** S-G04-005 bis S-G04-008; K-G04-003 bis K-G04-006.

### F-G04-004 — Auftragstermin oder Abholtermin ändern

**Auslöser:** Terminaktion in Auftragskarte, Werkstatt oder Terminübersicht.

**Personen:** Alle mit `orders.schedule.write`; Admin kann je Person sperren.

**Schritte:** 1. Aktuelle Version und beide Termine lesen. 2. Genau ein Feld (`confirmedDueDate` oder `pickupDueDate`) wählen. 3. Neues Datum und Änderungsgrund erfassen. 4. `changeOrderSchedule` mit `expectedVersion` senden. 5. Auftrag und `ORDER_SCHEDULE_CHANGED_V1` atomar schreiben. 6. Receipt lesen. 7. Auftragskarte, Terminprojektion und Konfliktfakten zurücklesen/revalidieren. 8. M04 später asynchron mit stabilen Auftrags-/Positionsreferenzen benachrichtigen; M04/Host komponiert daraus autorisiert die minimale Übersicht und den vollständigen Termin, sein Ausfall ändert den G04-Erfolg nicht.

**Ergebnis + Receipt/Readback:** Alter und neuer Wert, Grund, Akteur, Zeit, Version und Korrelations-ID sind belegt; alle G04-Ansichten zeigen denselben neuen Wert.

**Fehlerfälle:** Ungültiges Datum; fehlender Grund; veraltete Version; Auftrag bereits abgeholt; Ausgang unklar; M04-Projektion ausstehend.

**Sperren/Konflikte:** S-G04-009, S-G04-010; K-G04-003, K-G04-007, K-G04-009. UI-Aktivierung wartet auf Q-G04-006.

### F-G04-005 — Termine in Woche und Monat nachschlagen

**Auslöser:** Deep-Link von Startseite/Werkstatt oder bewusster Aufruf der Terminübersicht.

**Personen:** Alle mit `orders.schedule.read`.

**Schritte:** 1. Zeitraum und Zeitzone `Europe/Berlin` festlegen. 2. Bestätigte und Abholtermine aus dem G04-Read-Port laden. 3. Woche oder Monat nur als Darstellung umschalten. 4. Konfliktmarkierung aus deterministischen Fakten anzeigen. 5. Auftrag öffnen; keine zweite Kalenderdatenbank schreiben. 6. Später M04-Betriebstermine/Abwesenheiten read-only hinzumischen und als externe Quelle markieren.

**Ergebnis + Receipt/Readback:** Read-only Projektion mit stabilen Auftrags-IDs und Deep-Links; kein Receipt.

**Fehlerfälle:** Zeitraum ungültig; G04 nicht verfügbar; externe M04-Daten nicht verfügbar; teilweise Daten werden ausdrücklich als teilweise markiert.

**Sperren/Konflikte:** S-G04-001, S-G04-011; K-G04-007, K-G04-009, K-G04-010. Oberfläche bleibt bis Q-G04-006 `In Aufbau`.

### F-G04-006 — Teile, Notizen, Dokumente und Mehrarbeit pflegen

**Auslöser:** Aktion in der Auftragskarte.

**Personen:** Alle mit der jeweiligen Schreibfähigkeit.

**Schritte:** 1. Auftrag und Version laden. 2. Teil-/Auftragsscope festlegen. 3. Katalogwert oder zulässigen Freitext erfassen. 4. Für Mehrarbeit aktuellen Stundensatz als Historienwert übernehmen. 5. Command ausführen und Receipt lesen. 6. Referenz des Evidenz-Fundaments nur verknüpfen, nicht kopieren. 7. Karte zurücklesen.

**Ergebnis + Receipt/Readback:** Geändertes Teil/Notiz/Mehrarbeit mit eindeutiger Scope-ID, Ereignis und neuer Auftragsversion.

**Fehlerfälle:** Auftrag eingefroren; Teil nicht zu Auftrag; Referenz fremder Tenant; ungültiger Katalogwert; fehlender Stundensatz; unklarer Ausgang.

**Sperren/Konflikte:** S-G04-002, S-G04-007; K-G04-003, K-G04-004, K-G04-008.

### F-G04-007 — Termintreue-Fakten liefern

**Auslöser:** M02 oder ein berechtigter Auftrags-/Kundenkontext liest KPI-Fakten.

**Personen:** Read-Port; Darstellung folgt der anfragenden Capability.

**Schritte:** 1. Kanonischen bestätigten Termin lesen. 2. Fertig-Zeitpunkt aus Freeze-Fakt und Abholzeitpunkt aus Abholereignis lesen. 3. Storno-Klassifikation lesen. 4. Missing-Reasons statt Ersatzwerte liefern. 5. Keine Kennzahl in G04 berechnen; M02 berechnet aus unveränderten Fakten.

**Ergebnis + Receipt/Readback:** Versioniertes `OrderTimelinessFact` mit Provenienz der Zeitpunkte; read-only.

**Fehlerfälle:** Legacy-Terminfelder widersprechen sich; Storno ungeklärt; Zeitpunkte fehlen; Ereignis mehrfach vorhanden.

**Sperren/Konflikte:** S-G04-012; K-G04-008. Storno bleibt gemäß Q-G04-002 `In Klärung`.

## Zustände — Auftragsliste

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Überschrift, Suche/Filter, reale Auftragszeilen und Öffnen-Aktion | „Aufträge“ | V5 `ordersPage`; `src/app/orders/OrdersAppAdapter.tsx` |
| lädt | Ruhiger Ladezustand ohne Beispieldaten | „Aufträge werden geladen.“ | `src/app/orders/OrdersAppAdapter.tsx` |
| leer | Leere Liste mit realer Anlage-Aktion | „Keine Aufträge.“ | `src/app/orders/OrdersAppAdapter.tsx` |
| Fehler | Fehlerfläche mit erneutem Laden | „Aufträge konnten nicht sicher geladen werden.“ | `src/app/orders/OrdersAppAdapter.tsx` |
| gesperrt | Keine Daten; Ursache und Rückweg | „Aufträge sind für diese Sitzung nicht freigegeben.“ | `src/app/orders/OrdersAppAdapter.tsx`; OE-2609-09 |
| In Klärung | Ausgegrauter Storno-Einstieg | „Auftragsstorno – In Klärung“ | OE-2609-21; Anleitung §6; Q-G04-002 |
| In Aufbau | Ausgegrauter Terminübersichts-Einstieg | „Termine Woche/Monat – In Aufbau“ | OE-2609-13; Anleitung §6; Q-G04-006 |

## Zustände — Auftragskarte

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reale Auftragskarte mit Status, Terminen, Teilen und Aktionen | „Auftrag {Auftragsnummer}“ | Auftragskarte V8; `src/modules/orders/ui/OrderCardView.tsx` |
| lädt | Karte als Ladefläche | „Auftragskarte wird geladen“ | `src/modules/orders/ui/OrderCardView.tsx` |
| leer | Auftrag existiert nicht; Rückweg zur Liste | „Auftrag nicht vorhanden“ | `src/modules/orders/ui/OrderCardView.tsx` |
| Fehler | Fehlerfläche mit erneutem Laden | „Auftragskarte nicht verfügbar“ | `src/modules/orders/ui/OrderCardView.tsx` |
| gesperrt | Keine Fachdaten; Rückweg | „Auftragskarte nicht freigegeben“ | `src/modules/orders/ui/OrderCardView.tsx`; OE-2609-09 |
| In Klärung | Nicht klickbare Storno-Aktion | „Auftragsstorno – In Klärung“ | OE-2609-21; Q-G04-002 |
| In Aufbau | Nicht klickbarer Analysehinweis, bis M02 angebunden ist | „Termintreue – In Aufbau“ | OE-2609-21, OE-2609-22; Anleitung §6 |

## Zustände — Terminübersicht Woche/Monat

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Woche/Monat mit bestätigten und Abholterminen | FEHLT → Q-G04-006 | OE-2609-13, OE-2609-19; Designphase 1b offen |
| lädt | Ruhiger Skeleton-/Ladezustand | FEHLT → Q-G04-006 | Designphase 1b offen |
| leer | Zeitraum ohne Auftragstermine, ohne Fake-Termine | FEHLT → Q-G04-006 | Designphase 1b offen |
| Fehler | G04-Daten nicht lesbar; Wiederholen/Rückweg | FEHLT → Q-G04-006 | Designphase 1b offen |
| gesperrt | Keine Termindaten; Rückweg | FEHLT → Q-G04-006 | OE-2609-09; Designphase 1b offen |
| In Klärung | Kapazitätsbewertung deaktiviert | „Kapazitätsbewertung – In Klärung“ | OE-2609-13; Q-G04-004 |
| In Aufbau | Gesamte Ansicht bis Designfreigabe nicht klickbar | „Termine Woche/Monat – In Aufbau“ | Anleitung §6; Q-G04-006 |
