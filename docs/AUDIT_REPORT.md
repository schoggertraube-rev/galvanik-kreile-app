# Audit Report - Kreile WerkstattCockpit App

## 1. ROUTING & SEITEN
Die App nutzt den Next.js App Router. Hier ist die Analyse der gefundenen Routen:

- **`/` (Home Dashboard)**: Funktional. Zieht teilweise echte Daten (Orders) und teilweise Mock-Daten (Quotes). Zeigt Hardcoded Widgets (KPIs, Timeline).
- **`/archive`**: Funktional (Listenansicht). Holt Orders über das Repository, mappt diese auf Mock-Typen.
- **`/customers` & `/customers/[id]`**: Funktional. Vollständig an Supabase (`customers`) angebunden.
- **`/items`**: Funktional (Listenansicht). Nutzt lokales `localStorage`-Mocking.
- **`/kunden-auftraege`**: Funktional (Wrapper). Wechselt zwischen `/orders` und `/customers`.
- **`/orders` & `/orders/[id]`**: Funktional. Liest aus Supabase (`orders`, `items`, `customers`).
- **`/performance`**: Platzhalter/Gerüst. UI ist da, Daten vermutlich weitgehend Mock/Hardcoded.
- **`/print-queue`**: Funktional. Zieht Orders über das Repo.
- **`/quotes` & `/quotes/[new]`**: Funktional (Listen- & Formularansicht). Nutzt reines IndexedDB/Mocking, *kein* Supabase.
- **`/scan`**: Funktional. Nutzt echten OCR-Service (`OCRScan`).
- **`/settings`**: Platzhalter/Gerüst (Statische UI ohne echte Speicherung).
- **`/start`**: Funktional (Login/Demo Screen). Setzt Auth-Cookies.
- **`/station/[slug]`**: Funktional. Zeigt spezifische Warteschlangen für Galvanik/Warenausgang, zieht Supabase-Orders.
- **`/status`**: Platzhalter/Gerüst (System/Bad-Status). Hardcoded/Mock-Mix.
- **`/today`**: Platzhalter/Gerüst. Übersicht mit Mock-Einträgen.
- **`/warendurchlauf`**: Funktional. Enthält den Wizard/Intake für neue Aufträge.

## 2. DATENANBINDUNG
- **Aufträge (Orders)**: ✅ **Supabase**. `ordersRepository.ts` liest/schreibt echt nach Supabase (`orders`, `items`). Fallback auf Mock existiert.
- **Kunden (Customers)**: ✅ **Supabase**. `customersRepository.ts` ist an die `customers` Tabelle angebunden.
- **Wareneingang (Inquiries/Quotes)**: ❌ **Mock**. `inquiriesRepository.ts` nutzt IndexedDB (`MOCK_REQUESTS`). Hier fehlt die Supabase-Anbindung komplett.
- **Galvanik (Bäder)**: ⚠️ **Gemischt**. `bathMeasurementsRepository.ts` loggt nach Supabase. `bathsRepository.ts` (die Konfiguration) ist reines Mock/localStorage.
- **Lager/Chemie (Inventory)**: ✅ **Supabase**. `inventoryRepository.ts` greift auf `inventory_items` und `stock_movements` zu.
- **Performance**: ❌ Keine direkte Supabase-Logik, nutzt abgeleitete Order-Daten.
- **Kontrolle/Archiv**: ✅ Nutzt abgeleitete Order-Daten (Supabase).
- **Artikel/Teile (Items)**: ❌ **Mock**. `itemsRepository.ts` nutzt rein `localStorage`.

## 3. NAVIGATION
- Es existiert **keine** parallele RightNav und Bottom/Left-Nav mehr im Layout. Die Sidebar und Topbar sind nicht mehr in der `KreileAppShell` eingehängt.
- **Tote / ungenutzte Buttons**:
  - In `RightNav.tsx`: Die Untermenüs "Verzug" und "Performance" nutzen Feature-Flags (`engpass_heatmap`, `performance_score`). Sind diese false, sind es tote Links (`href="#"`).
