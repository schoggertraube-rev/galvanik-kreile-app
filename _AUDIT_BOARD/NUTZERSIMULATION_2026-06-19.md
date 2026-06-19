# NUTZERSIMULATION — KREILE WERKSTATTCOCKPIT
## Persona A: Inhaber, Mitte 60 | Persona B: Sohn / Nachfolger
### Simulationsdatum: 2026-06-19

---

## SIMULATIONSURTEIL

> **ZU KOMPLEX**

**Begründung:** Die App ist für einen digital versierten, disziplinierten und eingeschulten Nutzer nutzbar — nicht für Franz Kreile. Kernprobleme: (1) Ohne aktive PIN-Session zeigt die App 0 Daten, ohne jeden Hinweis. Der Inhaber hält die App für leer und kaputt. (2) Die Startseite zeigt gefälschte Zähler (84 Aufträge) — der erste Eindruck lügt. (3) Die wichtigste Nutzerfrage — „Wo ist das Teil? Wann ist es fertig?" — erfordert mindestens 4-5 Navigationsschritte. (4) Der Sohn sieht Begriffe wie „Forecast", „Aging", „KPI" und schließt das Tab.

Die Infrastruktur ist solide. Der Betrieb wird davon nichts merken, weil die App nicht so genutzt wird, wie sie gebaut wurde.

---

## 1. KRITISCHE NUTZUNGSPROBLEME

| Prio | Situation | Verhalten des Nutzers | Problem | Auswirkung | Notwendige Änderung |
|------|-----------|----------------------|---------|------------|---------------------|
| **P0** | Inhaber öffnet App am Morgen ohne frische PIN-Session | Sieht leere Listen überall. Denkt: „Hängt sich auf, ist kaputt." Schließt App. | Auth scheitert still — kein Hinweis auf fehlende Anmeldung | App wird nicht genutzt, weil sie leer wirkt | SessionWarningBanner oder Auto-Redirect zu `/start` |
| **P0** | Inhaber sieht Startseite: „84 Aufträge, 3 kritisch" | Hält das für real. Klickt auf Aufträge. Sieht 0 Einträge. Versteht nicht warum. | Fake-Fallback `orders.length \|\| 84` täuscht echte Daten vor | Vertrauensverlust ab erster Nutzung | Fake-Fallbacks entfernen, 0 ehrlich zeigen |
| **P0** | Kunde ruft an: „Wann ist mein Auftrag fertig?" | Inhaber tippt Nachnamen in Suche. 0 Treffer — weil kein Login. | `customers.actions.ts` gibt 0 zurück ohne Session | Kundengespräch nicht beantwortbar — „ich schau nach und rufe zurück" | Auth-Feedback + Tenant-Filter fix (Audit M-03/M-04) |
| **P1** | Inhaber beginnt Auftragserfassung, wird durch Telefon unterbrochen | Schließt Browser-Tab. Öffnet App neu. Formular ist weg. | Kein Draft-Mechanismus — kein `localStorage`, kein Server-Draft | Auftrag geht verloren, wird nicht erfasst | Auto-Save-Draft im Wareneingang |
| **P1** | Inhaber scannt Zettel/Beleg | Bekommt „Scan erfolgreich" — aber Auftrag wird nie erstellt | `handleConfirm()` = console.log, kein DB-Write | Arbeit verloren, falsches Vertrauen in Feature | Audit P0-Fix M-01 |
| **P1** | Mitarbeiter sucht: „Wo liegt das Teil für den Kunden Maier?" | Geht zu `/orders`, sieht 0 Aufträge | Station/Standort ist im Schema vorhanden — aber Seite zeigt 0 wegen Auth | Suchzeit entsteht durch App-Fehler, nicht durch echte Unklarheit | Auth-Fix + `currentStationId`-Anzeige in Auftragskarte |
| **P1** | Sohn öffnet `/cockpit` | Sieht `Forecast`, `Aging`, `Engpass`, `KPI`, `PlaceholderKachel` | 4 von 8 Begriffen sind Fachsprache ohne Übersetzung. PlaceholderKachel ist sichtbar. | Sohn schließt Cockpit nach 15 Sekunden. Motivation: 0. | Plain-Language-Labels + PlaceholderKachel verstecken |
| **P2** | Inhaber will Rückruf-Erinnerung für Kunden setzen | Findet Kalender-Seite. Sieht „Rückruf: Hr. Weber (Reklamation)" — hardcoded, nicht seiner | Kalender nutzt Mock-Daten | Inhaber vertraut Kalender nicht | Kalender auf echte Telefonnotiz-DB koppeln |
| **P2** | Sohn sucht: „Welche Aufträge blockieren Geld?" | Findet keine klare Antwort auf Startseite oder Cockpit in unter 30 Sekunden | Abholbereite Aufträge nicht prominent auf Startseite | Geld liegt still, Abholung wird nicht aktiv initiiert | „Fertig zur Abholung — Wert X €" als prominenter Block auf Startseite |
| **P2** | Inhaber pflegt Status eines Auftrags nach Stationsübergabe nicht | Teil liegt in Schleiferei, Status zeigt noch Wareneingang | Status-Update erfordert Navigation zur Station-Seite, mehrere Klicks | Tatsächlicher Teilestandort unbekannt | 1-Klick-Statuswechsel direkt aus Auftragsübersicht |
| **P3** | Sohn will wissen ob der Monat besser läuft als der letzte | Findet keine Vergleichs-Ansicht auf Cockpit oder Startseite | Kein Vormonat-Vergleich sichtbar | Motivation durch sichtbaren Fortschritt fehlt | „Diese Woche vs. letzte Woche" direkt im Cockpit-Header |
| **P3** | Inhaber sucht Kunden nach Fahrzeug oder Ort, nicht Name | Gibt „Mercedes" in Global Search ein | Search sucht in: name, city, companyName — kein Fahrzeugfeld, kein Teiletyp | Suchzeit entsteht, Inhaber findet nichts | Global Search auf Bestellfelder ausweiten (Beschreibung, Teile-Typ) |

