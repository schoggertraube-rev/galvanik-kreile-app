# 26 — UI & Designsprache: Marketing Studio

**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** baubar
**Zweck:** das visuelle System, die Sub-Navigation, das Animationsinventar und die Interaktionen, die aus der Marketing-Abteilung ein lebendiges, interaktives „Studio" machen — ohne den App-Rahmen zu verändern.
**Referenz-Mockup:** `kreile_marketing_studio.html` (maßgeblich).
**Bindet ein:** 19 (Constraints), 20 (Hauptspec).

---

## 1. Designziel

„Nach Marketing aussehen" + „ohne Anleitung bedienbar". Lebendig, animiert, interaktiv — aber geführt und ruhig genug, dass ein Betrieb ohne Marketing-Erfahrung Lust bekommt statt Schrecken. Wow durch **Bewegung, Verlauf, Komposition**, nicht durch Überladung.

## 2. Marketing-Identität (Design-Tokens)

| Token | Wert | Einsatz |
|---|---|---|
| `--mk-grad` | `linear-gradient(115deg,#7A3FB0,#C2185B 38%,#F2643C 72%,#F6A93B)` | Hero/Composer, Story-Ringe, aktiver Tab, CTA, „GELERNT"-Badge |
| `--mk1..--mk4` | `#7A3FB0 #C2185B #F2643C #F6A93B` | Einzelakzente, Icon-Tiles |
| `--mk-soft` | hell/dunkel-abhängig | weiche Flächen, Meta-Tags |
| `--glow` | farbiger Schatten | CTA- und Logo-Glow |

- Kreile-Magenta `#C2185B` ist Teil des Verlaufs → die Marketing-Identität ist eine **natürliche Erweiterung der Marke**, kein Fremdkörper.
- Verlauf **sparsam**: nur Hero, Ringe, aktiver Tab, primäre CTAs, Lern-Badge. Restfläche bleibt warme App-Basis.
- Funktioniert in Light & Dark (im Dark stärkerer Glow).

## 3. Sub-Navigation (Untermenüs)

- Pill-Tab-Leiste unter dem Titel: **Studio · Ideen · Kampagnen · Reichweite · Kunden · Wirkung**.
- **Animierter Gleiter** (`.glider`) gleitet hinter den aktiven Tab (Verlaufsfüllung), Übergang `cubic-bezier(.6,.05,.2,1)`.
- Clientseitiger View-Wechsel (kein Full-Reload); aktive View blendet ein (`floatIn`, gestaffelt).
- Mobil horizontal scrollbar.

## 4. Komponenten (Studio-View)

| Komponente | Beschreibung |
|---|---|
| **Composer-Hero** | zweispaltig: links Post-Vorschau im IG-Look (Profilkopf mit Verlaufs-Story-Ring, Vorher/Nachher-Bildfläche mit Schimmer, Caption + Hashtags), rechts Steuerung (Lern-Badge, Titel, Begründung, Meta-Tags Output/Aufwand/Kosten, Varianten-Blättern ‹ ›, ein großer Verlaufs-CTA mit Glow) |
| **3-Schritte-Leiste** | „Foto wählen → Text kommt automatisch → ein Tipp, fertig" mit Nummern-Tiles und Pfeilen |
| **Story-Ideen** | horizontales Karussell aus Story-Ringen (Verlauf), je Idee ein Format; Klick befüllt den Composer |
| **Wirkung-Mini** | 3 Karten mit hochzählenden Zahlen (Anfragen, Umsatz, ROI) + Mini-Sparkline, Verlaufs-Kante |
| **Untermenü-Einstiege** | große Kacheln, die zu Ideen/Reichweite/Kunden springen |

