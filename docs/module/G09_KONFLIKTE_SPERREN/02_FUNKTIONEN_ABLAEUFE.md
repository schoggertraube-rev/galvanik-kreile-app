<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 02 — Funktionen und Abläufe

## Verantwortlichkeitsregel

Die Regel ist aus OE-2609-10/13, den User Twins und dem Rollenvertrag abgeleitet:

- **Phillip** bekommt direkt lösbare operative Werkstattarbeit: fehlender Beleg am aktuellen Werkstattschritt, heute fällige physische Ausführung, Auftragsbewegung, manuelle Bündelprüfung und zurückgegebene/zugewiesene Auftragsaufgabe.
- **Rolf** bekommt alles mit externer Zusage oder Entscheidung: fehlender/zu ändernder Termin, Kundenkontakt, Preis, Zahlung, Rechnung, Sonderfreigabe, Reklamation, widersprüchliche Daten, wirtschaftliche Wirkung und alle eskalierten oder von Phillip zurückgegebenen Fälle.
- **Gregor** ist kein Empfänger fachlicher Kreile-Konflikte. Technische Konto-/Berechtigungsadministration liegt in G01/G10 und erscheint nicht als normaler G09-Startseitenfall.

### F-G09-001 — Harten Schreibkonflikt sicher behandeln

- **Auslöser:** Ein Command erhält eine veraltete Version, eine wiederverwendete `clientEventId` mit anderer Absicht, einen unzulässigen Ausgangszustand oder eine widersprüchliche Tenant-/Objektbindung.
- **Personen:** Auslösender autorisierter Mitarbeiter; zuständige Startseite nur, wenn der Fall nach Readback wiederaufnehmbar bleibt.
- **Schritte:** 1. Server autorisiert Actor und Tenant. 2. Command prüft exakte Eingabe, Quellzustand, `expectedVersion` und Idempotenz. 3. Bei Abweichung null Mutation. 4. UI zeigt verständlichen Grund und lädt den Besitzer-Read-Port neu. 5. Erst danach wird eine weiterhin gültige Aktion angeboten.
- **Ergebnis + Receipt/Readback:** Erfolg nur mit unveränderlichem Receipt plus bestätigtem Readback; Konflikt mit `CONFLICT` und aktuellem Readback; unklarer Transportausgang mit `AUSGANG_UNGEKLÄRT` und Receipt-Suche.
- **Fehler:** Keine technischen Tabellen-/Providerdetails anzeigen; `correlationId` für Support erhalten; kein blinder Retry.
- **Sperren:** Tenant, Rolle, Capability, Objektgraph, erlaubter Übergang, Version und Idempotenz wirken serverseitig.

### F-G09-002 — Konfliktfeed für Rolf und Phillip bilden

- **Auslöser:** Rollen-Startseite lädt oder ein besitzender Read-Port meldet nach erfolgreichem Readback neue Fakten.
- **Personen:** Rolf oder Phillip nach der obigen Regel.
- **Schritte:** 1. App-Adapter ruft nur öffentliche, tenantgebundene Read-Ports auf. 2. Jeder Adapter bildet neutrale `ConflictItemV1`. 3. Der HostAdapter ordnet Kreile-Verantwortlichkeit zu. 4. Identische Schlüssel werden dedupliziert. 5. Nur offene, handlungsrelevante Items werden nach `blockierend > dringend > wichtig > Hinweis`, dann objektiver Frist sortiert. 6. Maximal der relevante Ausschnitt erscheint in „Das braucht dich“ beziehungsweise „Heute sichern“; der Deep-Link öffnet den Besitzer-Vorgang.
- **Ergebnis + Receipt/Readback:** Der Feed selbst schreibt nichts und trägt `generatedAt` sowie `sourceUpdatedAt`; Auflösung erfolgt ausschließlich über den Fach-Command samt Receipt/Readback.
- **Fehler:** Fällt eine Quelle aus, wird nicht „alles in Ordnung“ gezeigt; die Quelle erscheint als verständlicher Fehlerzustand, während belegte andere Quellen getrennt bleiben.
- **Sperren:** Kein Import privater Tabellen, keine Local-Storage-Wahrheit, kein generisches Erledigen, keine technische Gregor-Zuordnung.

