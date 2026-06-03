# Antigravity-Bauplan — Performance-Cockpit & offene Module
Kreile WerkstattCockpit · Stand 2026-06-01

Referenz: `01_PERFORMANCE_COCKPIT_SPEC.md` (Abschnitte werden in den Prompts zitiert).

---

## TEIL A — ANTI-DRIFT-REGELN (gelten für JEDEN Lauf)

Diese Regeln zuerst in Antigravity einfügen ODER an jeden Prompt voranstellen. Sie adressieren das bisherige Problem: Antigravity hat geplant, berichtet und um Erlaubnis gefragt — aber nicht gecodet.

```text
ANTI-DRIFT-REGELN (verbindlich für diesen und jeden folgenden Lauf):

1. DIES IST EINE SCHREIBAUFGABE. Du MUSST in diesem Lauf echte Dateien
   erstellen/ändern. Ein Lauf ohne Dateiänderung gilt als GESCHEITERT.
2. VERBOTEN: Planungs-, Task- oder Konzeptdateien anlegen
   (implementation_plan.md, task.md, *.plan, PLAN.md o.ä.).
3. VERBOTEN: um Erlaubnis oder Bestätigung fragen. Arbeite ALLE Schritte
   des Pakets in EINEM Durchlauf ab, ohne zwischendurch zu stoppen.
4. VERBOTEN: nur analysieren/berichten ohne Code zu schreiben.
5. Discovery (Dateien lesen, grep) ist erlaubt — aber danach SOFORT Code
   schreiben. Nicht nach der Discovery anhalten.
6. PFLICHT am Ende jedes Laufs:
   a) npm run build ausführen und Ergebnis nennen,
   b) Liste ALLER geänderten/neuen Dateien,
   c) Kurzbericht: erledigt / nicht erledigt / warum.
7. KEINE Git-Operationen (kein commit/push/checkout/reset) außer ausdrücklich erlaubt.
8. Migrationen NICHT remote ausführen — am Ende als To-do melden
   (Supabase: login → link → db push → NOTIFY pgrst 'reload schema' → verifizieren).
9. Keine destruktiven Befehle. Keine Secrets/.env-Inhalte ausgeben.
10. KEIN neues "any" im TypeScript. Bestehende Funktionen nicht kürzen/„vereinfachen".

Bestätige NICHT mit Text, dass du die Regeln verstanden hast — fang direkt
mit der Umsetzung an.
```

---

## TEIL B — REIHENFOLGE DER PAKETE

| # | Paket | Spec-Abschnitt | DB? | Priorität |
|---|---|---|---|---|
| WP-1 | Theme-System reparieren + Graph-Styling | §3, §4 | nein | sofort |
| WP-2 | IA verschlanken + Suchleiste + „Was fehlt?"-Feld | §5, §6, §9 | ja (feedback_notes) | hoch |
| WP-3 | Bäder-Seite + Metall-Marge + Live-Preise | §7, §11 | ja | hoch |
| WP-4 | Zahlungs-/Regionen-Analytik + Karte | §8, §11 | ja | mittel |
| WP-5 | Detail-Overlays für alle Kacheln | §5.3 | nein | mittel |
| WP-6 | Home „Heute zuerst" (Tagesguideline) | Backlog | evtl. | mittel |
| WP-7 | Marketing-Modul (Story/Beitrag-Timing + Planung) | Backlog | ja | niedrig |
| WP-8 | Buchhaltung/Steuerberater-Modul (DATEV/BWA/EÜR) | Backlog | ja | niedrig |

Ein Paket pro Lauf. Nach jedem grünen Build + Sichtprüfung selbst committen, dann nächstes Paket.

---

## TEIL C — PROMPTS

> Jeder Prompt enthält oben den Verweis auf die Anti-Drift-Regeln. Wenn du sie schon global eingefügt hast, reicht der Verweis.

### WP-1 — Theme-System + Graph-Styling

