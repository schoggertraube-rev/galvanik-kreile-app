<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Funktionen und Abläufe

## Grundsatz

Alle dürfen standardmäßig alles; der Admin kann je Person sperren oder erweitern. G02 wertet ausschließlich den effektiven, serverseitig bestätigten Autorisierungssnapshot aus. Personenbezeichnungen unten legen die primäre Startseite und die G09-Zuständigkeit fest, nicht eine zusätzliche Rollenwahrheit.

### F-G02-001 — Sitzung in persönliche Shell auflösen

**Auslöser:** Aufruf von `/` oder Rückkehr aus einem Fachobjekt.

**Personen:** Rolf, Phillip, Gregor; Zugriff auf Menüpunkte nach effektiven Capabilities.

**Schritte:**

1. G01 bestätigt Sitzung, Tenant `galvanik-kreile`, aktive Identität und effektive Rechte serverseitig.
2. Ohne gültige Sitzung erfolgt ein Redirect nach `/start`; bei nicht eindeutig bestätigbarer Identität zeigt G02 den sicheren Halt.
3. Gregor wird nach `/settings` geleitet, Phillip erhält „Werkstatt“, Rolf „Der Tag“.
4. Ab 1300 px rendert G02 die Seitenleiste; darunter das Dock „Der Tag“, „Aufträge“, „Kunden“, „Geld“, „Mehr“.
5. Jedes Ziel wird zusätzlich am Server autorisiert; gesperrte Ziele bleiben unerreichbar.

**Ergebnis + Receipt/Readback:** Kein Domain-Receipt, weil G02 nicht schreibt; Readback ist die aus dem bestätigten Autorisierungssnapshot gerenderte Identität, Startseite und Zielmenge.

**Fehlerfälle:** keine/ungültige Sitzung; inaktive oder unbekannte Identität; Rollen-/Session-Drift; Autorisierungsquelle nicht verfügbar; direkte URL ohne Capability.

**Sperren/Konflikte:** S-G02-001 bis S-G02-004; keine fachliche Konfliktkarte aus einem Auth-Fehler.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Personalisierte Überschrift und autorisierte Navigation | Rolf: „Der Tag“; Phillip: „Werkstatt“; Gregor: „Einstellungen“ | `src/app/page.tsx`; Rolf V8; Phillip V4 |
| lädt | Shell-Skelett ohne fremde oder synthetische Fachdaten | FEHLT → Q-G02-001 | keine kanonische Shell-Ladecopy gefunden |
| leer | Shell ist sichtbar, aber eine fachliche Teilprojektion ist leer | Kein zusätzlicher Text; die Teilansicht zeigt ihren belegten Leertext. | D-GOV-001; bestehende Teilansichten |
| Fehler | Sicherer Halt ohne Fallback-Identität | „Produktzugang momentan nicht verfügbar“ | `FoundationUnavailable.tsx` |
| gesperrt | Kein Zielinhalt; vorhandener Fachscreen zeigt seine Verweigerung | FEHLT → Q-G02-001 | keine kanonische gemeinsame Sperrcopy gefunden |
| In Klärung | Nicht klickbares Element bei offener Entscheidung | „In Klärung“ | Anleitung §6 |
| In Aufbau | Nicht klickbares Element einer späteren Anbindung | „In Aufbau“ | Anleitung §6 |

### F-G02-002 — Rolf: „Der Tag“ lesen und handeln

**Auslöser:** Rolf öffnet `/` oder kehrt dorthin zurück.

**Personen:** primär Rolf; andere Personen nur bei wirksam erteilter Capability, nicht durch Rollen-Fallback.

**Schritte:**

1. G02 liest die tenantgebundene Auftragsprojektion aus G04.
2. G02 liest den G09-Konfliktfeed und filtert auf `targetRole = rolf` sowie `surface = home`.
3. Nach realer Anbindung ergänzt G02 M04-Termine/Abwesenheiten und dringende M02-Hinweise; Teilquellen bleiben getrennt erkennbar.
4. Oben erscheinen „Das braucht dich“ und die Rolf-Fälle K-G09-001 bis K-G09-017 gemäß `05_REGELN_SPERREN_KONFLIKTE.md`.
5. Darunter folgen Tagesaufträge, „Heute raus“, neue Aufträge, anstehende Termine und Abwesenheiten.
6. Eine Karte öffnet ausschließlich das kanonische Auftrags- oder Kundenobjekt; die Auflösung geschieht dort.

**Ergebnis + Receipt/Readback:** Kein eigener Receipt; nach Rückkehr liest G02 den Besitzer-Port neu. Ein Fall verschwindet erst, wenn G09 ihn aus der kanonischen Besitzerwahrheit nicht mehr liefert.

**Fehlerfälle:** Auftragsprojektion nicht verfügbar; Teilquelle veraltet; Kalender nicht angebunden; Konfliktfeed fehlerhaft; Objekt wurde zwischenzeitlich geändert oder gelöscht.

