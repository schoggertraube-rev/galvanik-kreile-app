# 11 — Add-on: Rechte Hauptnavigation, radikales Aufräumen, Detail-Fokus-Overlay, Galvanik-Minimalansicht

## Zweck dieser Datei

Dieses Add-on **überschreibt das Navigationskonzept aus `01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md`** (linke Sidebar) und präzisiert die UI-Punkte aus `10_ADDON_...` für die bestehende **Kreile WerkstattCockpit App**.

**Kein Komplettumbau.** Datenmodell, Supabase/Drizzle, StatusEvents, OCR, Schnellannahme, Kundenkarte und localStorage/PWA-Fallback bleiben erhalten. Geändert wird die **Shell (Navigation + Detailfokus)** und die **Galvanik-Liste**.

**Konfliktauflösung zu Datei 01:** Wo Datei 01 „linke Sidebar" sagt, gilt ab jetzt „rechte vertikale Hauptnavigation". Die horizontale Werkstattfluss-Leiste oben bleibt bestehen.

---

## 1. Executive Summary

Die App ist funktional, aber die Navigation ist überladen und die Detailseiten lenken vom Fokus ab. Vier Eingriffe:

| Eingriff | Ist | Soll |
|---|---|---|
| Hauptnavigation | Bottom-Bar mit 8 Punkten + „Mehr" | Vertikale Leiste **rechts**, 6 Punkte, 2 davon groß |
| Menü-Wildwuchs | Verzug, Performance, Einstellungen, Scan einzeln verstreut | Konsolidiert in passende Untermenüs |
| Detailansichten | Komplex, ablenkend | Fokus-Overlay: alles auf einen Blick, sehen + ergänzen, Tipp daneben schließt |
| Galvanik-Liste | Zu viele Infos pro Auftrag | Nur Auftragsnr · Kunde · Zieldatum, nach Dringlichkeit |

Werkstattfluss (Wareneingang → Galvanik → Warenausgang) **bleibt horizontal oben über volle Breite**. Bei geöffnetem Detail-Overlay dimmt und deaktiviert sich die rechte Leiste.

---

## 2. Nutzerrollen

Unverändert zur bestehenden App (Büro/Annahme, Werkstatt/Station, Leitung). Dieses Add-on ändert keine Rechte, nur die Navigation und Darstellung.

---

## 3. Kernworkflows (betroffen)

1. **Navigieren:** Hauptbereich rechts wählen → Werkstattfluss oben → Arbeitsbereich mittig.
2. **Detail öffnen:** In Liste auf Eintrag tippen → Fokus-Overlay öffnet, Rest dimmt → ansehen/ergänzen → Tipp daneben oder `Esc` schließt.
3. **Galvanik abarbeiten:** Minimal-Queue nach Dringlichkeit → Tap → Entscheidung Auftrag/Kunde → Fokus-Overlay.

---

## 4. Informationsarchitektur

### 4.1 Die 6 Hauptpunkte (rechte Leiste, von oben nach unten)

| # | Punkt | Größe | Untermenü (klappt auf / Sub-Tabs) |
|---|---|---|---|
| 1 | **Home** | **groß** | Tageslage, Kritische Punkte, Schnellannahme |
| 2 | Anfragen | normal | Offene Angebotsanfragen, In Auftrag übernehmen |
| 3 | **Warendurchlauf** | **groß** | Wareneingang, Galvanik, Warenausgang, **Verzug & Engpässe** |
| 4 | Lager / Chemie | normal | Lagerbestand, Chemie/Badregelkarte, Verbrauch |
| 5 | Kontrolle & Archiv | normal | Qualitätskontrolle, Nacharbeit, Abgeschlossen, Dokumentenarchiv, Export, **Performance** |
| 6 | Kunden / Aufträge | normal | **Tab „Kunden"** · **Tab „Aufträge"** |

### 4.2 Mapping: Was wandert wohin (gnadenlos aufräumen)

