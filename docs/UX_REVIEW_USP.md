# UX-Review: Kern-USP Analyse

**KERN-USP:** "Wo ist die Ware? Wann wird sie geliefert?"

Dieses Review bewertet die aktuelle UI/UX der Kreile WerkstattCockpit App ausschließlich anhand der Sichtbarkeit dieses zentralen USPs.

## 1. HOME (Dashboard)
- **Status Quo:** Das Dashboard zeigt aggregierte KPI-Metriken ("In Galvanik", "Warenausgang"), eine allgemeine Tages-Timeline und Alerts (z. B. "Salzsäure fast leer").
- **USP-Score: 2/5**
- **Kritik:** Die Ansicht ist sehr management-fokussiert. Wenn ein Mitarbeiter schnell wissen muss, welche *konkreten* 3 Aufträge heute raus müssen, sieht er nur die Zahl "3", muss aber klicken, um zu sehen, welche es sind. Die konkrete Ware ist hinter Klicks versteckt.

## 2. WARENDURCHLAUF (Intake)
- **Status Quo:** Diese Route (`/warendurchlauf`) beinhaltet einen sehr detaillierten Wizard zur Auftragserfassung (OCR, Kamera, Teile-Eingabe). 
- **USP-Score: 1/5**
- **Kritik:** Der Name suggeriert einen Überblick über den "Durchlauf" der Halle, zeigt aber tatsächlich die *Neuerfassung*. Der USP "Wo ist die Ware?" wird hier gar nicht beantwortet.

## 3. GALVANIK-QUEUE
- **Status Quo:** Aufträge werden nach "Fälligkeit" (Urgency: Kritisch, Gefährdet, Im Plan) sortiert.
- **USP-Score: 4/5**
- **Kritik:** Sehr guter Fokus auf die Dringlichkeit (Liefertermin) als primäres Sortierkriterium. Eine Suche nach ID oder Kundenname existiert. Visuell könnte der exakte Abholtermin jedoch noch dominanter sein als die Auftrags-ID.

## 4. WARENAUSGANG
- **Status Quo:** Aufträge sind nach Kunde gruppiert. Es gibt deutliche Badges ("Bereit zum Versand" vs. "Unvollständig").
- **USP-Score: 4/5**
- **Kritik:** Hervorragend für die schnelle Abwicklung. Der Mitarbeiter sieht sofort, wenn ein Kunde seine Ware abholen kann. (Die echte Datenbank-Logik für den "Unvollständig"-Status muss noch nachgezogen werden).

## 5. KUNDEN / AUFTRAEGE (Suche)
- **Status Quo:** Es gibt Suchfelder in den Queues und eine Kundensuche.
- **USP-Score: 3/5**
- **Kritik:** Wenn ein Kunde anruft, muss der Mitarbeiter zuerst den Kunden suchen, dann dessen Aufträge öffnen, um den aktuellen Status (`station`) zu sehen. Das dauert ca. 5–10 Sekunden.

## 6. MOBILE (Responsive)
- **Status Quo:** Layout bricht sauber um (Tailwind flex/grid). 
- **USP-Score: 3/5**
- **Kritik:** Auf dem Handy rutschen wichtige Meta-Infos (wie Fälligkeiten) manchmal in Zweitzeilen oder Ausklapp-Menüs.

---

## 🚀 Top-5-Verbesserungen (Priorisiert nach Impact/Aufwand)

1. **Dashboard: Liste der "Kritischen Aufträge" direkt einblenden**
   - *Impact:* Hoch | *Aufwand:* Klein
   - *Maßnahme:* Statt nur "3 kritisch" im KPI-Card anzuzeigen, eine kleine Liste der 3 überfälligen Aufträge direkt unter die KPIs packen.
2. **Globale Express-Suche (Header) für Auftragsnummern**
   - *Impact:* Hoch | *Aufwand:* Mittel
   - *Maßnahme:* Wenn ein Kunde anruft ("Auftrag A-123"), muss die Nummer direkt oben im Header eingegeben werden können und ein Flyout zeigt sofort: "Zinkbad 2, fertig um 14:00 Uhr".
3. **Route `/warendurchlauf` umbenennen**
   - *Impact:* Mittel | *Aufwand:* Klein
   - *Maßnahme:* Umbenennen in `/auftragserfassung` (Intake). Das verhindert Verwirrung bei neuen Mitarbeitern, die dort den Hallenstatus erwarten.
4. **Visuelle Restzeit-Indikatoren in der Galvanik-Queue**
   - *Impact:* Mittel | *Aufwand:* Mittel
   - *Maßnahme:* Statt nur "Kritisch (Rot)" echte kleine Countdown-Balken ("Noch 2h bis Abholung") an die Aufträge heften.
5. **Echte "Live-Hallenplan"-Ansicht**
   - *Impact:* Sehr Hoch | *Aufwand:* Groß
   - *Maßnahme:* Eine dedizierte Ansicht, in der Aufträge als kleine Karten visuell in den jeweiligen Stationen (Eingang -> Zink -> Chrom -> Ausgang) liegen (Kanban-Style). Das ist der ultimative USP.
