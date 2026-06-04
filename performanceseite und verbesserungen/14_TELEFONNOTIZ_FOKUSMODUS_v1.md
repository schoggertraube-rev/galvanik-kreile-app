# 14_TELEFONNOTIZ_FOKUSMODUS_v1.md

**Projekt:** Galvanik Kreile · WerkstattCockpit
**Modul:** Telefonnotiz als Vollbild-Fokus-Funktion
**Status:** Aktiv · finale Spec · ergänzt `12_KOMMUNIKATIONSZENTRALE_v2.md` und `13_VERNETZUNG_KEINE_SACKGASSE_v1.md`
**Begleitdokument:** `kreile_telefonnotiz_fokus_final.html`

---

## 0. Einordnung

Die Telefonnotiz war in v2 ein Modal innerhalb der Komm-Zentrale. Sie wird jetzt zur **eigenständigen Vollbild-Fokus-Funktion**, die von mehreren Stellen aufrufbar ist und sich über alle Bildschirmgrößen erstreckt. Grund: Wer telefoniert, braucht den ganzen Schirm und alle Infos an einem Ort — keine Ablenkung durch die übrige App.

Zwei harte Bedingungen des Auftraggebers sind eingearbeitet:

1. **Schriftliche Eingabe ist gleichwertig zur Sprache.** Im Betrieb stehen alte Siemens-Festnetzgeräte ohne Freisprechen — Tippen muss vollwertig funktionieren, nicht nur als Fallback.
2. **Nahtlose Integration in die bestehende App.** Gleiche Design-Tokens, Schriften und Komponenten wie die Komm-Zentrale v2. Kein Fremdkörper.

---

## 1. Ziel

Eine eingehende telefonische Information in unter 30 Sekunden vollständig erfassen, strukturieren und sauber in alle betroffenen App-Bereiche verteilen — per Tippen oder Sprache, auf Smartphone, Tablet oder Desktop, ohne dass etwas in einer „Ablage" versandet.

---

## 2. Einstiegspunkte (App-Integration)

| Einstieg | Route | Kontext-Mitgabe |
|---|---|---|
| Home → Shortcut „Telefongespräch aufnehmen" | `/telefonnotiz?source=home` | keiner |
| Warendurchlauf → Auftragskarte „Telefonat zu Auftrag" | `/telefonnotiz?source=warendurchlauf&order={id}` | Auftrag vorbelegt |
| Komm-Zentrale → Button „Anruf annehmen" | `/telefonnotiz?source=kommunikation` | keiner |
| Globaler Hotkey `T` (Tablet/Desktop) | `/telefonnotiz?source=hotkey` | keiner |
| Kundenakte → „Anruf notieren" | `/telefonnotiz?source=kunde&customer={id}` | Kunde vorbelegt |

Bei mitgegebenem `order` oder `customer` ist der Live-Kontext rechts sofort befüllt, bevor der erste Buchstabe getippt wird.

---

## 3. Vollbild-Fokus-Prinzip

### 3.1 Verhalten

- Beim Öffnen legt sich die Funktion als **Fokus-Layer** über die App (z-index über Sidebar und Werkstattfluss-Bar).
- Normale Navigation ist während des Fokus-Modus ausgeblendet — bewusst, um Ablenkung am Telefon zu vermeiden.
- Layout passt sich an den Viewport an (§7).
- Verlassen nur über „Beenden" mit Anti-Sackgasse-Check (§6).

### 3.2 Warum kein normales Modal

Ein Modal suggeriert „nebenbei". Die Telefonnotiz ist aber in dem Moment die Haupttätigkeit. Vollbild signalisiert: jetzt zählt nur dieser eine Vorgang, und er wird zu Ende gebracht.

---

## 4. Die zwei Eingabe-Modi (gleichwertig)

### 4.1 Tippen (Default)

- Großes Freitextfeld mit **Live-Highlighting**: erkannte Entitäten werden beim Tippen farbig markiert (Kunde blau, Auftrag violett, Material gelb, Thema grün, Zeit orange).
- Default-Modus, weil Festnetz ohne Freisprechen üblich ist.
- Auto-Save alle 2 Sekunden in `phone_note_drafts`.
- Technik: transparente Textarea über farbig gerendertem Backdrop-Layer (Mirror-Technik, bereits im Mockup umgesetzt).

### 4.2 Sprechen

- Großer Aufnahme-Button, Web Speech API (Chromium-PWA).
- Live-Transkription erscheint im Feld.
- Das Transkript wird in dasselbe Freitext-Feld gespiegelt — beide Modi münden in **eine** Textquelle, die ausgewertet wird.
- Fallback: schlägt Web Speech fehl (Browser/Mikro), automatisch Hinweis „Bitte tippen".