---

## 2. INHABER-PERSPEKTIVE (Persona A)

| Aufgabe | Aktueller Ablauf | Erwartetes Fehlverhalten | Idealer Ablauf |
|---------|-----------------|-------------------------|----------------|
| **Morgens App öffnen** | Startseite mit animierten Zählern. Ohne Session: alles 0. | Sieht 0 Aufträge. Denkt: App kaputt. Nutzt Papier. | Direkt nach Login-Prompt weiterleiten. Echte Zahlen sofort zeigen. |
| **Kundenfrage: „Wann fertig?"** | Global Search → Name eingeben → 0 Ergebnisse (kein Login) → Navigation zu Kunden → 0 Kunden | Ruft zurück: „Ich schau kurz nach." Schaut auf Zettel. | Name eintippen → Kunde sofort → alle Aufträge + Status + realistischer Termin auf einem Blick |
| **Neuen Auftrag erfassen** | `/warendurchlauf/neu` → Redirect zu Wareneingang → Erfassungs-Modal | Wird durch Telefon unterbrochen. Schließt Tab. Auftrag weg. | Auftrag mit 3 Pflichtfeldern starten (Kundenname, Teiletyp, Datum), Rest optional. Auto-Draft. |
| **Teil scannen** | Öffnet `/scan`. Scannt. Bekommt Bestätigung. | Glaubt Auftrag ist erstellt. Ist er nicht. | Scan → OCR → Bestätigung nur nach DB-Erfolg |
| **Rückruf planen** | Navigiert zu Kalender. Sieht fremden Mock-Rückruf. | Gibt auf. Schreibt Zettel. | Telefonnotiz → Rückruf-Checkbox → erscheint in eigenem Kalender-Block |
| **Status aktualisieren** | Navigiert zu Station → sucht Auftrag → ändert Status | Vergisst Schritt. Status bleibt falsch. | Mitarbeiter an Station scannt Auftrag → Status wechselt automatisch |
| **Kunde abholen lassen** | Muss wissen welche Aufträge fertig sind. Navigiert zu Aufträge → Filter „fertig" | 0 Ergebnisse (kein Login). Weiss nicht. | Startseite: „Fertig zur Abholung: 3 Aufträge — Wert 2.400 €" mit 1-Klick-Liste |
| **Preis / Angebot nennen** | Aus Erinnerung schätzen. „Das kostet ungefähr 200 Euro." | Schätzt falsch. Kunde erwartet anderen Preis. | Kalkulations-Modul (noch nicht gebaut): Teiletyp + Verfahren → Preisvorschlag |

