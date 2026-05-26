# Registry of Existing Functions (Before Overhaul)

The following list maps all existing pages, routes, features, and data-endpoints of the Kreile Galvanik Cockpit. This registry serves as a checklist during and after the visual redesign to guarantee that **zero features are removed or compromised**.

## 1. App Routes and Pages

| Route | Component/Page | Primary Features |
|---|---|---|
| `/` | `HomeDashboard` | Tagesablauf dashboard, 5 KPI summaries, Today timeline items, Today Important panel, Today small hint card |
| `/start` | `StartScreen` | Wake/Start view, Frankfurt skyline SVG graphic, static Weather card, greeting service, user pin dialog sheets |
| `/warendurchlauf` | `NewOrderWizard` | Central order intake wizard. Integrates: `IntakeEntry` main selector, `CameraCapture` OCR simulation, `OCRReviewPanel` confidence-based highlighter, `CustomerMatchPanel` lookup/creation, `SuggestedItemsPanel` cataloging, and `IntakeCompletionSummary` checklists. |
| `/orders` | `OrdersList` / Details | View list of active orders, status badge metrics, filter by station, order tracking, and print A6 routing cards. |
| `/quotes` | `QuotesList` / Details | Management of incoming inquiries, status tracking, price assessments. |
| `/customers` | `CustomersList` / Details | Customer profiles, contact details, payment terms, historical orders timeline. |
| `/items` | `ItemsList` / Details | Technical parts catalogs, materials profiles, default plating specifications. |
| `/performance` | `PerformancePage` | Employee metrics, throughput metrics, daily averages, charts. |
| `/settings` | `SettingsPage` | Working hours, default processing standards, parameters for baths/stations. |
| `/status` | `StatusOverview` | Real-time monitoring of active baths, status updates, temperature controls. |
| `/station` | `StationWorkflows` | Station-specific queue, active batches execution and updates. |
| `/login` | `LoginPage` | Standalone workspace authentication portal. |

## 2. Server Actions & Backend Abstractions

### Repositories (`src/lib/repositories/*`)
- `ordersRepository`: Fetches and persists orders to IndexedDB cache + local storage, synchronizes online modifications with Supabase actions.
- `customersRepository`: Full CRUD profiles, similarity index for OCR customer match.
- `inquiriesRepository`: Tracking quotes and inquiries counts.
- `timelineRepository`: Aggregates active jobs for Today chronological timelines.
- `bathsRepository` & `inventoryRepository`: Chemical levels and physical inventory.

### Core Services (`src/lib/services/*`)
- `ocrService`: Simulated scanning with confidence levels.
- `intakeService`: Hooks actions and fires integration event listeners.
- `photoService` & `labelService`: Placeholders for camera storage and A6 label prints.
