# Visual Overhaul V1 - Changes & Architecture Decisions

This document outlines the major architectural, visual, and conceptual changes introduced during the "Visual Overhaul V1" phase for the KREILE WerkstattCockpit.

## 1. Design System & Tokens
- **Centralized CSS Tokens**: Migrated scattered Tailwind classes to a centralized `src/styles/tokens.css` utilizing standard CSS variables. 
- **Color Palette**: Established a premium color palette tailored to a professional, tablet-first workshop environment:
  - **Primary**: Kreile Navy (`#0E1A2E`, `#1A2A42`)
  - **Accents**: Gold (`#B38B38`, `#E6C57A`), Orange (`#E86A33`)
  - **Surfaces**: Cremeton (`#F5EFE3`), Soft Backgrounds (`#F8F9FA`)
- **Typography**: Integrated `Playfair Display` (Serif) for prominent headings and `Inter` (Sans-Serif) for UI/Data presentation to create a robust, high-quality look.

## 2. App Shell & Navigation (`KreileAppShell`)
- **Responsive Layout**: Replaced the previous split navigations with a unified `KreileAppShell`. 
  - **Desktop/Tablet Landscape**: Uses `KreileSidebar` with an organized `MAIN_NAV_ITEMS` array.
  - **Mobile/Tablet Portrait**: Utilizes `KreileBottomNav` optimized for thumb-reach and touch targets.
- **Topbar**: Redesigned to act as a central hub for global status. It now includes:
  - An inline process visualization of the workshop stations.
  - An interactive **Offline/Sync Widget** that monitors PWA connectivity and `IndexedDB` queues.
  - Direct quick-links to critical areas (e.g., Lager warnings).

## 3. Core Screen Redesigns

### Wake Screen (`/start`)
- Overhauled to serve as a calm, informative welcome screen ("Cremeton" background).
- Added real-time weather integration (via Open-Meteo) specifically for the Langenfeld location.
- Integrated dynamic greeting logic and direct PIN-Pad login flows.

### Home Dashboard (`/`)
- Introduced a modular KPI Card row fetching real data (Orders, Revenue, Deliveries).
- Added the "Today Timeline Card", visually separating past, present, and future tasks.
- Included actionable "End of Day" suggestions to guide user workflows.

### Warendurchlauf (`/warendurchlauf`)
- Redesigned into a Hero-style process strip with large touch targets.
- Implemented visual alert dots for critical stations (e.g., "Galvanik").
- Integrated direct intake wizards and OCR functionality right into the dashboard flow.

### Kundenakte & Werkstattgedächtnis (`/customers`)
- **Data Model**: Extended the `Customer` type to include advanced profiles (`PaymentProfile`, `ExpectationProfile`, `TechnicalProfile`, `companyInfo`, `aiSummary`).
- **UI Architecture**: Shifted from a monolith view to a clean, tab-based master-detail interface (`CustomerDetailView`).
- **"Werkstattgedächtnis"**: Built a dynamic `CustomerMemoryCard` that calculates and displays automatic insights (e.g., "VIP Kunde", "Preisabweichung", "Reklamationsrisiko").
- **Smart Profile**: Integrated a simulated AI Executive Summary section and external data enrichment layout.

## 4. Technical Refactorings
- **Mock Data**: Upgraded `INITIAL_CUSTOMERS` to provide deep, realistic datasets for testing the new UI components.
- **State Management**: Maintained the `localStorage`-based offline-first architecture but bumped keys (e.g., `kreile_customers_v2`) to force clean data migrations during development.
- **Component Splitting**: Extracted massive page files into focused UI components (e.g., `StationStatusButton`, `CustomerMemoryCard`).

## Next Steps
This overhaul sets the foundation for Phase 9 and beyond, specifically focusing on introducing new features, stabilizing the PWA manifest, and reworking the Performance Dashboard.