---

## 3. NACHFOLGER-PERSPEKTIVE (Persona B)

| Kennzahl / Thema | Verständlich? | Konkrete Bedeutung (wie sie dargestellt sein müsste) | Handlung | Motivationseffekt |
|-----------------|--------------|------------------------------------------------------|----------|-------------------|
| **„Aging 31-60 Tage"** | ❌ Nein | „3 Rechnungen über 4.200 € sind seit über einem Monat unbezahlt. Heute anrufen." | Kunde anrufen-Button direkt aus Kachel | Hoch — wenn Geld eingeht, ist Wirkung sichtbar |
| **„Forecast"** | ❌ Nein | „Voraussichtlicher Monatsumsatz: 18.400 €" | — | Mittel — wenn der Begriff weg ist |
| **„Engpass Kachel"** | ⚠️ Halb | Engpass ist verständlich, aber Kachel zeigt Stationsname ohne Erklärung | „Schleiferei hat 7 Aufträge — 3× die normale Last. Dort nachfragen." | Hoch — konkrete Handlung |
| **„Termintreue 78 %"** | ✅ Ja | „22 von 100 Aufträgen kommen zu spät" | „Welche sind das?" → Liste öffnen | Hoch — wenn Vorwoche-Vergleich dabei ist |
| **„KPI Kachel"** | ❌ Nein | Was ist der KPI? Welcher? Warum? | — | 0 — Sohn ignoriert |
| **„Offene Forderungen"** | ⚠️ Begriff unbekannt | „Wir haben 11.800 € noch nicht bekommen — davon sind 4.200 € seit über 30 Tagen überfällig." | „3 anrufen" — Button mit Kundenname | Sehr hoch — echtes Geld, sofortige Handlung |
| **„PlaceholderKachel"** | ❌ — | Zeigt nichts. Sohn fragt: „Was soll das?" | — | Negativ — wirkt unfertig |
| **„Was muss ich heute tun?"** | ❌ Nicht vorhanden | Warendurchlauf-Leitstand hat Checkliste — aber nur auf /warendurchlauf/wareneingang, nicht auf Startseite | — | Fehlend — das ist die wichtigste Frage des Sohns |
| **„Durchlaufzeit"** | ❌ Nein | „Ein Auftrag braucht im Schnitt 4,3 Tage — vor einem Monat waren es 3,8 Tage. Warum?" | Station mit längster Wartezeit anzeigen | Mittel |
| **„Was hat sich verbessert?"** | ❌ Nicht vorhanden | Kein Vorwoche-Vergleich irgendwo | — | Fehlend — Hauptmotivator für Nachfolger |

---

## 4. PAPIER-ZU-DIGITAL-ÜBERGANG