### F-G09-003 — Fristkonflikt erkennen und lösen

- **Auslöser:** Realer `due_date` liegt vor heute oder liegt heute, während der Auftrag den dazu nötigen Endzustand noch nicht erreicht hat; alternativ fehlt/ist der Termin ungültig.
- **Personen:** Phillip für die heute noch ausführbare Werkstattaktion; Rolf für fehlenden Termin, Kundenversprechen oder Terminverschiebung.
- **Schritte:** 1. Read-Port liefert Termin, Status/Station, Version und Datenstand. 2. Vergleich erfolgt in `Europe/Berlin` auf Kalendertagsebene. 3. Vergangener Termin wird „überfällig“, heutiger Termin „heute fällig“, morgiger Termin nur „morgen fällig“. 4. Kein Laufzeitmodell wird unterstellt. 5. Aktion öffnet Auftrag/Werkstatt beziehungsweise den versionierten Terminänderungsweg. 6. Nach Receipt wird neu gelesen.
- **Ergebnis + Receipt/Readback:** Keine Schreibaktion für reines Öffnen; Terminänderung benötigt eigenen Command, Ereignis, Receipt und Readback; die Karte verschwindet erst nach geänderter Fachwahrheit.
- **Fehler:** Fehlender/ungültiger Termin zeigt „Termin — In Klärung“ statt `0`, „heute“ oder eines Fantasiedatums.
- **Sperren:** Keine automatische Terminverschiebung, keine Überschreibung der früheren Zusage, keine Bezeichnung als Kapazitätskonflikt.

### F-G09-004 — Kalenderüberschneidung prüfen

- **Auslöser:** Ein Auftragstermin oder Wunschtermin trifft zeitlich auf eine read-only Abwesenheit oder einen Betriebstermin aus dem Kreile-Büropostfach.
- **Personen:** Rolf als Eigentümer externer Terminentscheidungen; Phillip erhält erst eine konkret neu zugewiesene operative Folgeaktion.
- **Schritte:** 1. `CalendarPort` liefert Auftragstermine, Abwesenheiten und Betriebstermine mit stabiler Korrelation, Zeitzone, Zeitintervall, Personen-/Ressourcenbezug und Datenstand. 2. Der Orders-Port liefert Auftrag, Zuordnung und Termin. 3. Nur dieselbe Person/Ressource und echte Intervallüberschneidung erzeugen einen Konflikt. 4. Fehlende Zuordnung bleibt Information. 5. Rolf öffnet Auftrag/Terminverschiebung; Kalenderansicht ist nur Nachschlageweg. 6. Änderung wird in der Fachdomäne geschrieben und nach M365 projiziert; danach Reconciliation/Readback.
- **Ergebnis + Receipt/Readback:** Fach-Receipt für Terminänderung plus Provider-Korrelation und bestätigter Kalender-Readback; keine eigene Kalenderzeile in G09.
- **Fehler:** Nicht verbunden: „Kalenderabgleich — In Aufbau“; Providerfehler: „Kalender konnte nicht abgeglichen werden. Erneut laden.“; keine Aussage „kein Konflikt“.
- **Sperren:** Funktion bleibt bis echtem Konto, Consent, Secret-Bindung, Provider-E2E und Least Privilege geschlossen; kein Google-/Demo-/DB-Fallback.

### F-G09-005 — WIP ehrlich anzeigen