**Sperren/Konflikte:** S-G02-001 bis S-G02-008; K-G09-Zuordnung vollständig in `05_REGELN_SPERREN_KONFLIKTE.md`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Handlungsbedarf vor Tagesüberblick, echte Auftragskarten und belegte Teilquellen | „Das braucht dich“, „Heute raus“, „Neu seit gestern 18:30“ | Rolf V8; `RolfHomeClient.tsx` |
| lädt | Platzhalter in gleicher Hierarchie, keine Beispielkarte | FEHLT → Q-G02-001 | RT-22; kein Rolf-Ladetext im Bestand |
| leer | Drei vorhandene Leerhinweise ohne Fake-Auftrag | „Heute keine offenen Aufträge.“; „Heute keine fertigen Aufträge.“; „Seit gestern keine neuen Aufträge.“ | `RolfHomeClient.tsx` |
| Fehler | Wertfreier Teilfehler der Auftragsquelle | „Der Tagesbestand ist gerade nicht verfügbar.“ | `RolfHomeClient.tsx` |
| gesperrt | Tagesbestand wird nicht gezeigt | „Du kannst den Tagesbestand nicht öffnen.“ | `RolfHomeClient.tsx` |
| In Klärung | Graue Statuskarte ohne Zähler und Aktion | „Konflikte & Kapazität — In Klärung“ | G09 K-G09-016; Anleitung §6 |
| In Aufbau | Graue Statuskarte ohne Route oder Aktion | „Kalenderabgleich — In Aufbau“ | OE-2609-19; Anleitung §6 |

### F-G02-003 — Phillip: „Werkstatt“ lesen und handeln

**Auslöser:** Phillip öffnet `/` oder „Werkstatt“.

**Personen:** primär Phillip; andere Personen nur bei wirksam erteilter Capability.

**Schritte:**

1. G02 lädt Wareneingang, Galvanik-WIP und den SQL-KPI-Snapshot tenantgebunden über das vorhandene Werkstatt-Modul.
2. G02 ergänzt den G09-Feed für `targetRole = phillip` und rendert „Heute sichern“ vor dem Tagesüberblick.
3. Die Ansicht zeigt dringende Aufträge, belegte Bündelungsvorschläge, WIP, „Heute raus“ und „Fällig diese Woche“.
4. Nach M04-Anbindung erscheinen anstehende Termine und Abwesenheiten; bis dahin bleibt die Statuskarte „In Aufbau“.
5. „Auftrag öffnen“, „Ware raus“ und WIP führen in das besitzende Grundstamm-Modul; G02 mutiert keinen Auftrag.

**Ergebnis + Receipt/Readback:** Schreibaktionen liefern ihren Receipt im Besitzer-Modul; G02 liest nach Rückkehr Auftrags- und Konfliktprojektion neu. Reines Öffnen erzeugt keinen Receipt.

**Fehlerfälle:** eine der drei Werkstattquellen verweigert oder fällt aus; doppelte Auftragskennung; leere Queue; Teilquelle M04 nicht angebunden.

**Sperren/Konflikte:** S-G02-001 bis S-G02-008; K-G09-002 bis K-G09-012 gemäß Anzeigezuordnung.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Werkstatt-Hierarchie mit Handlungsbedarf, Bündelung und Tageszahlen | „Heute sichern“, „Bündeln heute“, „In Arbeit (Galvanik)“, „Heute raus“, „Fällig diese Woche“ | Phillip V4; `WerkstattView.tsx` |
| lädt | Überschrift und wertfreier Ladehinweis | „Werkstattdaten werden geladen.“ | `WerkstattLoading.tsx` |
| leer | Leerer Tagesüberblick und keine dringende Karte | „Heute keine Termine.“; „Heute keine dringenden Aufträge.“ | `WerkstattView.tsx` |
| Fehler | Fehlermeldung mit erneutem Readback | „Werkstattdaten konnten nicht sicher geladen werden.“; „Erneut laden“ | `WerkstattHome.tsx`; `WerkstattView.tsx` |
| gesperrt | Keine Werkstattdaten | „Werkstattdaten sind für diese Rolle nicht freigegeben.“ | `WerkstattHome.tsx` |
| In Klärung | Graue Statuskarte ohne Zähler und Aktion | „Konflikte & Kapazität — In Klärung“ | G09 K-G09-016; Anleitung §6 |
| In Aufbau | Graue Statuskarte ohne Route oder Aktion | „Kalenderabgleich — In Aufbau“ | OE-2609-19; Anleitung §6 |

### F-G02-004 — Konflikte, Kalender und Analysehinweise komponieren

**Auslöser:** Laden oder Aktualisieren einer Startseite; Rückkehr aus einem Besitzerobjekt.

**Personen:** Rolf oder Phillip nach der Zuständigkeit des gelieferten `ConflictItem`; Gregor erhält keine erfundene operative Konfliktliste.

**Schritte:**