### 4.3 Gemeinsamer Pfad

Egal ob getippt oder gesprochen: Der Freitext landet in einem Feld → „Auswerten" startet dieselbe Analyse-Pipeline (§5). Kein doppelter Code.

---

## 5. Analyse-Pipeline (wie v2/§7, hier kompakt)

```
Freitext → lokales Matching (Kunde/Auftrag/Material/Zeit per Regex+Fuzzy)
         → Gemini 1.5 Flash (mit DB-Kontext: Aufträge, Kalender, Lager, Zahlung)
         → strukturierte Felder + Konfidenzen
         → proposed_actions mit Konfliktprüfung
```

**Erkannte Felder** (alle einzeln editierbar):
Kunde · Auftrag · Thema · Material · Wunschtermin · Zahlungsart.

**Konfidenz pro Feld** wird angezeigt — der Nutzer sieht sofort, wo Prüfung nötig ist.

---

## 6. Beenden — Anti-Sackgasse-Logik

Der zentrale Mechanismus gegen „schmutzige Ecken". Beim Klick auf „Beenden" prüft die App den Zustand:

### 6.1 Zustand A — alles erledigt / nichts erfasst

Wenn kein ungespeicherter Inhalt vorliegt (Notiz wurde verteilt oder gar nichts getippt):

- Grüner Status: „Alles erledigt. Keine offenen Themen."
- Zwei Ausgänge: **Zurück zur Startseite** oder **Zur Kommunikationszentrale**.
- Sauberes Verlassen.

### 6.2 Zustand B — ungespeicherter Inhalt

Wenn Text erfasst, aber noch nicht verteilt wurde:

- Gelbe Warnung: „Dieses Thema ist noch nicht abgelegt. So lässt es sich nicht verlassen."
- **Kein einfaches Wegklicken.** Drei erzwungene Ausgänge:
  1. **Jetzt speichern & verteilen** (empfohlen) → öffnet Speichern-Dialog
  2. **Mit Erinnerung parken** → Status `parked_with_reminder`, Reminder 17:00
  3. **Notiz verwerfen** (Fehlanruf) → bewusste, explizite Entscheidung
- Erst nach einer dieser Entscheidungen schließt sich der Fokus-Modus.

### 6.3 Designprinzip

„Weiter bearbeiten" als Option existiert nur, wenn wirklich noch etwas offen ist. Ist alles erledigt, wird die Option gar nicht angeboten. Das ist die strukturelle Garantie: **Ein Thema kann den Fokus-Modus nicht ohne Ausgang verlassen.**

---

## 7. Multi-Viewport-Layout

### 7.1 Desktop / Tablet — zweispaltig

```
┌─ Fokus-Header: [K] Telefonnotiz · Schritt 1·2·3·4 · [Beenden] ─┐
├──────────────────────────────────┬──────────────────────────────┤
│ EINGABE (links, breit)           │ LIVE-KONTEXT (rechts, 300-360px)│
│  [Tippen | Sprechen]             │  Kunde                        │
│  Freitext mit Live-Highlight     │  Offene Aufträge              │
│  [Auswerten]                     │  Kalender-Strip               │
│  ↓ nach Auswerten:               │  Lager                        │
│  Erkannte Felder (2-spaltig)     │  Zahlung                      │
│  Aktions-Vorschau                │  Quick-Lookups (4)            │
│  [Speichern & verteilen]         │  Antwort-Vorschlag            │
└──────────────────────────────────┴──────────────────────────────┘
```

### 7.2 Smartphone — gestapelt

- Eingabe oben, Live-Kontext darunter (scrollbar).
- Schritt-Indikator als Dots.
- Aufnahme-Button groß (Daumen-Reichweite).
- Felder einspaltig.

### 7.3 Responsive-Regeln

- Desktop: Kontext-Spalte 360 px.
- Tablet: Kontext-Spalte 300 px, Schritt-Labels ausgeblendet (nur Nummern).
- Smartphone (< 600 px): einspaltig, Schritte als Dots.

---

## 8. Live-Kontext rechts (zum Vorlesen)

Während Eingabe (Tippen oder Sprechen) füllt sich der rechte Bereich automatisch — gedacht zum direkten Vorlesen im Gespräch.

| Sektion | Quelle | Trigger |
|---|---|---|
| Kunde | `customers` (Fuzzy) | Namens-Treffer |
| Offene Aufträge | `orders WHERE customer AND status != done` | Kunden-Erkennung; genannter Auftrag wird hervorgehoben |
| Kalender · Wunschtermin | `calendar_events` + `business_hours` + `staff_absences` | Zeit-Phrase |
| Lager | `materials.stock_level` | Material-Erkennung |
| Zahlung | `invoices` aggregiert | Kunden-Erkennung |
| Antwort-Vorschlag | Gemini | Kombination Kunde + Auftrag/Material |