| Heutiger Papierprozess | Digitales Äquivalent | Notwendige Vereinfachung | Übergangsrisiko |
|-----------------------|---------------------|--------------------------|-----------------|
| Auftragszettel beim Wareneingang | Erfassungs-Modal in `/warendurchlauf/wareneingang` | Zettel fotografieren → OCR vorbereitet Felder → Mitarbeiter bestätigt nur | OCR ist aktuell gebrochen (P0). Mitarbeiter muss alles manuell tippen. |
| Kundenkartei auf Papier / in Köpfen | Kundenstamm in DB mit Global Search | Name genügt zum Finden — ohne Kundennummer | Auth-Fehler macht Suche wertlos |
| Zettel „Teil liegt in Schleiferei" | `currentStationId` im Orders-Schema | 1 Scan oder 1 Klick = Standort aktualisiert | Status wird nicht gepflegt — System zeigt falsche Station |
| Telefonnotiz auf Papier | `/kommunikation` + Telefonnotiz-Server-Action | Dictate oder Freitext → KI extrahiert Rückruf, Auftrag, Termin | Kommunikations-UI ist unvollständig. Kalender zeigt Mock. |
| Manuelle Preisfindung aus Kopf | Kalkulations-Modul | Noch nicht gebaut | Kein Übergang möglich — bleibt Papier/Gedächtnis |
| Monatsabrechnung / Übergabe an Steuerberater | Buchhaltungsmodul mit Beleg-OCR | Beleg scannen → Felder prüfen → speichern | OCR gebrochen → Papier bleibt Pflicht |
| Handschriftlicher Kalender | `/kalender` mit echten Telefonnotizen | Kalender muss echte Daten zeigen | Kalender zeigt Fake-Daten → kein Vertrauen → Papier bleibt |

**Fazit Übergangsrisiko:** Der Papier-Rückzug wird scheitern, weil zwei Brücken fehlen: (1) OCR funktioniert nicht → Zettel abtippen ist mehr Arbeit als Papier. (2) Auth-Fehler macht die App leer → Mitarbeiter kehren zu Papier zurück.

---

## 5. AUTOMATISIERUNGSPOTENZIALE

| Automatisierung | Nutzen | Notwendige Daten | Freigabe | Risiko | Priorität |
|----------------|--------|-----------------|----------|--------|-----------|
| **Tägliche Prioritätenliste** „Was ist heute zu tun?" | Inhaber und Sohn haben sofortigen Fokus | `dueDate`, `currentStationId`, `risk` | Keine — automatisch | Falsche Prio bei Datenlücken | **1 — SOFORT** |
| **Alert: Auftrag liegt seit >2 Tagen still** | Liegengebliebene Teile werden sichtbar, bevor Kunde anruft | `updatedAt` pro Station, `currentStationId` | Anzeige — kein Auto-Eingriff | Fehlalarm bei Warteprozessen | **2 — HOCH** |
| **Abholbenachrichtigung** wenn Auftrag zu Warenausgang wechselt | Weniger Anrufe „Wann kann ich abholen?" | `currentStationId = 'warenausgang'` | Opt-in per Kundenprofil | Kundeneinwilligung nötig | **3 — HOCH** |
| **Mahnungs-Trigger** bei >30 Tage offener Rechnung | Liquidität verbessern | `aging_bucket`, Rechnungsdaten | 1-Klick durch Sohn / Büro | Kundenbeziehung | **4 — HOCH** |
| **Fertigstellungsprognose** basierend auf Durchlaufzeit je Station | Inhaber kann belastbare Termine nennen | Durchschnittliche Verweildauer je Station, aktueller Auftragsstand | Keine — Vorschlag | Ungenau bei Engpässen | **5 — MITTEL** |
| **Rückruf-Erinnerung** aus Telefonnotiz | Zugesagter Rückruf wird nicht vergessen | `analyzePhoneNote()` + Kalender-Eintrag | Kalender-Entry nach Bestätigung | Gemini-Analyse muss korrekt sein | **6 — MITTEL** |
| **Wochenbericht für Sohn** jeden Montag | Vergleich Vorwoche — ohne Navigation | Events, orders, Rechnungen | Automatisch generiert, Sohn bestätigt | Zu viele Zahlen = ignoriert | **7 — MITTEL** |
| **Engpasserkennung** wenn Station >X Aufträge hat | Sohn sieht Handlungsbedarf | `currentStationId` Zählung | Warnung in Cockpit | Grenzwert schwer zu kalibrieren | **8 — MITTEL** |
| **Nachkalkulation**: Zeit vs. Angebot | Sohn lernt welche Aufträge Geld bringen | Zeiterfassung (`arbeitszeit_buchung`) + Auftragswert | Keine | `arbeitszeit_buchung` hat kein UI | **9 — SPÄTER** |
| **KI-Zusammenfassung** Betriebslage für Chef-Dashboard | 60-Sekunden-Überblick ohne Navigation | Alle relevanten KPIs | Tägliches Auto-Rendering | Gemini muss verlässlich zusammenfassen | **10 — MITTEL** |

