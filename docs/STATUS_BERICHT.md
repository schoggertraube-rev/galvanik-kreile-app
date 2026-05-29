# 📊 Status-Bericht: Kreile WerkstattCockpit
*Stand: 29. Mai 2026*

## 1. FUNKTIONSÜBERSICHT

| Bereich | Status | Details |
| :--- | :--- | :--- |
| **Home (`/start`)** | 🟡 Teilweise | Dashboard existiert (Widgets für Stats, Shortcuts). Live-Metriken fehlen teilweise oder kommen aus lokalen Dummys (Timeline). |
| **Warendurchlauf / Intake** | 🟡 Teilweise | UI-Wizard (Kamera/Manuell) ist exzellent aufgebaut. **Aber:** OCR ist ein Mock (`simulateScan`). Kamera lädt lokal hoch. |
| **Galvanik-Queue** | 🟡 Teilweise | Listen-UI und `GalvanikOrderRow` mit `FocusOverlay` funktional. Drag & Drop / echte Queue-Priorisierung fehlt teilweise. |
| **Warenausgang** | 🟡 Teilweise | Station exisitert. Finale Versand-Logik und Dokumentengenerierung (Lieferschein PDF) fehlt. |
| **Anfragen (`/quotes`)** | 🟡 Teilweise | UI existiert. Datenbindung an Inquiries-Repo, aber Chat-/Angebotskalkulator-Backend ist nicht vollständig. |
| **Kunden/Aufträge** | 🟢 Voll funktional | CRUD für Kunden & Aufträge live an Supabase angebunden. Such- und Filterfunktionen aktiv. |
| **Lager/Chemie (`/items`)** | 🔴 Gerüst/Mock | Bäder (`bathsRepository`) und Verbräuche laufen derzeit **nur im localStorage**. |
| **Kontrolle/Archiv** | 🔴 Gerüst/Mock | Dummy-Listen, keine echte Historisierung/Archiv-Logik implementiert. |
| **Performance/Analyse** | 🔴 Gerüst/Mock | Platzhalter-UI. Datenanbindung für Auswertungen fehlt. |
| **Einstellungen (`/settings`)** | 🟢 Voll funktional | Admin-Konsole mit Feature-Flags, Rollen-Matrix, CSV-Import und Supabase Auth Admin-API Live-Anbindung. |
| **Auth/Login (`/login`)** | 🟢 Voll funktional | Anmeldung gegen Supabase Auth funktioniert, inkl. Session-Management. |

---

## 2. DATENANBINDUNG (Repositories)

- `ordersRepository.ts` ➔ **Supabase-live**
- `customersRepository.ts` ➔ **Supabase-live**
- `inquiriesRepository.ts` ➔ **Supabase-live** (wird als Quotes genutzt)
- `eventsRepository.ts` ➔ **Supabase-live**
- `ui_events` ➔ **Supabase-live** (über Action-Tracking)
- `inventoryRepository.ts` ➔ **Supabase-live**
- `bathsRepository.ts` / `bathMeasurements` ➔ **Mock (localStorage)**
- `itemsRepository.ts` ➔ **Mock (localStorage)**
- `timelineRepository.ts` ➔ **Mock / Aggregation** (mixt Supabase Events mit lokalen Mocks)
- `complaintsRepository.ts` ➔ **Mock (localStorage)**

---

## 3. BEKANNTE FEHLER & LÜCKEN

1. **OCR Mocking:** Die `processImageWithAI` und `ocrService.simulateScan` Funktionen nutzen statische Timeouts und Dummy-Daten. Echte KI-Anbindung fehlt.
2. **Datentabellen Mobile:** Komplexe Tabellen (z. B. auf Detailseiten für Kunden/Aufträge) könnten auf kleinen Displays ohne `overflow-x-auto` Wrapper umbrechen oder das Layout sprengen. (Muss im Detail getestet werden).
3. **Formular-Validierung:** Beim manuellen Warendurchlauf fehlen harte Zod/React-Hook-Form Validierungen. Man kann teilweise leere Aufträge ohne Gegenprüfung erzeugen.
4. **Fehlende Relationen in Repos:** Das Mock-`itemsRepository` hat keine echten Foreign Keys zu den Orders in Supabase.
5. **Realtime Subscriptions:** Realtime ist für Kunden/Orders aktiv, deckt aber noch nicht alle Tabellen (wie Inventory oder Inquiries) lückenlos ab.
6. **Leere States:** Die Archiv- und Performance-Seiten sind reine Platzhalter.