```text
[ANTI-DRIFT-REGELN gelten — siehe oben. Schreibe Code, kein Plan, keine Rückfrage.]
Kreile WerkstattCockpit — Theme-System reparieren und Graph-Styling aufwerten.
Lies zuerst 01_PERFORMANCE_COCKPIT_SPEC.md §3 und §4.

SCHRITT 1 — Theme-Tokens vereinheitlichen:
- Stelle sicher, dass es zwei vollständige Token-Sets gibt (theme-dark, theme-light)
  mit ALLEN Farb-Tokens (bg, surface, surface-2, ink, ink-2, ink-3, border,
  pos, neg, warn, info, accent, accent-2, glass).
- Ersetze auf der Performance-Seite und ihren Komponenten JEDES hartkodierte
  Hex/rgb durch das passende Token. Suche projektweit nach hartkodierten Farben
  in performance-bezogenen Dateien und ersetze sie.

SCHRITT 2 — Hell-Theme Kontrast-Audit (KRITISCH):
- Prüfe JEDES Textelement der Performance-Seite im Hell-Theme gegen seinen
  Hintergrund. Sekundär-/Tertiärtext darf NICHT im Cream verschwinden.
- Korrigiere die Hell-Tokens so, dass: Primärtext ≥7:1, Sekundär ≥4.5:1,
  Tertiär/Hints ≥3:1, Icons/Borders ≥3:1.
- Gib am Ende eine Liste der korrigierten Tokens/Stellen aus.

SCHRITT 3 — Theme-Umschalter:
- Umschalter Dark/Hell sichtbar; Auswahl wird in localStorage UND (falls
  User-Settings existieren) in Supabase gespeichert, damit sie geräteübergreifend gilt.

SCHRITT 4 — Graph-Styling (Recharts/Chart.js, was im Projekt genutzt wird):
- Linien-/Flächencharts bekommen Gradient-Fill unter der Linie (Akzent→transparent).
- Balken abgerundet. Dezente Grid-Linien (rgba), dezente Achsen.
- Farbsemantik: Ist=Akzentverlauf, Vorjahr=neutral gestrichelt, Forecast=Amber gestrichelt.
- Gradients müssen in Dark UND Hell lesbar sein (Deckkraft je Theme).

PFLICHT-ABSCHLUSS: npm run build, Dateiliste, Kurzbericht. Kein Commit.
AKZEPTANZ: Beide Themes vollständig lesbar; Graphen mit Verläufen statt Excel-Optik.
```

### WP-2 — IA verschlanken + Suchleiste + „Was fehlt?"

```text
[ANTI-DRIFT-REGELN gelten. Schreibe Code, kein Plan, keine Rückfrage.]
Kreile WerkstattCockpit — Übersicht verschlanken, Suchleiste, Feedback-Feld.
Lies 01_PERFORMANCE_COCKPIT_SPEC.md §5, §6, §9.

SCHRITT 1 — Hotzone verschlanken:
- Performance-Übersicht zeigt prägnant: Score-Ring + 4 KPI (Termintreue,
  Ø Durchlaufzeit, Umsatz vs. Vorjahr, Deckungsbeitrag) + Metall-Marge-Hero.
- Ausführliche Inhalte NICHT auf der Übersicht — sie wandern in Detail-Overlays
  (jede Kachel onClick öffnet Overlay; nutze die bestehende DetailOverlay-Komponente,
  falls vorhanden, sonst minimal anlegen).
- KPI-Titel als Frage. Jede Karte: Wert, Vergleich, Sparkline.

SCHRITT 2 — Suchleiste oben (Phase 1, clientseitig):
- Freitextfeld im Header der Performance-Seite.
- Baue einen clientseitigen Index über die sichtbaren Kennzahlen + Entitäten
  (Reklamation, Stationen, Margen, Zahlungsmoral, Kundennamen, Auftragsnummern …).
- Eingabe filtert/hebt passende Kacheln hervor und bietet Sprung-Links in andere
  App-Bereiche (Auftrag/Kunde/Bad/Lager/Station). Treffer öffnet Overlay oder navigiert.

SCHRITT 3 — „Was fehlt?"-Feedback (app-weit):
- Migration supabase/migrations/00XX_feedback_notes.sql (additiv, idempotent):
  create table if not exists feedback_notes (
    id uuid primary key default gen_random_uuid(),
    tenant_id text default 'galvanik-kreile',
    route text, page_title text, note text, user_id text,
    created_at timestamptz default now());
  create index if not exists feedback_notes_created_idx on feedback_notes(created_at desc);
- schema.ts ergänzen.
- Gemeinsame Komponente FeedbackFooter: Frage „Was fehlt?" + Eingabefeld + Senden,
  speichert in feedback_notes mit aktueller route + Seitentitel. Erfolgs-Toast.
- FeedbackFooter unten in das gemeinsame Seiten-Layout einhängen, damit es auf
  JEDER Seite erscheint.

PFLICHT-ABSCHLUSS: npm run build, Dateiliste, Kurzbericht, Migration-To-do.
AKZEPTANZ: schlanke Übersicht, funktionierende Suche, Feedback-Feld auf jeder Seite.
```