---

## 6. TOP-10-REIBUNGSPUNKTE

Die zehn wahrscheinlichsten Abbruch- oder Fehlbedienungs-Stellen für genau diese Nutzer:

1. **App wirkt leer ohne Session** — Inhaber öffnet App, sieht nichts, schließt sie. Passiert täglich. → Häufigster App-Abbruch-Grund.

2. **Startseite zeigt „84 Aufträge" → klickt → sieht 0** — Vertrauensverlust nach Sekunde 10. Entscheidend für Erst-Akzeptanz.

3. **Scan-to-Order zeigt Erfolg, erstellt aber nichts** — Inhaber meint, Auftrag sei drin. Auftrag fehlt. Stunden später Kundenproblem.

4. **Auftrag halb erfasst, Telefon klingelt** — Browser-Tab zu, Daten weg. Passiert täglich. Inhaber gibt Erfassung auf.

5. **Sohn sieht „PlaceholderKachel"** — Cockpit wirkt wie Demo-Version. Motivation für Nutzung sinkt auf 0.

6. **Fachbegriffe: „Forecast", „Aging", „KPI"** — Sohn schließt Cockpit nach 15 Sekunden, weil er nicht versteht was er sehen soll.

7. **Kein „Was mache ich heute?"-Button auf Startseite** — Die Tages-Checkliste existiert, ist aber auf `/warendurchlauf/wareneingang` versteckt. Kein Nutzer findet sie dort.

8. **Kalender zeigt Fake-Rückruf „Hr. Weber"** — Inhaber sieht fremden Eintrag, verliert Vertrauen in Kalender. Schreibt Rückrufe weiter auf Zettel.

9. **Status wird nicht gepflegt → Teile-Standort falsch** — Mitarbeiter pflegen Station nicht aktiv, weil es 3 Klicks braucht. System zeigt Teile falsch verortet.

10. **Suche nach Fahrzeug / Teiletyp schlägt fehl** — Inhaber sucht „Mercedes W204 Felgen" — findet nichts, weil Global Search nicht in Auftragsbeschreibungen sucht. Greift zu Papier.

---

## 7. KONKRETE VERBESSERUNGSVORSCHLÄGE

### VS-01: Session-Hinweis bei leerer Datenlage
- **Seite:** Alle authentifizierten Seiten
- **Workflow:** Datenabruf bei fehlendem Auth-Cookie
- **Änderung:** Wenn `checkAppAuth()` UNAUTHORIZED liefert → sticky Banner „Bitte neu einloggen" mit Link zu `/start`, ODER Auto-Redirect nach 3 Sekunden
- **Erwarteter Nutzen:** App wird nicht als kaputt wahrgenommen
- **Nachweis:** Nutzer landet nach Token-Ablauf auf `/start`, nicht vor leerer Liste

### VS-02: Fake-Fallbacks entfernen, 0 ehrlich zeigen
- **Seite:** `src/app/page.tsx`
- **Workflow:** Dashboard-Rendering
- **Änderung:** `orders.length > 0 ? orders.length : 84` → `orders.length`. Hardcoded Mitarbeiternotizen entfernen.
- **Erwarteter Nutzen:** Startseite ist vertrauenswürdig ab Tag 1
- **Nachweis:** Startseite zeigt exakt die Daten aus DB

### VS-03: Tages-Fokus-Block auf Startseite
- **Seite:** `src/app/page.tsx`
- **Workflow:** Tagesstart
- **Änderung:** Block oben auf Startseite mit: „Heute: X kritische Aufträge · Y fertig zur Abholung (Z €) · W offene Rechnungen" — alle klickbar. Identisch zur Warendurchlauf-Checkliste, aber direkt auf der Startseite.
- **Erwarteter Nutzen:** Inhaber und Sohn haben in 5 Sekunden Fokus
- **Nachweis:** Sohn findet in 30 Sekunden: was läuft schlecht, wo verliert der Betrieb Zeit, was blockiert Geld