| Alter Punkt | Neues Zuhause | Begründung |
|---|---|---|
| Start | → **Home** (umbenannt) | identische Funktion |
| Alle Aufträge | → Kunden/Aufträge, Tab „Aufträge" | gehört thematisch zusammen |
| Kundenkartei | → Kunden/Aufträge, Tab „Kunden" | bestehende Kundeninfos bleiben unverändert |
| Verzug & Engpässe | → Warendurchlauf, Untermenü | ist ein Fluss-/Produktionsproblem |
| Performance | → Kontrolle & Archiv, Untermenü | Controlling/Auswertung |
| Einstellungen | → **Header-Profilmenü** oben rechts | Systemverwaltung, kein Tages-Arbeitspunkt → **ANNAHME, siehe §19** |
| Scan (Bottom) | → Quick-Action (Kamera in Suchleiste + Schnellannahme) | kein eigener Top-Punkt nötig |
| „Mehr"-Sammelpunkt | entfällt komplett | Quelle der Unübersichtlichkeit |

**Regel:** Kein Punkt wird gelöscht — jeder bekommt ein eindeutiges Zuhause. Keine Funktion erscheint an zwei Stellen.

### 4.3 Shell-Layout

```text
+------------------------------------------------------------+------+
| Header: Suche · Datum/Status · Benachrichtigungen · Profil |      |
+------------------------------------------------------------+ HOME |
| Werkstattfluss (horizontal, volle Breite)                  | (GR) |
|  Wareneingang → Galvanik → Warenausgang   [Heute]          |------|
+------------------------------------------------------------| Anfr.|
|                                                            |------|
|  Arbeitsbereich                                            | WARE |
|  (Karten / Listen / Minimal-Queue)                         | DURCH|
|                                                            | (GR) |
|                                                            |------|
|                                                            | Lager|
|                                                            |------|
|                                                            | Kontr|
|                                                            |------|
|                                                            | Kund/|
|                                                            | Auftr|
+------------------------------------------------------------+------+
```

- Rechte Leiste: zwei **große** Felder (Home, Warendurchlauf, ~96–112 px hoch), vier **normale** (~72–80 px).
- Aktiver Punkt: heller Hintergrund, dezenter Schatten, Statuspunkt. Kritisch: roter Akzent unabhängig vom aktiven Zustand.
- Untermenüs: klappen **in der Leiste** auf (Accordion) oder erscheinen als Sub-Tab-Zeile im Arbeitsbereich-Header. Deaktivierte Funktionen sichtbar **ausgegraut**, nie versteckt.

---

## 5. Screenliste (neu/geändert)

| Screen | Status | Inhalt |
|---|---|---|
| App-Shell | geändert | rechte Leiste statt Bottom/Left-Nav |
| Home | geändert | Begrüßung, Tageslage, 3–4 Handlungen, Schnellannahme |
| Warendurchlauf | geändert | Fluss + Untermenü inkl. Verzug & Engpässe |
| Galvanik-Queue | neu | Minimalliste, dringlichkeitssortiert |
| Detail-Fokus-Overlay | neu | Auftrag/Kunde, ansehen + ergänzen, Backdrop-Close |
| Kunden/Aufträge | geändert | zwei Tabs, gemeinsamer Punkt |
| Profilmenü | geändert | nimmt Einstellungen auf |

---

## 6. Datenmodell

Keine neuen Pflichttabellen für die Navigation. Für die Galvanik-Minimalansicht reichen vorhandene Felder:

| Feld | Quelle | Nutzung |
|---|---|---|
| `order.number` | bestehend | Anzeige Zeile 1 |
| `customer.displayName` | bestehend | Anzeige Zeile 1 |
| `order.dueDate` | bestehend | Anzeige + Dringlichkeitssortierung |
| `order.status` / StatusEvents | bestehend | Dringlichkeitsfarbe |

**Dringlichkeit** (abgeleitet, kein neues Feld):

```ts
type Urgency = "kritisch" | "gefaehrdet" | "im_plan";

function getUrgency(dueDate: Date, now: Date): Urgency {
  const days = (dueDate.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return "kritisch";      // überfällig
  if (days <= 1) return "gefaehrdet";   // heute/morgen fällig
  return "im_plan";
}
```

Sortierung: kritisch → gefährdet → im Plan, innerhalb je nach `dueDate` aufsteigend.

---

## 7. Backend-Architektur

Keine Änderung. Navigation und Overlay sind reine Frontend-/Shell-Themen. Galvanik-Queue nutzt die vorhandene Order-Abfrage, gefiltert auf Station Galvanik.

---

## 8. Frontend-Architektur