### WP-3 — Bäder-Seite + Metall-Marge + Live-Preise

```text
[ANTI-DRIFT-REGELN gelten. Schreibe Code, kein Plan, keine Rückfrage.]
Kreile WerkstattCockpit — Bäder-Anlage, Metall-Margen-Rechnung, Live-Preise.
Lies 01_PERFORMANCE_COCKPIT_SPEC.md §7 und §11.

SCHRITT 1 — Migration (additiv, idempotent), Tabellen aus §11:
metals, baths, deposition_logs, metal_prices (+ Indizes). schema.ts ergänzen.
Metall-Stammdaten (Gold/Silber/Kupfer/Nickel/Rhodium mit Dichten) als Seed.

SCHRITT 2 — Bäder-Seite (detaillierte Anlage):
- Bäder auflisten + neues Bad anlegen/bearbeiten mit allen Feldern aus §7.1
  (Metallgehalt, Volumen, Einkaufspreis, Kaufdatum, Standzeit, Dichte vorbelegt,
  Stromausbeute, Drag-out, Sollwerte pH/Temp/Konz, Status).
- Detailansicht im Vollbild-Overlay (DetailOverlay).

SCHRITT 3 — Margen-Berechnung (DB-View oder Server-Funktion):
- Masse = Fläche × (Schichtdicke×0,0001) × Dichte.
- Einsatz = Masse × Einkaufsbasis. Erlös = Masse × Tagespreis.
- Marge = (Erlös − Einsatz) × Stromausbeute − Drag-out.
- Aggregation pro Metall/Bad/Auftrag/Zeitraum.

SCHRITT 4 — Einkauf Gewinn/Verlust (§7.3):
- Karte/Ansicht „Lohnt sich der Metalleinkauf?": investierter Einkaufsbetrag vs.
  aktueller Marktwert verbliebenes Metall (Restmenge × Tagespreis) + bereits zum
  Tagespreis abgeschiedener Wert → Gesamtergebnis +/− €. Klar lesbar.

SCHRITT 5 — Live-Preise:
- Serverseitiger Abruf (Route Handler oder Edge Function) von metals.dev in EUR,
  1×/Tag, Ergebnis in metal_prices cachen (Historie behalten), „Stand HH:MM" anzeigen.
- API-Key aus ENV (NICHT ausgeben). Bei Fehler letzten Cache-Wert nutzen.
- Rhodium: kein API-Wert → manuelle Pflege; ohne Wert Rhodium-Marge ausblenden.

SCHRITT 6 — Metall-Marge-Hero auf der Übersicht:
- Hero-Karte Gesamtmarge + pro-Metall-Kacheln (datengetrieben: neue Metalle/Bäder
  erscheinen automatisch). Klick → Detail-Overlay mit Rechenweg + Tipp.

PFLICHT-ABSCHLUSS: npm run build, Dateiliste, Kurzbericht, Migration-To-do +
Hinweis auf benötigten metals.dev API-Key in ENV.
AKZEPTANZ: Bäder detailliert anlegbar; Marge live; Einkauf-Gewinn/Verlust sichtbar;
neue Bäder/Metalle integrieren sich automatisch.
```

