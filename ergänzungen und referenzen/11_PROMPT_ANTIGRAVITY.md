# Antigravity-Build-Prompt — Add-on 11 (Rechte Navigation, Aufräumen, Detail-Fokus, Galvanik-Minimal)

```text
Lies 11_ADDON_RECHTE_NAVIGATION_FOKUS_AUFRAEUMEN.md als Add-on zur bestehenden Kreile WerkstattCockpit App.
Dies überschreibt das Navigationskonzept aus 01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md (linke Sidebar → rechte vertikale Leiste). Die horizontale Werkstattfluss-Leiste oben bleibt.

SICHERHEIT ZUERST:
- git status prüfen, sauberen Commit/Snapshot erstellen.
- Branch feature/right-nav-focus anlegen.
- Bestand prüfen und auflisten: AppShell, bestehende Navigation (Bottom/Left), TopWorkflowBar, ProfileMenu, Galvanik-Liste, Order-/Customer-Detailkomponenten, StatusEvents, trackUiEvent.
- Keine funktionierende Seite löschen, bevor der Ersatz steht. Kein Doppelzustand committen.

Setze schrittweise um, je Schritt ein kleiner Commit:

1. RightNav bauen (src/components/layout/RightNav.tsx + RightNavItem.tsx).
   Vertikale Leiste rechts, genau 6 Punkte von oben:
   Home (groß) · Anfragen · Warendurchlauf (groß) · Lager/Chemie · Kontrolle & Archiv · Kunden/Aufträge.
   Home und Warendurchlauf als variant="primary" (~96–112 px hoch), Rest ~72–80 px.
   Aktiver Punkt hervorgehoben, kritischer Status als roter Akzent. Touchziele ≥ 48 px.
   Bottom-/Left-Nav erst entfernen, wenn RightNav vollständig funktioniert.

2. Menü-Mapping (Aufräumen, nichts löschen — alles bekommt ein Zuhause):
   - Start → Home (umbenannt)
   - Alle Aufträge → Kunden/Aufträge, Tab "Aufträge"
   - Kundenkartei → Kunden/Aufträge, Tab "Kunden" (bestehende Kundeninfos unverändert)
   - Verzug & Engpässe → Untermenü unter Warendurchlauf
   - Performance → Untermenü unter Kontrolle & Archiv
   - Einstellungen → Header-Profilmenü oben rechts
   - Scan → Quick-Action (Kamera in Suchleiste + Schnellannahme), kein Top-Punkt
   - "Mehr"-Sammelpunkt entfällt komplett.
   Kunden/Aufträge ist EIN Punkt mit zwei Tabs. Deaktivierte Funktionen sichtbar ausgrauen, nie verstecken. Keine doppelten Buttons.

3. FocusOverlay bauen (src/components/entities/FocusOverlay.tsx).
   Backdrop mit blur + Abdunkeln über die ganze App (inkl. RightNav + Werkstattfluss, nicht klickbar).
   Klick auf Backdrop schließt ("Tipp daneben"). Esc schließt. Bei ungespeicherten Eingaben kurze Rückfrage.
   Inhalt: OrderFocusView und CustomerFocusView — Kerninfos auf einen Blick, Felder inline editierbar, Speichern ohne Seitenwechsel. Auftrag überall gleich, Kunde überall gleich.

4. Galvanik-Minimalansicht (GalvanikQueue.tsx + GalvanikOrderRow.tsx).
   Pro Zeile NUR: Auftragsnummer · Kunde/Name · Zieldatum. Linker Statuspunkt nach Dringlichkeit, kein Fließtext-Label.
   Sortierung: kritisch (überfällig) → gefährdet (heute/morgen) → im Plan, je nach dueDate.
   Alle weiteren Daten (Teile, Material, Oberfläche, Badnummer, Hinweise) NICHT in die Zeile — gehören aufs Durchlaufetikett/QR.
   Tap auf Zeile → EntityDecisionOverlay: "Auftrag ansehen" / "Kunde ansehen" → öffnet FocusOverlay.

5. Tracking ergänzen: rechte Leiste und Overlay feuern trackUiEvent (nav_click, overlay_open, overlay_close_backdrop, overlay_close_esc). Keine Klartext-Namen/Freitexte.

ABSCHLUSS:
- Akzeptanzkriterien aus §15 der Spec auf Tablet UND Desktop durchklicken.
- Alte Nav-Reste und tote Buttons entfernen, erst nachdem RightNav steht.
- Bestehende Datenstruktur, Supabase/Drizzle-Migrationen und localStorage/PWA-Fallback nicht beschädigen.

Arbeite modular. Frage nach, bevor du destruktive Terminal-Befehle ausführst.
```