### 8.1 Komponenten (prüfen/erstellen)

```text
src/components/layout/AppShell.tsx            (anpassen: Nav rechts)
src/components/layout/RightNav.tsx            (neu, ersetzt SidebarNav/BottomNav)
src/components/layout/RightNavItem.tsx        (neu, Variante primary|normal)
src/components/layout/TopWorkflowBar.tsx      (behalten, bleibt oben)
src/components/layout/ProfileMenu.tsx         (anpassen: Einstellungen aufnehmen)

src/components/entities/FocusOverlay.tsx      (neu: Backdrop + dim + Esc/Tap-Close)
src/components/entities/OrderFocusView.tsx    (neu: ansehen + ergänzen)
src/components/entities/CustomerFocusView.tsx (neu: bestehende Kundeninfos einbetten)
src/components/entities/EntityDecisionOverlay.tsx  (aus Datei 10, wiederverwenden)

src/components/galvanik/GalvanikQueue.tsx     (neu/anpassen: Minimalliste)
src/components/galvanik/GalvanikOrderRow.tsx  (neu: 3 Datenfelder)
```

### 8.2 Detail-Fokus-Overlay — Verhalten

| Regel | Umsetzung |
|---|---|
| Alles auf einen Blick | Eine Karte, kein Tab-Sprung für Kerninfos |
| Ansehen + ergänzen | Felder inline editierbar, Speichern ohne Seitenwechsel |
| Tipp daneben schließt | Klick auf Backdrop schließt; `Esc` schließt; ungespeicherte Eingabe → kurze Rückfrage |
| Rest dimmt | Hintergrund (inkl. rechter Leiste + Fluss) `blur(2–4px)` + Abdunkeln, nicht interaktiv |
| Konsistent | Auftrag sieht überall gleich aus, Kunde überall gleich |

```tsx
// FocusOverlay: Backdrop-Klick + Esc schließen
function FocusOverlay({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 backdrop-blur-sm bg-black/30 flex items-center justify-center"
      onClick={onClose}                         // Tipp daneben = schließen
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
```

### 8.3 Galvanik-Queue — Minimalzeile

```tsx
// Nur 3 Datenfelder sichtbar. Alles Weitere → Durchlaufetikett (§8.4).
<GalvanikOrderRow>
  {order.number} · {customer.displayName} · fällig {formatDate(order.dueDate)}
  {/* linker Statuspunkt nach Urgency, kein Fließtext-Label */}
</GalvanikOrderRow>
// Tap → EntityDecisionOverlay: „Auftrag ansehen" / „Kunde ansehen"
```

### 8.4 Durchlaufetikett — was dort steht (nicht in der Queue)

Damit die Galvanik-Liste schlank bleibt, gehören diese Daten **auf das Durchlaufetikett / QR**, nicht in die Zeile:

- Teileliste, Stückzahl, Material, Oberfläche/Bearbeitung
- Sonderhinweise, Badnummer, vorherige/nächste Station
- Annahmedatum, Bearbeiter, QR-Link zum Auftrag

> Annahme: Etikettenlayout existiert bereits oder ist in Arbeit. Falls nicht → separater Mini-Task, hier nur Datenzuordnung definiert.

---

## 9. Rollen und Rechte

Unverändert. Sichtbarkeit der Untermenüs darf später rollenabhängig ausgegraut werden (z. B. Performance/Export nur Leitung).

---

## 10. Dashboard und Analytics

Keine neue Analytics in diesem Schritt. UI-Event-Tracking aus Datei 10 (`trackUiEvent`) bleibt — die neue rechte Leiste soll dieselben Events feuern (`nav_click`, `overlay_open`, `overlay_close_backdrop`), um später zu messen, ob das Aufräumen die Klickwege verkürzt.

---

## 11. KI-Funktionen

Nicht betroffen.

---

## 12. Integrationen

Nicht betroffen.

---

## 13. Datenschutz und Sicherheit

Reine UI-Umstrukturierung, keine neuen personenbezogenen Daten. UI-Events weiterhin ohne Klartext-Namen/Freitext (Regel aus Datei 10 gilt).

---

## 14. MVP / später / optional