Andere Views: Ideen (Karten-Grid + Filter-Chips), Kampagnen (Timeline-Zeilen), Reichweite (animierter Funnel + ROI-Block), Kunden (Segment-Karten mit Emoji-Ringen + „weckbar"), Wirkung (Lern-Insight-Karten).

## 5. Animationsinventar (CSS, performant)

| Animation | Technik | Einsatz |
|---|---|---|
| Verlaufs-Bewegung | `@keyframes gradShift` (background-position) | Hero, Ringe, CTA, aktiver Tab |
| Schimmer | `@keyframes shimmer` (translateX) | „GELERNT"-Badge, Post-Vorschau, CTA |
| Einblenden | `@keyframes floatIn` (opacity+translateY), gestaffelt | View-Wechsel, Studio-Sektionen |
| Live-Puls | `@keyframes pulse` (box-shadow) | Live-Dot |
| Funnel-Wachstum | width-Transition / `growW` | Reichweite-Funnel beim Anzeigen |
| Zähler hochzählen | JS-Intervall (de-DE-Format) | Wirkung-Mini, Im-Umlauf |
| Hover-Lift + Glow | `transform` + `box-shadow` | Karten, CTAs, Stories |
| Tab-Gleiter | `left/width`-Transition | Sub-Navigation |

**Pflicht:** `@media (prefers-reduced-motion: reduce)` → Animationen abschalten/reduzieren. 60 fps anstreben (nur transform/opacity animieren).

## 6. Interaktionen (JS, im Mockup demonstriert)

- Sub-Tab-Wechsel inkl. Gleiter + View-Einblendung; Zähler/Funnel re-triggern beim Betreten.
- Story-Klick → befüllt Composer-Vorschau (Caption/Hashtags/Titel) + Scroll nach oben.
- Varianten ‹ › → blättert durch vorbereitete Post-Varianten (Feed/Detail/Reel).
- CTA „Jetzt posten" → Bestätigungs-Toast („Eingeplant für …"); echter Versand erst nach Freigabe + aktivem Kanal (Datei 22).
- Untermenü-Einstiege springen zu Tabs.

## 7. Bedienbarkeit / Barrierefreiheit

- Touch-Ziele ≥ 44 px; Story-Ringe und CTA großzügig.
- Farbe nie alleiniger Informationsträger (Icon + Text + Farbe).
- Tab-Fokus sichtbar; Tastaturbedienung der Sub-Navigation.
- Einfaches Deutsch, klare Verben („Posten", „Mails prüfen", „Anfragen").

## 8. Logos / Icon-Treatment (innovativer)

- Kanal-/Aktions-Icons als **gefüllte Tiles mit Verlauf** statt dünner Outline-Symbole (Instagram-Tile im Markenverlauf, E-Mail in Grün-Teal, Google in Blau-Grün).
- Profil-/Segment-Avatare mit **Story-Ring** (Verlauf).
- Marketing-Modul-Logo als animiertes Verlaufs-Tile mit Glow.

## 9. Einbettung in die App

- Linke Leiste + obere Leiste **identisch** zu allen anderen Seiten (kein Sonderweg).
- Gleiche Schrift-, Radius- und Schatten-Grundwerte wie die übrige App; nur der Marketing-Verlauf kommt als Akzent hinzu.
- Hell/Dunkel über denselben Schalter; alle Tokens themefähig.

## 10. Akzeptanzkriterien

- [ ] Rahmen unverändert; Marketing aktiver Menüpunkt.
- [ ] Sub-Navigation mit animiertem Gleiter; 6 Views clientseitig umschaltbar, Einblend-Animation.
- [ ] Composer-Hero animiert (Verlauf, Schimmer), Varianten durchblätterbar, Story-Klick befüllt Vorschau.
- [ ] Wirkung-Zahlen zählen hoch; Funnel-Balken wachsen beim Betreten der Reichweite-View.
- [ ] CTA löst Bestätigungs-Toast aus; kein echter Versand ohne Freigabe + Kanal.
- [ ] `prefers-reduced-motion` respektiert; nur transform/opacity animiert (kein Layout-Thrash).
- [ ] Light & Dark funktionieren; Verlauf sparsam, Basis bleibt warme App-Fläche.
- [ ] Touch-tauglich, responsiv bis Smartphone.
- [ ] Optischer Abgleich gegen `kreile_marketing_studio.html` bestanden.

## 11. Hinweis zur Umsetzung in der App (Stack)

Mockup ist statisches HTML/CSS/JS als visuelle Referenz. Im Build: Umsetzung als React-Komponenten (Tailwind + bestehende Design-Tokens), Sub-Navigation als Router-/State-Tabs, Daten über `MarketingDataProvider` (Datei 21). Animationen als CSS/Framer-Motion-Äquivalent; keine schweren Libraries für reine Deko.