### WP-4 — Zahlungs-/Regionen-Analytik + Karte

```text
[ANTI-DRIFT-REGELN gelten. Schreibe Code, kein Plan, keine Rückfrage.]
Kreile WerkstattCockpit — Zahlungsmoral, Zahlungsart, Abholung/Versand, Regionen-Karte.
Lies 01_PERFORMANCE_COCKPIT_SPEC.md §8 und §11.

SCHRITT 1 — Migration (additiv): payment_records + customers erweitern
(postal_code, country, country_code, lat, lng, region) + Indizes. schema.ts ergänzen.

SCHRITT 2 — Analytik-Kachel:
- Zahlungsmoral: Ø Zahlungsdauer, Anteil pünktlich/verspätet/offen, Summe offen.
- Zahlungsart-Verteilung. Abholung-vs-Versand-Anteil.
- Werte aus payment_records + Auftragsdaten berechnen.

SCHRITT 3 — Regionen-Karte:
- Kunden nach PLZ→Land→Kontinent aggregieren.
- Klickbare Karte (leichtgewichtig: Leaflet+OSM oder D3-Choropleth, KEINE schwere Abhängigkeit).
- Klick auf Region → Drill-down (Umsatz/Anzahl/CLV) im Overlay.
- Regionen aggregiert; keine personenbezogenen Einzelkoordinaten an externe Tiles.

SCHRITT 4 — Kachel + Detail-Overlay in die Performance-Seite einhängen
(erscheint automatisch im Karten-Grid).

PFLICHT-ABSCHLUSS: npm run build, Dateiliste, Kurzbericht, Migration-To-do.
AKZEPTANZ: Zahlungs-/Regionen-Kachel mit klickbarer Karte und Drill-down.
```

### WP-5 — Detail-Overlays für alle Kacheln

```text
[ANTI-DRIFT-REGELN gelten. Schreibe Code, kein Plan, keine Rückfrage.]
Kreile WerkstattCockpit — alle Performance-Kacheln auf Vollbild-Detail-Overlay umstellen.
Lies 01_PERFORMANCE_COCKPIT_SPEC.md §5.3.

- Falls DetailOverlay-Komponente fehlt: anlegen (Vollbild, unscharfer Hintergrund,
  ein Scrollcontainer, Schließen per Backdrop/X/Wisch/ESC, Body-Scroll-Lock).
- Jede Kachel (Durchsatz, Geld, Metall-Marge, Stationen, Reklamationen, Top-Kunden,
  Frühwarnungen, Zahlungs-/Regionen) öffnet beim Klick ihr Overlay mit ausführlichen
  Daten, Zeitreihen, Filtern, Verknüpfungen.
- Inhalte der Übersicht selbst bleiben prägnant.

PFLICHT-ABSCHLUSS: npm run build, Dateiliste, Kurzbericht. Kein Commit.
AKZEPTANZ: jede Kachel öffnet ein konsistentes Vollbild-Overlay mit Tiefe.
```

### WP-6 — Home „Heute zuerst" (Backlog, Kurzprompt)

