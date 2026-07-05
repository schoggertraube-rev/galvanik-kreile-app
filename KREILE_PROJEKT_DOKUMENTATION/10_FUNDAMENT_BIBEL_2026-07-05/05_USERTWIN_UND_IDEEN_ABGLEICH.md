# 05 · Abgleich mit User Twins & Ideenkatalogen

Prüffrage: Trägt das heutige Fundament die Bedürfnisse von Rolf, Philipp, Michael — und wurden die dokumentierten Ideen (4.385 Zeilen in 5 Katalogen) umgesetzt oder gingen sie verloren?

---

## Teil A — User-Twin-Abgleich

### Rolf (Inhaber, Desktop, „Entlastung ohne Kontrollverlust")

| Rolfs Kernbedürfnis | Fundament heute | Lücke / Befund |
|---|---|---|
| Verlässlicher Gesamtüberblick (Umsatz/Gewinn/Liquidität) | Views + Cockpit vorhanden | Fachwerte teils in TS mit Magic-Number-Schwellen (F-E1); Stationskette gebrochen (F-B3) → Zahlen nicht voll belastbar |
| „Weniger Papier, kein zusätzliches System pflegen" | Capture/OCR-Ansatz da | Doppelte Datenpfade + Mock (F-C1) → System wirkt unzuverlässig statt entlastend |
| Handlungsbedarf statt bloßer Zahlen | Ansätze da | 8-Fragen-Karte nicht durchgängig belegt |
| **„Lehnt jede Lösung ab, die mehr Pflege als Nutzen erzeugt"** | — | **Größtes Risiko:** solange Vernetzung unzuverlässig ist, bestätigt die App Rolfs schlimmste Befürchtung. Welle 2 ist für seine Akzeptanz entscheidend. |
| Nachvollziehbare, korrekte Zahlen | teils | tote RLS/doppelte Pfade können abweichende Mengen zeigen (F-A1/F-C1) — direkter Angriff auf sein Vertrauen |

### Philipp (Nachfolger, Tablet, „lohnt sich das für mich?")

| Philipps Kernbedürfnis | Fundament heute | Lücke / Befund |
|---|---|---|
| Tablet-schnell, wenige Schritte, visuell | UI-Shell + animierte Zähler da | Client-Wasserfälle (F-G2) → Jank auf Tablet; widerspricht „besonders schnell" |
| „Was bringt meine Arbeit?" (Leistungswirkung sichtbar) | Ansätze (Fortschritt/Zähler) | Gamification rudimentär (I-12 DEFERRED) |
| Umsatz/Gewinn/Kosten verständlich, nicht wie Bürosoftware | Cockpit da | Buchhaltung-Aggregation im Client (F-E2); Gefahr „wirkt wie alte Software" |
| Nicht als Kontrolle durch Rolf erscheinen | Rollen/Permissions da (P-4) | rollenspezifische UI-Ausprägung offen (I-16) |

### Michael (Büro, geringe Digitalkompetenz, „mach mir keine Mehrarbeit")

| Michaels Kernbedürfnis | Fundament heute | Lücke / Befund |
|---|---|---|
| Fast ohne Texteingabe, große Buttons, Sprache | phoneNotes/localPhoneAnalysis vorhanden | Reife/End-to-End unklar; Spracherfassung nicht als belastbarer Flow belegt |
| Kunden/Aufträge automatisch erkennen | customer-search vorhanden … | … aber ungeschützt und ohne Tenant (F-A5) — funktional da, sicherheitskritisch |
| Nur realistische Termine zusagen (Schutz vor Fehlzusage) | — | Kapazitäts-/Terminlogik nicht belegt (I-14 DEFERRED) — Michaels Kernrisiko „optimistische Zusage" ungelöst |
| „Jeder neue Pflichtschritt muss durch Entlastung kompensiert werden" | — | Solange Capture unzuverlässig ist (F-C2/C3/C4), erlebt Michael Mehrarbeit — genau sein Abbruchkriterium |

**Twin-Fazit:** Das Fundament adressiert die *richtigen* Bedürfnisse konzeptionell, scheitert aber aktuell an **Zuverlässigkeit** — und Zuverlässigkeit ist bei allen drei Twins das Akzeptanz-Nadelöhr. Die Reparatur-Wellen 2 (ein Datenpfad) und 4 (Capture/Offline) sind damit nicht nur technisch, sondern **produktentscheidend**.

---

## Teil B — Ideenkatalog-Abgleich (Verlustkontrolle)

Aus 5 Katalogen (Home/Dashboard, Auftragsbuch/Kundenkartei, Warendurchlauf, Betriebs-Cockpit, Performance/KI) — Kernideen und Status (Details im `IDEA_REGISTER.md`, I-01…I-17):

**Umgesetzt / in Arbeit (nicht verloren):**
- Startseite „Was ist heute wichtig?" mit echten Orders (I-01)
- Foto→Auftrag-Slice (I-04, aber Persistenz gebrochen)
- Betriebs-Cockpit mit Views (I-07)
- Performance/Marge-Analyse (I-09, Stationskette gebrochen)
- Kundengedächtnis mit Tabs (I-11)

**Teilweise / Reife unklar:**
- „Nur unsichere Angaben prüfen" (I-05) — Konfidenz da, Review-Gate unvollständig
- Routebasierte erste Karte (I-06) — durch Stationsdivergenz blockiert
- Spracherfassung Michael (I-13)
- Rollenspezifische Zugänge (I-16)

**Verloren / aufgeschoben (Aufmerksamkeit nötig):**
- Begrüßung mit echtem Namen — Platzhalter „Aktueller Nutzer" (I-02) — kleiner Fix, große Twin-Wirkung
- Wake-/Morgen-Screen (I-03)
- Automatische Kundenkommunikation (I-10) — email/send existiert nur ungeschützt
- Realistische Terminzusage (I-14) — **Michaels Kernrisiko, unadressiert**
- Gamification/Wochenbilanz (I-12)
- Nachfolge-Beweisfunktion (I-15)

**Wichtig:** Die Ideen sind **dokumentiert und nicht verloren** — sie liegen als 4.385 Zeilen vor und sind jetzt im `IDEA_REGISTER` verankert. Das eigentliche Risiko war nicht Ideenverlust, sondern dass sie **ohne Register** nicht nachverfolgt wurden. Das ist mit diesem Audit behoben.

---

## Teil C — USP-Abgleich

Der Leit-USP „**Vom Handgriff zur sicheren Unternehmensentscheidung**" steht und fällt mit dem Wirkmechanismus:
`Erfassung → vernetzte Live-Daten → Auswertung → Empfehlung → Entscheidung`.
**Genau das mittlere Glied „vernetzte Live-Daten" ist heute gebrochen** (Cluster A/B/C). Der USP ist also nicht falsch — er ist nur noch nicht eingelöst. Die Sanierung stellt exakt die Kette her, auf der der USP beruht. Die USP-Doku bleibt gültiges Kernbriefing.
