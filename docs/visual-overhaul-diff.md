# Visual Overhaul Diff Documentation

## 1. Design System & Tokens
- **`src/styles/tokens.css`**: Created to define the new Cremeton UI tokens.
  - Colors: `#F5EFE3` background, `#2B3B4C` text, `#B8923F` primary, `#FF6B35` accent.
  - Spacings & Typography scaling map established.
- **`src/app/globals.css`**: Injected Next.js `@theme` configuration merging tokens.

## 2. Global App Shell
- **`src/components/layout/KreileAppShell.tsx`**: Updated container layout to remove global shell boundaries around `/start`.
- **`src/components/layout/KreileHeader.tsx`**: Added new skyline and compact logos. Fixed spacing.
- **`src/components/layout/KreileBottomNav.tsx`**: Implemented new icons (`lucide-react`) matching stroke widths.

## 3. Main Views Overhauled
- **Wake Screen (`/start`)**:
  - Implemented PIN lock dialog mapping `Meister Kreile` and other user roles.
  - Implemented Live Open-Meteo Weather widget.
  - Connected dynamically changing Greeting component (`👋, ☕, 🍺`).
- **Dashboard (`/`)**:
  - Introduced 5 KPI summary cards at the top.
  - Added chronological Timeline overview.
  - Sidebar layout configured for active issues / alerts.
- **Warendurchlauf (`/warendurchlauf`)**:
  - Process Hero visual added (`Wareneingang -> Galvanik -> Warenausgang`).
  - Implemented Slider Modal context instruction dialog for OCR inputs.

## 4. E2E Safety Net
- Created `e2e/smoke.spec.ts` to assert all views are rendering properly.
- Mock Auth Proxy strategy configured in `src/proxy.ts` using `bypass-auth` cookie.
- Vitest configuration isolated to `src/test/` to avoid conflicts.

*End of Document*