1. G02 fordert G09-Fälle mit Tenant, Zuständigkeit, Anzeigeort, Priorität, Ursache, Objektlink und Quellstatus an.
2. G02 fordert nach Transfergate bei M04 anstehende Auftragstermine, Betriebstermine und Abwesenheiten an.
3. G02 fordert nach Transfergate bei M02 ausschließlich `urgent = true` gelieferte Warnungen/Entscheidungen an.
4. G02 verwirft keine Fachfälle, ändert keine Priorität und baut keinen eigenen Konfliktzähler; es sortiert nur nach dem gelieferten Schweregrad und Zeitpunkt.
5. Derselbe fachliche Fall erscheint nur einmal primär; zusätzliche Orte sind höchstens Status-/Inline-Hinweise laut G09.
6. Technischer Quellstatus erscheint getrennt und wird nie als fachlicher Konflikt gezählt.

**Ergebnis + Receipt/Readback:** Kein G02-Receipt; Deep-Link in das Besitzerobjekt. Nach dessen kanonischem Receipt liest die Startseite neu.

**Fehlerfälle:** Port fehlt; Teilquelle liefert Fehler; Objektlink fehlt; Fall ist veraltet; Kalender kann Kapazität nicht bewerten.

**Sperren/Konflikte:** S-G02-005 bis S-G02-008; K-G09-001 bis K-G09-017.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Karten nur für reale, zuständige und dringende Fälle | Bereich Rolf: „Das braucht dich“; Bereich Phillip: „Heute sichern“ | OE-2609-10, OE-2609-26; Rolf V8; Phillip V4 |
| lädt | Wertfreie Platzhalter je Teilquelle | FEHLT → Q-G02-001 | RT-22; kein kanonischer Sammel-Ladetext |
| leer | Kein leerer Konfliktcontainer; der Tagesüberblick rückt nach oben | Kein zusätzlicher Text. | OE-2609-27 (keine Erklär-/Doppelungsflächen) |
| Fehler | Teilquellenstatus ohne Konfliktzähler | FEHLT → Q-G02-002 | keine kanonische M04-Fehlercopy gefunden |
| gesperrt | Gesperrte Teilquelle liefert keine Karte und keinen Inhalt | FEHLT → Q-G02-001 | keine kanonische gemeinsame Sperrcopy gefunden |
| In Klärung | Unbewertbare Kapazität ohne Alarmwert | „Konflikte & Kapazität — In Klärung“ | G09 K-G09-016 |
| In Aufbau | Nicht angebundener Modulfeed ohne Route | „Kalenderabgleich — In Aufbau“ | Anleitung §6; OE-2609-19 |

### F-G02-005 — Unsicheren Ausgang wiederaufnehmen

**Auslöser:** Ein Besitzer-Modul liefert nach Timeout/Netzfehler einen offenen Wiederaufnahmefall gemäß D-RES-001 beziehungsweise G09 K-G09-001, K-G09-002 oder K-G09-015.

**Personen:** Rolf oder Phillip entsprechend `targetRole`; Gregor nur über Systemadministration, falls G01 selbst einen Administrationsfall besitzt.

**Schritte:**

1. G02 liest ausschließlich den persistierten Wiederaufnahmefall des Besitzer-Moduls.
2. G02 zeigt eine zuständige Karte mit Handlung, Objektbezug und Support-/Korrelationsreferenz, jedoch ohne behaupteten Erfolg oder Misserfolg.
3. Der Klick führt zum Besitzerobjekt; dort erfolgt Receipt-/Readback-Prüfung.
4. Nach eindeutiger Auflösung und erneutem Lesen verschwindet die Karte.

**Ergebnis + Receipt/Readback:** Das Besitzer-Modul erzeugt oder bestätigt den Receipt; G02 besitzt nur den Readback-Link.

**Fehlerfälle:** Wiederaufnahme-Port nicht angebunden; Objektlink nicht vorhanden; Fallquelle nicht erreichbar; Fallzustand widersprüchlich.

**Sperren/Konflikte:** S-G02-006 bis S-G02-008; K-G09-001, K-G09-002, K-G09-015.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Zuständige Wiederaufnahmekarte mit Objektlink | FEHLT → Q-G02-003 | D-RES-001 beschreibt Ort, nicht Copy |
| lädt | Karte bleibt wertfrei bis eindeutiger Readback vorliegt | FEHLT → Q-G02-003 | D-RES-001 |
| leer | Keine Wiederaufnahmekarte | Kein zusätzlicher Text. | OE-2609-27 |
| Fehler | Keine Erfolgs-/Misserfolgsbehauptung, Supportreferenz bleibt sichtbar | FEHLT → Q-G02-003 | D-RES-001; Produktwahrheit |
| gesperrt | Kein Objektdetail; Besitzer-Modul prüft Berechtigung | FEHLT → Q-G02-001 | `../../02_app/docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` (D-RES-001 legt keine Sperr-Copy fest); `08_OFFENE_FRAGEN.md` (Q-G02-001) |
| In Klärung | Graue Karte bei fehlender eindeutiger Ergebniswahrheit | „Ausgang ungeklärt — In Klärung“ | D-RES-001; Anleitung §6 |
| In Aufbau | Nicht angebundener Wiederaufnahme-Port ohne Aktion | „Wiederaufnahme — In Aufbau“ | Anleitung §6 |