```text
[ANTI-DRIFT-REGELN gelten.]
Kreile WerkstattCockpit — Home-Seite „Heute zuerst"-Tagesguideline.
- Auf der Home/Startseite eine Karte „Heute zuerst" mit priorisierter Tagesliste
  (z.B. Kundenfreigabe eintragen, Material klären, Wareneingang scannen, Foto ergänzen,
  Versand vorbereiten). Fortschritt „3/5".
- Erledigte Punkte werden abgehakt (Checkmark) und die Liste aktualisiert sich live
  (Status aus den echten Auftrags-/Workflow-Daten ableiten, nicht statisch).
- Stil edel, app-nah, Theme-Tokens. Klick auf Punkt → Sprung zur jeweiligen Aufgabe.
PFLICHT-ABSCHLUSS: build, Dateiliste, Kurzbericht.
```

### WP-7 — Marketing-Modul (Backlog, Kurzprompt)

```text
[ANTI-DRIFT-REGELN gelten.]
Kreile WerkstattCockpit — Marketing-Timing-Modul.
- Eigene Seite/Modul: schlägt optimale Zeitfenster für Instagram-Story/Beitrag vor
  (uhrzeit-/wochentagsabhängig, regelbasiert), mit konkretem Inhaltsvorschlag aus
  aktuellen Aufträgen (z.B. vergoldetes Teil vorher/nachher).
- Datenmodell für geplante Posts + Timing-Regeln. Erinnerung/Hinweis auf Home.
PFLICHT-ABSCHLUSS: build, Dateiliste, Kurzbericht, Migration-To-do.
```

### WP-8 — Buchhaltung/Steuerberater-Modul (Backlog, Kurzprompt)

```text
[ANTI-DRIFT-REGELN gelten.]
Kreile WerkstattCockpit — Finanzzentrale-Modul (Schritt zum Komplettsystem).
- DATEV-Buchungsstapel-Export im EXTF-Format: Header (EXTF;700;21;"Buchungsstapel";13;…),
  Windows-1252-Encoding, Semikolon-Trenner, Komma-Dezimal, CRLF, Festschreibung=0,
  Pflichtfelder Umsatz/Soll-Haben/Konto/Gegenkonto/Belegdatum/Buchungstext(≤60).
- Lexware/Excel-CSV-Export. BWA-Vorschau (monatlich). EÜR-/UStVA-Übersicht.
- Mit DATEV-Prüftool validierbar halten.
- Hinweistext Kostenersparnis (laufende Buchung selbst → 50–70% Steuerberater-Kosten).
PFLICHT-ABSCHLUSS: build, Dateiliste, Kurzbericht, Migration-To-do.
```

---

## TEIL D — ABSCHLUSSBERICHT (nach ALLEN Paketen anfordern)

Letzter Prompt an Antigravity:

```text
[ANTI-DRIFT-REGELN gelten — erstelle die Datei wirklich.]
Erstelle docs/ABSCHLUSSBERICHT_PERFORMANCE.md mit:
1. Tabelle: Paket (WP-1…WP-8) | Status (vollständig/teilweise/offen) |
   geänderte Dateien | Build grün (ja/nein).
2. Abschnitt „NICHT umgesetzt": was fehlt und warum.
3. Abschnitt „Offene Migrationen": welche SQL noch via Supabase db push muss.
4. Abschnitt „Bekannte Fehler/Warnungen".
5. Abschnitt „Empfohlene nächste Schritte".
Nur diese eine Datei erstellen, keine Code-Änderung, kein Commit.
```

---

## TEIL E — KONTROLLE DURCH DICH (Siglinde)

Nach jedem Lauf prüfen, ob Antigravity wirklich gecodet hat:

```powershell
git status --short      # zeigt geänderte Dateien — wenn LEER trotz "fertig"-Meldung: NICHT umgesetzt
git diff --stat         # Umfang der Änderungen
```

Wenn `git status` leer ist, obwohl Antigravity „erledigt" meldet: der Lauf war wirkungslos. Dann erneut starten mit dem Zusatz: „Der letzte Lauf hat KEINE Dateien geändert. Schreibe jetzt tatsächlich Code, beginne mit Schritt 1 und ändere die Dateien direkt."