- **Doppelte Einstiege**: Keine offensichtlichen Dopplungen in der sichtbaren Navigation gefunden, nachdem die alte Navigation entfernt wurde.

## 4. TRACKING & ANALYSE
- **Gefeuert**: Ja, `trackUiEvent` wird gefeuert (z.B. in `RightNav.tsx`, `KreileHeader.tsx`, `FocusOverlay.tsx`, `kunden-auftraege/page.tsx`).
- **Persistent gespeichert**: **NEIN**. 
- **Auswertung**: **NEIN**.
- **LÜCKE**: In `src/lib/tracking/tracking.ts` wird das Event nur per `console.log` ausgegeben. Es gibt keine Anbindung an ein Analytics-Backend (PostHog, Mixpanel o.ä.) und kein Dashboard, um diese Daten zu lesen.

## 5. DOPPLUNGEN & TOTER CODE
- **Toter Code (Ungenutzte Dateien)**:
  - `src/components/layout/Sidebar.tsx` (alte Left-Nav, nicht mehr importiert)
  - `src/components/layout/Topbar.tsx` (alte Top-Nav, nicht mehr importiert)
- **Dopplungen**:
  - `GlobalSearch.tsx` in `src/components/layout/` überschneidet sich potenziell mit In-Page-Suchen (z.B. in `/customers`), aber als globale Suche gewollt.

## 6. TYPSICHERHEIT
Insgesamt wurden **20** Vorkommen von `: any` oder `as any` im Projekt gefunden:
- `src/app/orders/page.tsx`: 5 Vorkommen
- `src/app/start/page.tsx`: 1 Vorkommen
- `src/components/orders/BulkLabelPrintView.tsx`: 2 Vorkommen
- `src/components/orders/OrderEditModal.tsx`: 1 Vorkommen
- `src/lib/repositories/customersRepository.ts`: 1 Vorkommen
- `src/lib/repositories/inventoryRepository.ts`: 4 Vorkommen
- `src/lib/repositories/ordersRepository.ts`: 3 Vorkommen
- `src/lib/types/customer.ts`: 3 Vorkommen

## 7. STABILITÄT
- **npm run build**: ✅ **Erfolgreich** (Kompiliert in ~15.2s ohne Fehler).
- **npm test (vitest)**: ✅ **Erfolgreich** (3 Suites, 11 Tests passed).
- **Konsolenfehler**: Beim Laden der `/` Home-Route kann die `/api/morning-message` fehlschlagen, was geloggt wird ("Morning message API not reachable").
- **Offline / PWA-Fallback**: Intakt. `OfflineManager.ts` implementiert `IndexedDBHelper` und Simulated-Offline-Modus. Die PWA-Registrierung (`PwaRegister.tsx`) ist aktiv.

## 8. RESPONSIVE
- **LÜCKE**: Die Hauptnavigation (`RightNav`) wird in der `KreileAppShell.tsx` auf mobilen Geräten versteckt (`hidden md:flex`). Da es keine `BottomNav` oder ein Hamburger-Menü im `KreileHeader.tsx` gibt, **fehlt auf Smartphones jegliche Hauptnavigation**. Man ist auf der aktuellen Seite "gefangen" (außer man navigiert per globaler Suche).

## ZUSAMMENFASSUNG (Grobe Fertigstellung)
- **Frontend (UI / UX)**: ~85% (Sehr poliert, aber gravierende Mobile-Navigationslücke und noch vereinzelte Platzhalter-Seiten).
- **Anbindung (Supabase / DB)**: ~50% (Orders, Inventory, Customers sind angebunden; Quotes, Items und Bad-Konfigs laufen komplett auf Mock/localStorage).
- **Analyse & Tracking**: 0% (Vorhandenes Gerüst loggt nur in die Konsole, keine Datenbank, kein Dashboard).
