# 14_TELEFONNOTIZ_FOKUSMODUS_v1 — KORREKTUR §7.2 (Handy-Layout)

**Bezug:** ersetzt Abschnitt §7.2 „Smartphone — gestapelt" in `14_TELEFONNOTIZ_FOKUSMODUS_v1.md`
**Begleitdokument:** `kreile_telefonnotiz_handy_ios.html`
**Grund:** Das responsive Stauchen des Desktop-Grids wirkt billig. Das Handy bekommt ein **eigenständiges, natives Layout** — gleicher Funktionsumfang, eigene Komponenten.

---

## §7.2 (neu) — Handy: eigenständiges iOS-natives Layout

### Prinzip

Kein heruntergebrochenes Desktop-Grid. Das Smartphone-Layout ist eine **eigene View-Implementierung** mit nativen iOS-Bedienmustern. Markenidentität (Cream-Palette, Fraunces + Manrope) bleibt erhalten; nur die Interaktions- und Layout-Patterns werden iOS-typisch.

Technisch: eigene Komponente `TelefonnotizMobile.tsx`, die ab Viewport < 600 px statt `TelefonnotizDesktop.tsx` gerendert wird. Gemeinsame Logik (State, Analyse-Pipeline, Action-Executor, Live-Kontext-Hooks) liegt in geteilten Hooks — **kein doppelter Funktionscode**, nur eigene Präsentation.

### Layout-Bausteine (iOS)

| Baustein | Umsetzung |
|---|---|
| **Status-Bar** | simuliert/nativ, Dynamic-Island-tauglich |
| **Nav-Bar** | links Zurück-Chevron (kontextabhängig: „Start" → „Erfassen"), rechts „Beenden" |
| **Large Title** | „Telefonnotiz" groß (Fraunces), Untertitel mit Datum |
| **Schritt-Dots** | dezent unter dem Titel (1–4), aktiver Dot orange verbreitert |
| **Segmented Control** | Tippen / Sprechen, iOS-Slider-Animation, „Festnetz"-Badge an Tippen |
| **Inset-Grouped-Listen** | alle Inhalte als gruppierte weiße Karten auf Cream-Grouped-Background (`#F0E9DA`), Section-Header in Caps |
| **Notizfeld** | Karte mit Live-Highlight-Editor (Mirror-Technik), kleiner Mikro-Button (32 px) rechts in der Toolbar |
| **Live-Kontext** | als gruppierte Cells: Kunde (mit Avatar + Chevron), Aufträge, Kalender-Strip, Lager + Zahlung kombiniert |
| **Quick-Lookups** | horizontal scrollende Chips (kein Grid), iOS-Card-Stil |
| **Antwort-Vorschlag** | dunkle Karte (Ink) |
| **Bottom-Action-Bar** | fixiert, ein primärer Button (Auswerten → Speichern), Safe-Area-Padding, Home-Indicator |
| **Bottom-Sheets** | iOS-Action-Sheet-Stil mit Grip, Spring-Animation, Abbrechen separat — für Speichern, Exit, Quick-Lookup-Detail |
| **Success** | Vollbild mit großem grünem Haken (iOS-Green `#34C759`), Pop-Animation, Zusammenfassung als Liste |
| **Undo** | iOS-Toast unten, 10 Sekunden |

### Sprechbutton — kompakt

Korrektur gegenüber dem Wow-Mockup: Der Aufnahme-Button ist **kein Bühnen-Element** mehr. Da Tippen Default ist (Festnetz-Realität), reicht ein kompakter Button.

- Im Tippen-Modus: kleiner Mikro-Button (32 px) in der Notizfeld-Toolbar als Sekundär-Option.
- Im Sprechen-Modus: kompakter runder Button (68 px), dezenter Doppel-Puls, kein Vollbild-Koloss.

### Navigation Erfassen ↔ Auswerten

iOS-Push-Pattern: „Auswerten" wechselt zur Eval-View, Nav-Zurück („‹ Erfassen") führt zurück zur Eingabe. Beenden-Logik (Anti-Sackgasse, §6) bleibt unverändert, wird als Bottom-Sheet dargestellt.

### Akzeptanz (ergänzt §13)

- [ ] Handy-Layout ist eine eigene Komponente, kein gestauchtes Desktop-Grid
- [ ] Alle Funktionen vorhanden (Tippen + Highlight, Sprechen, 5 Kontext-Sektionen, 4 Quick-Lookups, Auswerten, 6 Felder, Aktions-Vorschau, Speichern 2-Wege, Exit-Logik, Undo)
- [ ] iOS-Bedienmuster: Segmented Control, Inset-Grouped-Listen, Bottom-Sheets, Bottom-Action-Bar
- [ ] Sprechbutton kompakt (≤ 68 px), nicht dominant
- [ ] Geteilte Logik-Hooks mit Desktop/Tablet — kein duplizierter Funktionscode
- [ ] Markenidentität (Cream, Fraunces + Manrope) erhalten

### Implementierungshinweis Antigravity

- Viewport-Switch über `useViewport()`-Hook: < 600 px → `TelefonnotizMobile`, sonst `TelefonnotizDesktop`.
- Beide importieren dieselben Hooks: `usePhoneNoteAnalysis()`, `useLiveContext()`, `useActionExecutor()`, `useAutosaveDraft()`.
- Nur Präsentations-Layer unterscheidet sich.
- Bottom-Sheets als wiederverwendbare `<IosSheet>`-Komponente.

---

**Rest der Spec `14_TELEFONNOTIZ_FOKUSMODUS_v1.md` bleibt unverändert gültig.**