---

## 4. MOBILE/RESPONSIVE (Stand nach aktueller Umsetzung)

- **Was funktioniert:**
  - `KreileHeader` wurde aufgeräumt (Datum/Glocke ausgeblendet).
  - Hamburger-Icon öffnet die neue `MobileNav` (Slide-in, Backdrop, scrollbar).
  - Warendurchlauf `TopWorkflowBar` ist scrollbar (`overflow-x-auto, snap-x`), Pfeile sind ausgeblendet, Sticky-Verhalten greift.
  - Das `FocusOverlay` (Modals) nimmt auf Mobile nun die volle Bildschirmhöhe (`100dvh`) ein, wodurch Scroll-Probleme behoben wurden.
  - Das generelle Spalten-Layout (`p-4` auf Mobile) greift.
- **Was noch offen ist:**
  - Umfangreiche Datentabellen in der Listenansicht (Kunden, Archiv) müssen ggf. mit einem `.table-responsive` Wrapper (`overflow-x-auto`) geschützt werden.

---

## 5. ÜBERGABE-CHECKLISTE

### MUSS (ohne das ist die App für den Kunden nicht nutzbar)
- [ ] Alle verbleibenden Repositories (`baths`, `items`, `complaints`, `timeline`) als SQL-Tabellen nach Supabase migrieren und localStorage-Logik entfernen.
- [ ] OCR-Anbindung klären (Entweder echte API anbinden oder einen offensichtlichen "Manual Fallback" als Standard setzen).
- [ ] Harte Validierung der Pflichtfelder beim Order-Intake.
- [ ] Mobile-Test: Alle Tabellen-Ansichten (Kunden, Orders) auf horizontalen Overflow prüfen.
- [ ] Supabase RLS (Row Level Security) Policies für den Live-Betrieb härten (aktuell oft `true`).

### KANN (verbessert Qualität, aber kein Blocker)
- [ ] Performance-Dashboard mit echten Metriken aus der Datenbank füllen.
- [ ] PWA Offline-Fähigkeit (Service Worker) komplett durchtesten.
- [ ] Nativ anmutende Kamera-API (WebRTC) in der App direkt öffnen statt Datei-Upload-Dialog.
- [ ] PDF-Generierung für Laufkarten und Lieferscheine einbauen.

---

## 6. FERTIGSTELLUNGSGRAD

- **Frontend/UI:** 85% *(Screens fast vollständig, UX und Flows sehr poliert)*
- **Datenanbindung:** 65% *(Basis live, aber wichtige Domänen wie Chemie & Bauteile noch lokal)*
- **Geschäftslogik:** 70% *(Prozesse im UI abgebildet, Backend-seitige Checks fehlen noch)*
- **Stabilität/Tests:** 50% *(Build grün, rudimentäre Tests vorhanden, E2E fehlt)*
- **Mobile/Responsive:** 90% *(Nach heutigen Anpassungen sehr gut)*
- **Analyse/Tracking:** 90% *(Event-Tracking in Supabase implementiert)*

---

## 7. ZEITSCHÄTZUNG

Bis zur minimalen Kundenübergabe (Erfüllung der **MUSS**-Checkliste):
**ca. 4 bis 5 Entwicklertage.**

*Hauptaufwand:* Datenbank-Migrationen für die fehlenden Mock-Repos schreiben, Repos umschreiben, und die Formular-Validierungen inkl. Fehlerbehandlung robuster machen.