- **Auslöser:** Phillip öffnet „Heute sichern“ oder Werkstatt und der Orders-Port liefert aktuelle Aufträge je belegtem Status/Station.
- **Personen:** Phillip; Rolf nur bei daraus entstehender externer Terminentscheidung.
- **Schritte:** 1. Zähle aktuelle Aufträge anhand der kanonischen Orders-Wahrheit. 2. Zeige beispielsweise „In Arbeit (Galvanik): 12 Aufträge“, wenn exakt 12 Datensätze vorliegen. 3. Zeige Fristlabels separat. 4. Nenne den Wert nie Kapazität oder Auslastung. 5. Bei unvollständigem Read-Umfang keine Hochrechnung.
- **Ergebnis + Receipt/Readback:** Reine Projektion mit `sourceUpdatedAt`; keine Mutation und kein Receipt.
- **Fehler:** Unvollständige Quelle zeigt „WIP konnte nicht vollständig geladen werden“ statt einer Teilzahl ohne Kennzeichnung.
- **Sperren:** Keine Prozentwerte, Schwellen, Wartezeiten, Reststunden oder Engpassaussage.

### F-G09-006 — Bündelung manuell prüfen

- **Auslöser:** Mindestens zwei offene Auftragsteile tragen dieselbe nichtleere belegte Oberflächenangabe, zum Beispiel den Freitext „Zink“.
- **Personen:** Phillip.
- **Schritte:** 1. Orders-Port liefert offene Teile mit Auftrag, Oberfläche, Termin und Deep-Link. 2. Der HostAdapter gruppiert nur normalisierte identische Anzeigewerte; er behauptet keine technische Kompatibilität. 3. Karte lautet bei Zink: „3 Aufträge nennen Zink — Bündelung prüfen“. 4. Aktion öffnet eine gefilterte Liste der beteiligten Aufträge. 5. Phillip prüft außerhalb dieses Hinweises die reale Eignung und führt jeden vorhandenen Fach-Command einzeln aus.
- **Ergebnis + Receipt/Readback:** Der Hinweis selbst erzeugt keinen Schreibvorgang, kein Receipt und keine Reihenfolge; spätere Fachaktionen folgen ihren eigenen Receipts.
- **Fehler:** Uneinheitliche/fehlende Oberflächenangaben erzeugen keinen Bündelhinweis; keine Ähnlichkeitsschätzung.
- **Sperren:** Keine automatische Zusammenfassung, Termin-/Statusänderung, Ersparnis-, Kapazitäts- oder „heute zusammen fahren“-Behauptung.

### F-G09-007 — Zahlung oder Warenausgang sperren

- **Auslöser:** Mitarbeiter versucht Rechnung/Warenausgang, obwohl Status, Payment Mode, Zahlung, Freeze oder Integrität nicht passen.
- **Personen:** Rolf verantwortet Geld-/Freigabeentscheidung; Phillip sieht am Auftrag nur die konkrete Ausgabesperre.
- **Schritte:** 1. Server liest Payment Summary und Auftrag unter Tenant/Version. 2. Command prüft Lifecycle und `goodsOutAllowed`. 3. Bei Sperre null Mutation und verständlicher Grund. 4. Rolf öffnet Zahlungs-/Rechnungsweg. 5. Nach erfolgreichem Zahlungs-/Modus-Receipt wird Summary erneut gelesen. 6. Erst ein neuer Warenausgangs-Command kann danach erfolgreich sein.
- **Ergebnis + Receipt/Readback:** Getrennte Receipts für Zahlungsmodus/Zahlung/Warenausgang; jede Stufe mit Readback.
- **Fehler:** Inkonsistente Summary ist `UNAVAILABLE`, nicht „bezahlt“ oder „freigegeben“.
- **Sperren:** Serverseitiges Payment-/Lifecycle-Gate, Version, Rollen, Idempotenz und unveränderliche Belege.

### F-G09-008 — Auftragsaufgabe delegieren und zurückgeben