| Stufe | Inhalt |
|---|---|
| **MVP (jetzt)** | Rechte Leiste mit 6 Punkten, 2 groß; Menü-Mapping; Werkstattfluss bleibt oben; Detail-Fokus-Overlay mit Backdrop-Close; Galvanik-Minimalzeile + Entscheidungs-Overlay; rechte Leiste dimmt bei Overlay |
| **Später** | Untermenüs als animiertes Accordion; rollenabhängiges Ausgrauen; Etikettenlayout finalisieren |
| **Optional** | Tastatur-Navigation der rechten Leiste (Pfeiltasten), Drag-to-reorder der Punkte |

---

## 15. Akzeptanzkriterien

- Hauptnavigation steht **vertikal rechts**, Bottom-/Left-Nav entfernt.
- Genau **6 Punkte**: Home, Anfragen, Warendurchlauf, Lager/Chemie, Kontrolle & Archiv, Kunden/Aufträge.
- **Home** und **Warendurchlauf** sind sichtbar **größer** als die übrigen vier.
- Werkstattfluss bleibt **horizontal oben** über volle Breite.
- Verzug & Engpässe ist unter Warendurchlauf, Performance unter Kontrolle & Archiv, Einstellungen im Profilmenü — **kein** verstreuter „Mehr"-Punkt mehr.
- Kunden/Aufträge ist **ein** Punkt mit zwei Tabs; bestehende Kundeninfos unverändert.
- Detail öffnet als **Fokus-Overlay**: Kerninfos auf einen Blick, inline ergänzbar.
- **Tipp daneben** (Backdrop) und **Esc** schließen das Overlay; ungespeicherte Eingaben werfen Rückfrage.
- Bei offenem Overlay sind rechte Leiste und Fluss **gedimmt/unscharf und nicht klickbar**.
- Galvanik-Zeile zeigt **nur** Auftragsnr · Kunde · Zieldatum, **dringlichkeitssortiert**.
- Tap auf Galvanik-Auftrag öffnet Entscheidung **Auftrag / Kunde**.
- Keine Funktion verschwindet ohne Ersatz; keine doppelten Buttons; keine toten Punkte.

---

## 16. Testplan

| Test | Erwartung |
|---|---|
| Tablet quer/hoch | Rechte Leiste bleibt erreichbar, Touchziele ≥ 48 px, Hauptpunkte ≥ 80 px |
| Klick jeder der 6 Punkte | korrekter Bereich, aktiver Zustand sichtbar |
| Untermenü Verzug/Performance/Einstellungen | öffnet am richtigen neuen Ort |
| Overlay öffnen → Backdrop klicken | schließt |
| Overlay → `Esc` | schließt |
| Overlay → Feld ändern → Backdrop | Rückfrage erscheint |
| Galvanik 3 Aufträge versch. Fälligkeit | korrekte Sortierung kritisch→im Plan |
| Galvanik-Tap | Entscheidungs-Overlay Auftrag/Kunde |
| Suche nach toten Bottom-Nav-Resten | keine Reste, kein doppelter Einstieg |

---

## 17. Antigravity-Build-Prompt

Siehe separater Prompt (Datei `11_PROMPT_ANTIGRAVITY.md`).

---

## 18. Go-Live-Checkliste

1. `git status` prüfen, sauberer Commit vor Start.
2. Branch `feature/right-nav-focus` anlegen.
3. Schritte 1–5 aus dem Prompt einzeln umsetzen, je Schritt ein Commit.
4. Akzeptanzkriterien §15 manuell durchklicken (Tablet + Desktop).
5. Alte Bottom-/Left-Nav-Komponenten erst entfernen, wenn rechte Leiste vollständig funktioniert (kein Doppelzustand committen).
6. Merge nach Bestätigung durch Nutzer.

---

## 19. Offene Fragen / Annahmen

**Annahmen (selbst getroffen, nicht blockierend):**
- Einstellungen wandern ins Header-Profilmenü oben rechts. *Falls du sie lieber als 7. Leistenpunkt oder unter Kontrolle & Archiv willst — kurz sagen.*
- Durchlaufetikett-Layout existiert; hier nur Datenzuordnung. Falls nicht vorhanden → eigener Folge-Task.
- Untermenüs starten als einfaches Accordion/Sub-Tabs, keine aufwändige Animation im MVP.

**Keine blockierenden Fragen offen** — Build kann starten.
