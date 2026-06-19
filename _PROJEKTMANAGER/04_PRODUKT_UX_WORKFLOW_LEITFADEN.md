# 04 — PRODUKT- UND NUTZERERLEBNIS-LEITFADEN
## Kreile WerkstattCockpit

---

## 1. Personas

### Persona A — Franz Kreile (Inhaber, Mitte 60)
Papierbasierte Arbeitsweise, geringe Technikaffinität, chaotische Tagesabläufe, hohe Kundenbindung über Jahrzehnte, wenig Geduld mit Fehlversuchen. Vertraut der App nur, wenn sie beim ersten ehrlichen Test nicht lügt.

**Wichtigste Frage:** „Wann ist der Auftrag für [Kunde] fertig? Wo liegt das Teil?"

### Persona B — Sohn/Nachfolger
Technikoffener als Vater, aber ohne BWL-Hintergrund. Bricht Nutzung ab, wenn Fachbegriffe unerklärt bleiben oder die Oberfläche wie eine unfertige Demo wirkt.

**Wichtigste Frage:** „Was muss ich heute tun, damit der Betrieb besser läuft?"

### Persona C — Büro-Mitarbeiter
Beantwortet Kundenanrufe in Echtzeit. Braucht Suche und Status in unter 10 Sekunden.

### Persona D — Werkstatt-Mitarbeiter (Schleiferei/Galvanik)
Arbeitet primär am Tablet in der Halle (Touch, keine Maus). Braucht große Touch-Targets, keine Hover-Interaktionen.

---

## 2. Hauptaufgaben je Rolle

| Rolle | Hauptaufgaben |
|---|---|
| Admin/Chef | Vollzugriff, Preise, Berichte, Benutzerverwaltung |
| Büro | Kunden, Aufträge, KV, Mails, Versand |
| Wareneingang | Kunde suchen/anlegen, Teile fotografieren, Lagerort zuweisen |
| Schleiferei/Galvanik | Warteschlange, Prozessstatus, Fotos ergänzen |
| Versand | Fertig melden, Versand vorbereiten |
| Lesemodus | Nur Ansicht |

---

## 3. Nutzerreisen (Soll-Zustand nach Fixes)

### Reise 1 — Inhaber, Morgenstart

| Schritt | Soll-Ablauf |
|---|---|
| 1 | `/start` öffnen → Wetter + PIN-Pad |
| 2 | PIN eingeben → Redirect zu Home mit gültiger Session |
| 3 | Startseite zeigt sofort: Tages-Fokus-Block „Heute: X kritische Aufträge · Y fertig zur Abholung (Z €) · W offene Rechnungen" — alle Werte echt, klickbar (VS-03) |
| 4 | Klick auf kritischen Auftrag → Detail mit Status, Standort, Kontakthistorie |
| 5 | Falls Session abgelaufen: sofortiger Redirect zu `/start` mit Hinweis „Sitzung abgelaufen — bitte erneut einloggen" statt leerer Liste (F-003/VS-01) |

### Reise 2 — Büro, Kundenanruf

| Schritt | Soll-Ablauf |
|---|---|
| 1 | Kunde fragt nach Auftragsstatus |
| 2 | GlobalSearch (⌘K am Desktop, Such-Icon-Button am Tablet/Touch) → Name eingeben |
| 3 | Kunde erscheint sofort (Tenant-Filter korrekt, Auth gültig) |
| 4 | CustomerOverlay öffnet: alle Aufträge, Status, Standort, Zahlungen, Kommunikationshistorie auf einen Blick |
| 5 | Auskunft in unter 10 Sekunden möglich |

### Reise 3 — Werkstatt-Mitarbeiter, Tablet in der Halle

| Schritt | Soll-Ablauf |
|---|---|
| 1 | Stationsseite öffnen (z. B. `/station/beschichtung`) — Touch-Navigation funktioniert ohne Hover |
| 2 | Klartext-Stationsname „Galvanik — Aufträge in Bearbeitung" statt technischem String |
| 3 | Priorisierte Liste (Rot/Gelb zuerst) |
| 4 | 1-Klick-Statuswechsel direkt aus Auftragskarte (VS-08), kein Mehrklick-Umweg |
| 5 | Bei 0 Aufträgen: „Noch keine Aufträge an dieser Station" + CTA „Neuen Auftrag erfassen" statt leerer Stille |

### Reise 4 — Chef/Nachfolger, Montagmorgen-Überblick

| Schritt | Soll-Ablauf |
|---|---|
| 1 | Cockpit öffnen (nur Inhaber-/Nachfolger-Rolle) |
| 2 | Header zeigt Vorwoche-Vergleich: „Termintreue: 78 % → 86 % ↑" (VS-07) |
| 3 | Klartext-Kachel-Labels: „Forecast" → „Erwarteter Umsatz", „Aging" → „Offene Rechnungen — wie alt?" (VS-04) |
| 4 | Jede Kennzahl mit Handlungsbutton, z. B. „3 anrufen" bei überfälligen Forderungen |
| 5 | Keine sichtbare `PlaceholderKachel` — entweder gebaut oder ausgeblendet |

---

## 4. Seitenstruktur (Soll, bereinigt)