- **Auslöser:** Rolf delegiert eine konkrete auftragsbezogene Aufgabe an einen aktiven berechtigten Mitarbeiter oder Phillip gibt sie zurück.
- **Personen:** Rolf als Entscheidungseigentümer; Phillip als möglicher Bearbeiter.
- **Schritte:** 1. Rolf wählt aktiven Assignee. 2. Vorhandener Assignment-Command prüft Rolle, Tenant, Auftrag, Version und Idempotenz. 3. Receipt/Readback zeigt dieselbe Zuweisung beiden Personen. 4. Rolf kann durch erneute autorisierte Zuweisung zurückholen. 5. Phillip kann über den vorhandenen Handback-Command zurückgeben; die Aufgabe erscheint wieder bei Rolf. 6. Nicht persistierte Erwartungen/Gründe werden nicht vorgetäuscht.
- **Ergebnis + Receipt/Readback:** `ORDER_TASK_ASSIGNED_V1` oder `ORDER_TASK_HANDED_BACK_V1` mit unveränderlichem Receipt und Assignment-Readback.
- **Fehler:** Inaktiver/fremder Assignee, veraltete Version oder fremde Rückgabe scheitert ohne Seiteneffekt.
- **Sperren:** Kein generisches Konflikt-Assignment; nur auftragsbezogener bestehender Vertrag. Snooze und zusätzliche Erwartungs-/Fristfelder bleiben gemäß Q-G09-004 geschlossen.

### F-G09-009 — Unsicheren Ausgang nach Netzfehler wieder aufnehmen

- **Auslöser:** Verbindung bricht nach Absenden eines Commands vor bestätigtem Receipt/Readback ab.
- **Personen:** Ursprünglicher Actor; die zuständige Startseite erst nach belegtem offenen Fachzustand.
- **Schritte:** 1. UI markiert `AUSGANG_UNGEKLÄRT`. 2. Dieselbe `clientEventId` wird zur Receipt-Suche genutzt. 3. Bei gefundenem Receipt folgt Readback. 4. Ohne Receipt wird der aktuelle Fachzustand gelesen. 5. Nur wenn der ursprüngliche Command nachweislich nicht angewandt wurde und weiterhin gültig ist, darf der Nutzer bewusst erneut auslösen.
- **Ergebnis + Receipt/Readback:** Genau ein Fachereignis oder nachweislich keines; keine lokale Erfolgswahrheit.
- **Fehler:** Bleibt der Readback unerreichbar, bleibt der Fall sichtbar mit „Ausgang ungeklärt — Verbindung prüfen“.
- **Sperren:** Kein automatischer Blind-Retry, keine doppelte Mutation, kein Entfernen der Konfliktkarte.

## Sieben Zustände je Funktion

Die folgenden Tabellen sind der vollständige Builder-Vertrag. `FEHLT → Q-G09-002` bedeutet: fachliches Verhalten und sicherer Zwischenzustand sind entschieden, die endgültige visuelle/textliche Gestaltung folgt Designphase 1; bis dahin darf keine freie Alternativformulierung als freigegeben ausgegeben werden.

### Zustände F-G09-001 — Harter Schreibkonflikt

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Nach Receipt/Readback der bestätigte aktuelle Auftrag. | „Aktueller Stand geladen.“ | D-RES-001; Interimstext |
| lädt | Aktion bleibt deaktiviert, während Receipt/Readback gesucht wird. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Kein Konflikt und keine zusätzliche Konfliktkarte. | „Kein Schreibkonflikt.“ | D-RES-001; Interimstext |
| Fehler | Readback ist nicht erreichbar; keine Erfolgsmeldung. | „Aktueller Stand konnte nicht geladen werden. Erneut laden.“ | D-RES-001; Interimstext |
| gesperrt | Veralteter oder unzulässiger Command mit Reload-Aktion. | „Änderung nicht möglich — der Auftrag wurde inzwischen geändert. Aktuellen Stand laden.“ | Command-Verträge; Interimstext |
| In Klärung | Transportausgang ist unbekannt. | „Ausgang ungeklärt — aktuellen Stand laden.“ | D-RES-001 |
| In Aufbau | UI-Anbindung des gebauten Serververtrags fehlt. | „Konfliktbehandlung — In Aufbau“ | CURRENT_STATE; Interimstext |