### VS-04: Cockpit: Plain-Language-Kachel-Labels
- **Seite:** `src/app/cockpit/`
- **Workflow:** Tagessteuerung Nachfolger
- **Änderung:** „Forecast" → „Erwarteter Umsatz". „Aging" → „Offene Rechnungen — wie alt?". „KPI" → spezifischen Begriff nennen, z.B. „Termintreue". „PlaceholderKachel" ausblenden bis gebaut.
- **Erwarteter Nutzen:** Sohn versteht Cockpit ohne Schulung
- **Nachweis:** Sohn navigiert Cockpit und benennt korrekt, was jede Kachel bedeutet

### VS-05: Auto-Draft bei unterbrochener Auftragserfassung
- **Seite:** `/warendurchlauf/wareneingang`
- **Workflow:** Auftragserfassung
- **Änderung:** Formular-State wird laufend in `sessionStorage` gespeichert. Beim nächsten Öffnen: „Unvollständiger Auftrag — weiterführen?" mit Vorschau der eingegebenen Daten.
- **Erwarteter Nutzen:** Unterbrochene Erfassung geht nicht mehr verloren
- **Nachweis:** Seite nach Tab-Schließung erneut öffnen → Daten wiederhergestellt

### VS-06: Fertig-zur-Abholung — prominenter Block
- **Seite:** `src/app/page.tsx`
- **Workflow:** Abholmanagement
- **Änderung:** Dedizierter Block: „Fertig — wartet auf Abholung: 3 Aufträge · 2.400 €" mit direkter Kunden-Kontakt-Option (Anruf-Button)
- **Erwarteter Nutzen:** Gebundenes Kapital sinkt. Sohn hat konkretes Tagesziel mit Geldwert.
- **Nachweis:** „Offener Abholwert" sinkt messbar nach Einführung des Blocks

### VS-07: Vorwoche-Vergleich im Cockpit-Header
- **Seite:** `src/app/cockpit/page.tsx`
- **Workflow:** Tagesstart Nachfolger
- **Änderung:** 3 Kernindikatoren mit Pfeil: „Termintreue: 78 % → 86 % ↑". „Durchlaufzeit: 4,3 → 3,9 Tage ↓". „Offene Abholung: 8.400 → 2.400 € ↓"
- **Erwarteter Nutzen:** Sohn sieht Verbesserung sofort — primärer Motivator
- **Nachweis:** Sohn öffnet Cockpit regelmäßig

### VS-08: 1-Klick-Statuswechsel direkt aus Auftragsübersicht
- **Seite:** Auftragskarte (alle Listenansichten)
- **Workflow:** Statuspflege im Tagesbetrieb
- **Änderung:** In jeder Auftragskarte: Swipe-Aktion oder Dropdown „Station wechseln zu:" ohne separaten Navigationspfad
- **Erwarteter Nutzen:** Status wird gepflegt, weil Aufwand minimal ist
- **Nachweis:** `currentStationId`-Änderungen je Tag steigen signifikant

### VS-09: Kalender auf echte Telefonnotiz-Rückrufe koppeln
- **Seite:** `src/app/kalender/page.tsx`
- **Workflow:** Wiedervorlage
- **Änderung:** Mock-Einträge ersetzen durch echte `phoneNotes` mit `status = 'waiting_callback'`. Dann koppeln mit `calendar_events`-Tabelle.
- **Erwarteter Nutzen:** Inhaber verlässt sich auf Kalender statt Zettel
- **Nachweis:** Kein Rückruf-Zettel mehr auf Schreibtisch nach 4 Wochen