**Quick-Lookups** (4 Buttons, 1-Tap-Detail): „Wo ist Ware?" · „Reklamation?" · „Wann fertig?" · „Zahlung offen?" — laden Detail-Daten aus DB ohne den Notiztext zu verändern.

---

## 9. Speichern — 3-Wege-Wahl

| Wahl | Backend | UI danach |
|---|---|---|
| **Automatisch verarbeiten** | Alle Actions mit `isFullyAutomatable()=true` sofort ausführen, Konflikt-Actions bleiben `pending_review` | Success-Screen mit Häkchen, Undo-Toast 10 Sek, zurück zum Aufrufpunkt |
| **Mit Erinnerung parken** | Status `parked_with_reminder`, Eintrag in `reminders` | Success mit Erinnerungszeit |

(Die dritte Option „in Komm-Zentrale fertig bearbeiten" aus v13/§5.2 entfällt hier bewusst — im Fokus-Modus soll der Vorgang direkt zu Ende gebracht werden. Detailbearbeitung passiert nur noch im Ausnahmefall über den Exit-Dialog Zustand B.)

**Undo:** 10 Sekunden lang sind alle ausgeführten Aktionen widerrufbar (`revert()` pro Handler).

---

## 10. Design-Tokens (identisch zur Komm-Zentrale v2)

| Token | Wert |
|---|---|
| `--cream` | `#FAF6EE` |
| `--cream-2` | `#F2EBDD` |
| `--ink` | `#1B1B1B` |
| `--orange` (Telefon-Akzent) | `#C2410C` |
| `--green-bright` | `#16A34A` |
| Highlight Kunde | blau `--blue-soft` / `--blue` |
| Highlight Material | gelb `--yellow-soft` / `--yellow` |
| Highlight Thema | grün `--green-soft` / `--green` |
| Highlight Zeit | orange `--orange-soft` / `--orange` |
| Highlight Auftrag | violett `--violet-soft` / `--violet` |

**Schriften:** Fraunces (Display + Notiztext) + Manrope (UI). Pflicht. Keine Inter/Roboto-Defaults.

---

## 11. Datenmodell

Nutzt die in v2 und v13 definierten Tabellen. Keine neuen Tabellen nötig. Relevante Felder:

- `messages` mit `channel='phone_note'`, `cleaned_text`, `automation_status`
- `message_analyses` (Entities, Konfidenzen, Vorschlag, Actions)
- `message_actions` (die Verteilungs-Aktionen)
- `phone_note_drafts` (Auto-Save)
- `reminders` (Park-Option)

Telefonnotiz ist nach Speichern **editierbar** (`messages.cleaned_text`, `updated_at`); ein Edit feuert die Aktionen nicht erneut.

---

## 12. Bauplan (3 Phasen)

### Phase A — Fokus-Shell + Tippen-Modus (1,5 Tage)

- Route `/telefonnotiz` mit Vollbild-Fokus-Layer (überlagert Nav)
- Header mit Schritt-Indikator + Beenden
- Mode-Toggle Tippen/Sprechen (Tippen default)
- Freitext mit Live-Highlighting (Mirror-Technik aus Mockup)
- Auto-Save in `phone_note_drafts`
- Multi-Viewport-Layout (Desktop/Tablet/Mobile)
- Einstiegspunkte verlinken (Home, Warendurchlauf, Komm-Zentrale, Hotkey, Kundenakte)

**Akzeptanz:**
- Funktion öffnet als Vollbild, Nav ausgeblendet
- Tippen markiert Entitäten live in < 200 ms
- Layout korrekt in allen drei Viewports
- Auto-Save funktioniert; Reload bietet Entwurf an
- Aufruf mit `?order=…` füllt Kontext sofort

### Phase B — Sprechen + Live-Kontext + Auswerten (2 Tage)

- Web Speech API Integration (Fallback Tippen)
- Live-Kontext rechts (5 Sektionen) gefüllt aus DB beim Tippen/Sprechen
- Quick-Lookups (4) mit Detail-Sheets
- „Auswerten" → Gemini-Pipeline → Felder + Konfidenzen + Aktions-Vorschau
- Felder einzeln editierbar

**Akzeptanz:**
- Sprechen transkribiert live; Transkript spiegelt in Freitext
- Live-Kontext zeigt korrekte Kundendaten, hebt genannten Auftrag hervor
- Wunschtermin „morgen" → grün im Kalender wenn frei, rot wenn blockiert
- Quick-Lookups laden echte DB-Daten
- „Auswerten" liefert ≥ 4 befüllte Felder mit Konfidenz

### Phase C — Speichern, Verteilen, Exit-Logik (1,5 Tage)

- Speichern-Dialog mit 2 Wegen (Auto / Parken)
- Action-Executor wendet Aktionen an (Kalender, Auftrag, Kundenkarte) — atomar
- Undo-Toast 10 Sek mit Revert
- Exit-Dialog mit Anti-Sackgasse-Check (Zustand A clean / Zustand B erzwungen)
- Success-Screen

**Akzeptanz:**
- „Auto verarbeiten" erzeugt Kalendereintrag + Auftrags-Update + Customer-Note, atomar
- Undo macht alles rückgängig
- Beenden mit ungespeichertem Inhalt → Warnung, kein Wegklicken möglich
- Beenden ohne offenen Inhalt → saubere Wahl Zurück/Komm-Zentrale
- Parken erzeugt Reminder, der pünktlich feuert

---

## 13. Akzeptanzkriterien Gesamt

- [ ] Tippen und Sprechen sind funktional gleichwertig, münden in eine Textquelle
- [ ] Tippen ist Default-Modus (Festnetz-Realität)
- [ ] Live-Highlighting markiert Kunde/Auftrag/Material/Thema/Zeit beim Tippen
- [ ] Funktion läuft sauber auf Smartphone, Tablet und Desktop
- [ ] Vollbild-Fokus überlagert die normale Navigation
- [ ] Live-Kontext rechts ist zum Vorlesen befüllt während der Eingabe
- [ ] „Auswerten" strukturiert in editierbare Felder mit Konfidenz
- [ ] Aktions-Vorschau zeigt vorab, was verteilt wird (auto / prüfen)
- [ ] Speichern verteilt in Kalender, Auftrag, Kundenkarte (+ Buchhaltung/Qualität bei Bedarf)
- [ ] Beenden erzwingt einen Ausgang bei ungespeichertem Inhalt (keine Sackgasse)
- [ ] Beenden ist sauber bei erledigtem Zustand
- [ ] Undo widerruft alle Aktionen 10 Sek lang
- [ ] Design-Tokens und Schriften identisch zur Komm-Zentrale
- [ ] Einstieg aus Home/Warendurchlauf/Komm-Zentrale/Hotkey/Kundenakte funktioniert

---

## 14. Risiken & Prüfungen

| Risiko | Mitigation |
|---|---|
| Web Speech API in der PWA nicht verfügbar | Tippen ist vollwertig — Sprechen ist Bonus, kein Muss |
| Vollbild-Fokus blockiert dringende andere Aufgaben | Beenden ist jederzeit erreichbar; bei sauberem Zustand 1 Klick zurück |
| Live-Kontext lädt langsam → Stocken im Gespräch | Lokaler Cache der Kunden/Aufträge der letzten 30 Tage, Server-Fallback parallel |
| Mirror-Technik (Highlight) verschiebt sich bei Scroll | Backdrop-Scroll an Textarea koppeln (im Mockup gelöst) |
| Exit-Zustand-B nervt bei jedem Fehlklick | „Verwerfen" ist klar und schnell erreichbar |
| Gemini-Kosten | Cap 10 Calls/Notiz, Mindesttext, Debounce 600 ms (aus v2) |

---

## 15. STOPP-Bedingungen (additiv)

- Fokus-Layer würde bestehende Sidebar/Werkstattfluss-Komponenten verändern statt nur überlagern → STOPP
- Action-Executor schreibt in nicht freigegebene Tabellen → STOPP
- `revert()` für eine Aktion nicht umsetzbar → Aktion klar als „nicht widerrufbar" kennzeichnen, nicht verschweigen

---

## 16. Nächster konkreter Schritt

**Antigravity-Prompt (PowerShell):**

```
Lies AGENTS.md, /specs/12_KOMMUNIKATIONSZENTRALE_v2.md,
/specs/13_VERNETZUNG_KEINE_SACKGASSE_v1.md, /specs/14_TELEFONNOTIZ_FOKUSMODUS_v1.md.
Visuelle Referenz: kreile_telefonnotiz_fokus_final.html

Erste Aufgabe: Diagnose-Pass — nur Lesen.
Prüfe:
- Routing-Struktur (kann ein Vollbild-Fokus-Layer über Sidebar/Werkstattfluss gelegt werden?)
- existierende Calendar/Invoice/Customer-Module für Action-Executor
- Web Speech API im PWA-Setup nutzbar?
- pg_cron für Reminder verfügbar?

Berichte Konfliktrisiken. Erst nach Freigabe Phase A starten.
```

---

**Bestätigung offen (aus v13):**
- Reminder-Standard 17:00, Empfänger = Notiz-Ersteller → wird so gebaut, falls kein Veto
- Gemini-API-Key vorhanden? (Phase B)

---

**Ende v1.**