### Zustände F-G09-002 — Rollenfeed

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Priorisierte, deduplizierte Karten im Rollenbereich. | Rolf: „Das braucht dich“; Phillip: „Heute sichern“ | Rolf V8; Phillip V4 |
| lädt | Stabile Skelettfläche ohne Zahl oder Leerbehauptung. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Positiver Zustand erst nach vollständigem Read. | Rolf: „Nichts Kritisches offen.“ Phillip: „Werkstatt läuft rund · nichts hängt. Termine für heute sind gesichert.“ | Rolf V8 sinngemäß; Phillip V4 wörtlich |
| Fehler | Unvollständiger Feed mit Retry; belegte Teilquellen getrennt. | „Konflikte konnten nicht vollständig geladen werden. Erneut laden.“ | D-RES-001; Interimstext |
| gesperrt | Feed sichtbar, Aktion capabilitybedingt nicht ausführbar. | „Aktion gesperrt — zuständige Person: {Name}.“ | Rollenvertrag; Interimstext |
| In Klärung | Nicht belegte Konflikt-/Kapazitätsanteile grau. | „Konflikte & Kapazität — In Klärung“ | Anleitung §5 |
| In Aufbau | Extern abhängiger Feedanteil noch nicht verbunden. | „Kalenderabgleich — In Aufbau“ | OE-2609-18/19 |

### Zustände F-G09-003 — Fristkonflikt

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Auftrag mit objektivem Fristlabel und sicherer Aktion. | „Überfällig“, „Heute fällig“ oder „Morgen fällig“ | Performance-UX-Vertrag; A-G09-014 |
| lädt | Keine vorläufige Fristklassifikation. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Nach vollständigem Read kein offener überfälliger/heutiger Fall. | „Keine fälligen Aufträge offen.“ | Interimstext; Owner-UX in Designphase 1 prüfen |
| Fehler | Fristdaten nicht lesbar. | „Termine konnten nicht geladen werden. Erneut laden.“ | D-RES-001; Interimstext |
| gesperrt | Terminentscheidung benötigt Rolf oder der Command scheitert. | „Terminänderung gesperrt — Rolf muss entscheiden.“ | Rollenvertrag; Interimstext |
| In Klärung | Termin fehlt, ist ungültig oder widersprüchlich. | „Termin — In Klärung“ | Anleitung §5; Q-G09-007 |
| In Aufbau | Versionierter Terminänderungsweg ist noch nicht geliefert. | „Terminverschiebung — In Aufbau“ | OE-2609-19; Ist-Code-Befund |

### Zustände F-G09-004 — Kalenderüberschneidung

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reale Überlappung gleicher Person/Ressource mit Auftrag und Zeit. | „Termin überschneidet sich mit {Abwesenheit/Betriebstermin}. Termin prüfen.“ | OE-2609-19; Interimstext |
| lädt | Kalender-Read läuft, keine Konfliktfrei-Aussage. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Nur bei erfolgreichem vollständigem Provider-Read. | „Keine Terminüberschneidung gefunden.“ | D-RES-001; Interimstext |
| Fehler | Provider/Readback nicht verfügbar. | „Kalender konnte nicht abgeglichen werden. Erneut laden.“ | D-RES-001; F-G09-004 |
| gesperrt | Provideraktion ohne Consent/Capability bleibt geschlossen. | „Kalenderaktion gesperrt — Verbindung oder Berechtigung fehlt.“ | D-ARCH-011/012; Interimstext |
| In Klärung | Person/Ressource ist nicht stabil zuordenbar. | „Kalenderzuordnung — In Klärung“ | Q-G09-008 |
| In Aufbau | M365-Port nicht real verbunden. | „Kalenderabgleich — In Aufbau“ | Provider-Matrix; OE-2609-18 |