### VS-10: Global Search auf Auftragsbeschreibung ausweiten
- **Seite:** `global-search-actions.ts`
- **Workflow:** Teile/Auftrag finden nach Fahrzeug oder Teiletyp
- **Änderung:** `orders`-Suche um `ilike(orders.description, safeTerm)` und `ilike(orders.vehicleInfo, safeTerm)` erweitern
- **Erwarteter Nutzen:** Inhaber findet Auftrag nach „Mercedes" oder „Felgen", nicht nur Kundennummer
- **Nachweis:** Suchzeit für Tagesgeschäft sinkt messbar

---

## DEFINITION OF DONE — SIMULATIONSCHECK

| Kriterium | Status | Blockierende Lücke |
|-----------|--------|-------------------|
| Kunde ohne Auftragsnummer findbar | ⚠️ Möglich, aber Auth-Fehler macht Suche leer | M-04 (Auth-Feedback) |
| Aktueller Standort eines Teils nachvollziehbar | ⚠️ Schema vorhanden — UI zeigt 0 ohne Session | M-04 + VS-08 |
| Kundenfrage nach Fertigstellung belastbar beantwortbar | ❌ Nein — 0 Daten ohne Login, kein Prognosemechanismus | M-04 + Fertigstellungsprognose |
| Unvollständige Erfassungen nicht verloren | ❌ Nein — kein Draft-Mechanismus | VS-05 |
| Statuspflege mit minimalem Aufwand | ❌ Nein — 3+ Klicks, kein 1-Click-Update | VS-08 |
| App erkennt fehlende Daten | ⚠️ Warning Engine gebaut, keine Live-Rules | F-007 (Archaeologie) |
| Sohn versteht wirtschaftliche Zusammenhänge ohne BWL | ❌ Nein — Fachbegriffe, kein Kontext, kein Vorwoche-Vergleich | VS-04 + VS-07 |
| Jede Kennzahl löst Handlung aus | ❌ Nein — AgingKachel hat Anruf-Button, Rest nicht | VS-04 |
| Verbesserungen sichtbar und motivierend | ❌ Nicht vorhanden | VS-07 |
| App funktioniert bei geringer Disziplin | ❌ Nein — Status, Draft, Auth alle manuell | VS-05, VS-08, M-04 |
| Papierprozesse kontrolliert digitalisiert | ❌ OCR gebrochen, Kalender Mock | M-02, M-03, VS-09 |
| App reduziert Suchzeit, Rückfragen, Verzögerungen | ❌ Nicht nachweisbar — 0 echte Daten ohne Session | Alle M-Tasks |

**Ergebnis: 0 von 12 DoD-Kriterien vollständig erfüllt.**

---

## ABSCHLUSSKOMMENTAR DER SIMULATION

Franz Kreile würde die App nach spätestens drei Tagen ignorieren — nicht weil er digital unversiert ist, sondern weil die App ihn bei seiner ersten echten Frage im Stich lässt: „Wann ist der Auftrag für Müller fertig?" Die Antwort der App: leere Liste.

Phillip (Sohn) würde das Cockpit einmal öffnen, „Forecast" und „PlaceholderKachel" sehen, und es nicht wieder öffnen. Nicht weil er kein Interesse hat, sondern weil die App ihm die Frage, die ihn interessiert — „Was muss ich heute tun, damit der Betrieb besser läuft?" — nicht beantwortet.

Die gute Nachricht: Die Lücke zwischen dem jetzigen Stand und einer App, die diese Personas wirklich nutzen, ist technisch klein. Die kritischen Fixes (Auth-Feedback, Fake-Daten entfernen, Tages-Fokus auf Startseite, Plain-Language-Labels) brauchen zusammen unter 10 Stunden. Danach ist die App zum ersten Mal ehrlich zu ihren Nutzern.

---

*Simulation durchgeführt: 2026-06-19*
*Methodik: Persona-basierte Worst-Case-Nutzung, alle 8 Testszenarien durchlaufen, Code-Evidenz aus statischer Analyse*
*Rolle: Principal User Simulation Specialist — Realistische Nutzer-Simulation Inhaber / Nachfolger*