| Bereich | Status | Maßnahme |
|---|---|---|
| `/start` (PIN-Login) | Gut | Behalten |
| `/` (Home) | Fake-Daten | Tages-Fokus-Block, echte Zähler, Demo-Blöcke entfernt |
| `/warendurchlauf` | KPI-Kacheln richtig strukturiert | Echte Daten, Leer-State statt 0-ohne-Erklärung |
| `/warendurchlauf/eingang` (vormals `/neu`) | Redirect-Konflikt | Klare Trennung: `/warendurchlauf` = Hallenübersicht, `/warendurchlauf/eingang` = Erfassung |
| `/station/[slug]` | Technischer Text | Klartext-Labels je Station, alle 5 Stationen erreichbar |
| `/orders`, `/customers` | Auth-leer | Nach F-003/F-004 funktional |
| `/scan` | False-Success | Nach M-01 echte DB-Bestätigung |
| `/cockpit` | Fachjargon | Plain-Language-Labels, Vorwoche-Vergleich |
| `/kalender` | Mock-Daten | Echte Telefonnotiz-Kopplung (VS-09) |
| `/kvp`, `/betrieb-kvp` | Dubliert | Konsolidieren auf `/betrieb-kvp` (Entscheidung E-05) |
| `/kontrolle` | Mock, kein Schema | Entscheidung E-02: vorerst aus Primärnavigation |
| `/print-queue`, `/status`, `/today`, `/archive` | Mock-Repository | Migration auf `getOrdersDb()` |

---

## 5. Responsive-Anforderungen

| Gerät | Pflichtverhalten |
|---|---|
| Desktop (>1280px) | Hover-Sidebar-Expansion akzeptabel |
| **Tablet quer (1024px) — primäres Werkstattgerät** | Touch-Toggle oder permanent expandierte Labels ab `md:`-Breakpoint. Kein reines Hover. |
| Tablet hochkant (768px) | MobileNav/BottomNav konsistent, verifiziert |
| Smartphone (375px) | Einspaltig, Sticky-CTA in Daumenzone, verifiziert |

**Kritischster Fehler laut UX-Audit:** Der primäre Betriebsmodus (Tablet quer, Werkstatt-Mitarbeiter) nutzt exakt die Navigation, die auf Touch nicht funktioniert. Das ist P1 in Phase 1.

---

## 6. Leer-/Lade-/Fehlerzustände (Pflicht für jede Datenseite)

```
loading:        Skeleton — nur bei tatsächlicher Ladezeit
empty-auth:     "Bitte einloggen, um Daten zu sehen" + Redirect-CTA
empty-data:     "Noch keine [X] vorhanden – [Aktion starten]"
error:          "Daten konnten nicht geladen werden – [Erneut versuchen]"
data:           echte Inhalte
```

Diese vier Zustände sind für jede der folgenden Seiten verpflichtend nachzuweisen: `orders`, `customers`, `station/[slug]`, `warendurchlauf`, Cockpit-Kacheln.

---

## 7. Design-Tokens (verbindlich, Quelle der Wahrheit: `ci-tokens.css`)

| Verwendung | Token | Wert |
|---|---|---|
| Primär-Button/Haupt-CTA | `--ci-accent` | Magenta `#C2185B` |
| Warnung/Urgency-Soon | `--accent-orange` | `#E86A33` |
| Kritisch/Gefahr | `--ci-danger` | `#B0413E` |
| Erfolg | `--ci-success` | `#4F8F58` |
| Neutraler Text/Fläche | `--navy-900` / `--ci-ink` | `#1A1F2E` |
| Hintergrund | `--bg-app` / `--ci-bg` | `#F1E9DC` |
| Zahlen/Beträge | `font-serif` | Fraunces |
| UI-Text | `font-sans` | Inter |
| Markengradient | `--gradient-brand` | `linear-gradient(115deg,#7A3FB0,#C2185B 38%,#F2643C 72%,#F6A93B)` |

OrderWideCard.tsx ist sofort auf diese Tokens zu migrieren (8 hartkodierte Hex-Werte aktuell, JetBrains Mono statt Fraunces).

---

## 8. Barrierefreiheit — Sofortmaßnahmen

| Befund | Maßnahme |
|---|---|
| Statusfarben nur über Farbe (Rot/Grün) | Icon + Farbe + Text kombinieren |
| Icons ohne `aria-label` im kollabierten Navigationszustand | `aria-label={label}` ergänzen |
| GlobalSearch ohne Fokus-Trap | Fokus-Trap implementieren |
| Touch-Targets <44px in Sub-Menüs | `min-h-[44px]` sicherstellen |

---

## 9. Wow-Momente (konkret, nicht dekorativ)

Gemäß Charter (Dok. 00, Abschnitt 7) entsteht der Wow-Effekt nicht durch Dekoration, sondern durch:

1. Kundenfrage „Wann fertig?" wird in unter 10 Sekunden mit belastbarer Antwort beantwortet.
2. „Fertig zur Abholung — Wert X €" als sofort sichtbarer, klickbarer Block.
3. Vorwoche-Vergleich macht Verbesserung sichtbar, ohne dass der Nutzer rechnen muss.
4. Drag-to-Advance auf der Auftragskarte (bereits gute Interaktion, muss nur mit echten Daten funktionieren).
5. KI-Wochenbericht („Was lief gut? Was nicht? 3 Maßnahmen.") — Phase 6.
6. Kalkulationsmodul gibt in Sekunden einen belastbaren Preisvorschlag statt Bauchgefühl — direkter Umsatzhebel (Phase 4).

---

## 10. Akzeptanzkriterien UX-Abschluss

- Desktop, Tablet quer, Smartphone hochkant alle verifiziert (nicht nur Desktop wie heute).
- Alle vier Datenzustände (Loading/Empty/Error/Data) auf allen Hauptseiten nachgewiesen.
- Keine Mockdaten im Produktionspfad sichtbar.
- CI-Tokens durchgängig, keine Inline-Hex-Werte.
- Inhaber-Simulation und Nachfolger-Simulation (Dok. 09) bestehen mit allen 12 DoD-Kriterien.

---

*Dieser Leitfaden konkretisiert das „Kinderleichte Bedienung"-Ziel aus dem Charter (Dok. 00) in nachprüfbare Nutzerreisen.*