### Zustände F-G09-005 — WIP

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reale Anzahl je belegter Station/Status. | „In Arbeit (Galvanik): {n} Aufträge“ | Phillip V4; Performance-UX-Vertrag |
| lädt | Keine Null oder alte Zahl. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Vollständiger Read mit belegter Null. | „In Arbeit (Galvanik): 0 Aufträge“ | Performance-UX-Vertrag; Interimstext |
| Fehler | Quelle ist unvollständig, Teilzahl nicht als vollständig zeigen. | „WIP konnte nicht vollständig geladen werden.“ | F-G09-005 |
| gesperrt | Read fehlt wegen Capability. | „WIP nicht verfügbar — Berechtigung fehlt.“ | Authorization-Vertrag; Interimstext |
| In Klärung | Kapazitätsdeutung bleibt getrennt geschlossen. | „Kapazität — In Klärung“ | Q-G09-001 |
| In Aufbau | WIP-Projektion ist noch nicht an die Rollenfläche gebunden. | „WIP-Anzeige — In Aufbau“ | Ist-Code-Befund; Interimstext |

### Zustände F-G09-006 — Bündelprüfung

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Anzahl und identisches Oberflächenlabel mit Prüf-Link. | „{n} Aufträge nennen {Oberfläche} — Bündelung prüfen“ | Phillip V4; Produktwahrheit eingeschränkt |
| lädt | Keine vorläufige Gruppe oder Ersparnis. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Kein Hinweis; der Bereich bleibt ohne leere Warnkarte. | Kein sichtbarer Text. | OE-2609-22; Hinweis ist nur bei Treffer relevant |
| Fehler | Gruppenquelle nicht vollständig. | „Bündelprüfung konnte nicht geladen werden.“ | D-RES-001; Interimstext |
| gesperrt | Gefilterte Liste nicht erlaubt/erreichbar. | „Bündelprüfung nicht verfügbar — Auftrag öffnen.“ | Routing-/Capability-Vertrag; Interimstext |
| In Klärung | Oberflächenwerte sind leer, widersprüchlich oder nicht vergleichbar. | „Bündelung — In Klärung“ | Produktwahrheit; Q-G09-001 |
| In Aufbau | Read-only Gruppierung noch nicht geliefert. | „Bündelprüfung — In Aufbau“ | Red-Team RT-03 |

### Zustände F-G09-007 — Zahlung/Warenausgang

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kanonischer Payment-/Goods-out-Status mit erlaubter Aktion. | Fachtext aus `PaymentSummary`/Besitzer-Command, nicht in G09 gedoppelt. | F1.5; D-RES-001 |
| lädt | Warenausgang bleibt deaktiviert. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Kein offener Zahlungs-/Ausgabeblocker; keine G09-Karte. | Kein sichtbarer Text. | OE-2609-22 |
| Fehler | Integrität/Read ist nicht verfügbar. | „Zahlungsstatus konnte nicht geprüft werden. Warenausgang bleibt gesperrt.“ | F1.5; Interimstext |
| gesperrt | Besitzer-Command liefert den konkreten Sperrgrund. | „Warenausgang gesperrt — {fachlicher Grund}.“ | `recordGoodsOutCommand`; Interimstext-Rahmen |
| In Klärung | Widersprüchliche/unklare Zahlungswahrheit. | „Zahlungsstatus — In Klärung“ | D-RES-001 |
| In Aufbau | G07-Regel/Startseitenfeed ist noch nicht vollständig angebunden. | „Zahlungskonflikte — In Aufbau“ | Plan T-06/G07 |

### Zustände F-G09-008 — Delegation

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Aktiver Verantwortlicher und Rückgabe-/Rückholweg am Auftrag. | „Verantwortlich: {Name}“ | F1.3; V5/V8 |
| lädt | Zuweisung bleibt unverändert, Aktion deaktiviert. | FEHLT → Q-G09-002 | Designphase 1 |
| leer | Keine aktive Zuweisung; keine zusätzliche G09-Karte. | „Nicht delegiert“ | F1.3; Interimstext |
| Fehler | Assignment-Readback nicht verfügbar. | „Zuweisung konnte nicht geladen werden. Erneut laden.“ | D-RES-001; Interimstext |
| gesperrt | Rolle, Assignee, Tenant oder Version unzulässig. | „Zuweisung nicht möglich — aktuellen Stand laden.“ | Assignment-Command; Interimstext |
| In Klärung | Erwartung/Rückgabegrund/Snooze hat keinen persistierten Vertrag. | „Delegationsdetails — In Klärung“ | Q-G09-004 |
| In Aufbau | Rollen-UI für bestehenden Assignment-Vertrag fehlt. | „Delegation — In Aufbau“ | CURRENT_STATE; Ist-Code-Befund |

### Zustände F-G09-009 — Ausgang wieder aufnehmen

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Gefundenes Receipt und bestätigter aktueller Fachzustand. | „Änderung bestätigt.“ | D-RES-001; Interimstext |
| lädt | Receipt-Suche/Readback läuft; keine weitere Aktion. | „Aktueller Stand wird geprüft …“ | D-RES-001; Interimstext |
| leer | Kein Receipt gefunden und Fachzustand zeigt keine angewandte Änderung. | „Keine bestätigte Änderung gefunden.“ | D-RES-001; Interimstext |
| Fehler | Receipt und Fachzustand bleiben unerreichbar. | „Ausgang ungeklärt — Verbindung prüfen.“ | D-RES-001 |
| gesperrt | Wiederholung ist bis zum Readback blockiert. | „Erneut senden gesperrt — zuerst aktuellen Stand laden.“ | D-RES-001; Interimstext |
| In Klärung | Ergebnis ist noch nicht eindeutig. | „Ausgang ungeklärt — aktuellen Stand laden.“ | D-RES-001 |
| In Aufbau | Offline-/Wiederaufnahme-UI ist noch nicht geliefert. | „Wiederaufnahme — In Aufbau“ | Red-Team RT-11 |

## Zustände aller sichtbaren G09-Flächen

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Priorisierte Karten mit Ursache, Auswirkung, Frist, Zuständigkeit, Datenstand und einer sicheren Aktion. | Rolf: „Das braucht dich“; Phillip: „Heute sichern“ | Rolf V8; Phillip V4; OE-2609-10/22 |
| lädt | Skelettflächen in unveränderter Höhe, keine Zahl und kein vorweggenommener Leerzustand. | FEHLT → Q-G09-002 | Designphase 1 erforderlich |
| leer | Ehrlicher positiver Zustand, nachdem alle Quellen erfolgreich gelesen wurden. | Rolf: „Nichts Kritisches offen.“ Phillip: „Werkstatt läuft rund · nichts hängt. Termine für heute sind gesichert.“ | Rolf V8 sinngemäß; Phillip V4 wörtlich |
| Fehler | Betroffene Quelle und erneut laden; andere belegte Quellen bleiben sichtbar. | „Konflikte konnten nicht vollständig geladen werden. Erneut laden.“ | D-RES-001; Builder-Text bis Designphase 1 |
| gesperrt | Grund, zuständige Rolle und sicherer nächster Weg am betroffenen Vorgang. | „Aktion gesperrt — zuerst den angezeigten Grund klären.“ | D-RES-001; genaue Fachtexte je Besitzer-Command |
| In Klärung | Graue, nicht klickbare Fläche ohne Zahl oder Ergebnisbehauptung. | „Konflikte & Kapazität — In Klärung“ | Anleitung §5; Q-G09-001/002 |
| In Aufbau | Graue, nicht klickbare Kalenderfläche ohne Grün-/Konfliktfrei-Aussage. | „Kalenderabgleich — In Aufbau“ | OE-2609-18/19; Provider-Matrix |
