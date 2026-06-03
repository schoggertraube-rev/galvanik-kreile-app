# LIVEGANG-AUDIT REPORT

## A. Executive Summary
* **Livegangfähig:** Bedingt. Die UI ist hochwertig und verkaufbar, aber funktionell ist die App unter der Haube noch stark von `mockData.ts` und `localStorage` abhängig.
* **Größte Blocker:** 
  1. Die Trennung zwischen "echter DB-Aktion" und "Mock-State" verschwimmt an vielen Stellen (z. B. Admin Devices, Finanzen, Import). 
  2. Fehlende Persistenz in fertigen UIs (Telefonnotiz speichert nur lokal, obwohl die DB-Tabelle existiert).
  3. Gefahr, dass Demo-Daten im Live-Betrieb nicht sauber von echten Daten getrennt werden können.
* **Was darf live gezeigt werden:** Warendurchlauf, Performance-Dashboards (diese greifen bereits auf echte `performance.actions.ts` zu), grundlegende Navigation.
* **Was muss umbenannt/deaktiviert werden:** Der Kalender-Button oben rechts muss als "Demo" gekennzeichnet werden. "Geräte sperren" und "Steuerberater Export" müssen als UI-Demos klar beschriftet werden.

## B. Funktionsmatrix

| Modul | Route | Status | Risiko | Sofortmaßnahme |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `/` | **Mock/Echt** | Niedrig | Zeigt Mockdaten/KPIs. Muss klar kommuniziert werden. |
| **Warendurchlauf** | `/warendurchlauf` | **Echt (State)** | Niedrig | Lädt. Auswahl-State in localStorage. |
| **Kommunikation** | `/kommunikation` | **Mock** | Mittel | Kanäle wie WhatsApp, Instagram sind nur UI-Dummies. |
| **Telefonnotiz** | `/kommunikation?mode=telefonnotiz` | **localStorage** | Hoch | Bisher KEINE echte Speicherung in DB, obwohl Button das impliziert! |
| **Performance** | `/performance` | **Echt (DB)** | Niedrig | Greift über Server Actions echt auf Drizzle/Supabase zu. |
| **Betriebs-KVP** | `/betrieb-kvp` | **Mock** | Mittel | Erfordert echtes Backend-Bindung. |
| **Finanzen** | `/finanzen` | **Mock** | Hoch | Reiner UI-Mock. Keine Buchhaltungs-Anbindung. |
| **Admin Devices** | `/admin/devices` | **Mock** | Mittel | Reiner React-State (`useState`). Keine echte Sperrlogik. |
| **Admin Import** | `/admin/import` | **Mock** | Hoch | "Nur Demo/UI Validation". |

## C. Tote Buttons und Fake-Links

* **Mikrofon-Icon** (`KommunikationClient.tsx`): 
  * *Status:* **Behoben** (deaktiviert und als "in Vorbereitung" getooltippt).
* **Kalender** (`TopWorkflowBar.tsx` / `KreileAppShell.tsx` / `page.tsx`): 
  * *Status:* **Behoben** (in `page.tsx` als "Geplant" ausgewiesen, keine leere Route, als Demo deklariert).
* **"Steuerberater Export" / "DATEV" / "Lexware"** (`FinanzenDashboardClient` / `AdminImportClient`): 
  * *Status:* **Behoben** (Buttons auf "disabled", "Demo" und "in Vorbereitung" umgestellt).
* **Payment / Tap-to-Pay / Zahlungs-QR** (`FinanzenDashboardClient` / `WarenausgangQueue`): 
  * *Status:* **Behoben** (Buttons deaktiviert, als "Demo" gekennzeichnet, Hinweis auf Evaluierung hinzugefügt).
* **Kommunikation Externe Kanäle (WhatsApp / Instagram)** (`KommunikationClient`): 
  * *Status:* **Behoben** (Buttons deaktiviert, "Demo" Label hinzugefügt).

## D. Datenrealität
* **Supabase Echt:** Die Schemas für `orders`, `customers`, `inquiries`, `complaints` existieren und werden z.B. vom `/performance` Modul echt per Action abgefragt.
* **localStorage:** Wird für Drafts (Telefonnotiz) und temporäre States im Warendurchlauf genutzt.
* **mockData:** Wird extrem viel genutzt (`INITIAL_CUSTOMERS`, `INITIAL_ORDERS`), vor allem für Live-Suchen in der Telefonnotiz.

## E. Telefonnotiz-Befund
* **Widerspruch aufgelöst:** Das Übergabeprotokoll hat Recht! Die Migration `0015_mvp_operational_modules.sql` existiert im Repo und legt die Tabelle `phone_notes` (Zeile 52) korrekt an.
* **Persistenzstatus:** Der *aktuelle Bericht* hatte insofern Recht, als dass die UI-Komponente (`KommunikationClient.tsx`) diese Tabelle komplett ignoriert. Es existiert keine Server Action, um Telefonnotizen in die DB zu schreiben, weshalb alles im `localStorage` versickert.
* **Nächster Schritt:** Server Action `createPhoneNote` schreiben und in das Overlay einbinden.

## F. Seed-/Demo-Daten-Konzept
Um die App dem Kunden zu zeigen, ohne seine echten Daten zu verfälschen, brauchen wir eine strikte Seed-Strategie:
* **Tabellen:** `customers`, `orders`, `baths`, `items`, `phone_notes`, `ui_events`.
* **Markierung:** Einführung einer Spalte `tenant_id = 'demo-kreile'` (wird z.T. schon in Migration 0015 genutzt!) oder ein Flag `is_demo = true`.
* **Cleanup:** Ein Skript `npm run db:clean-demo`, das strikt `DELETE FROM orders WHERE tenant_id = 'demo-kreile'` ausführt. Keine echten Daten werden berührt.
* **Risiken:** Wenn die App Live-Eingaben des Kunden während der Demo in den echten Tenant speichert, vermischen sich Daten.
* **Umsetzung:** Ein globales Context-Flag "Demo-Modus" in der App, das bei allen Server-Actions die `tenant_id = 'demo-kreile'` erzwingt.

## G. Empfohlene Reihenfolge für die nächsten 3 Prompts
(Ausschließlich zur Livegang-Stabilisierung!)

1. **"Backend-Anbindung Telefonnotiz & KVP":** (Server Actions für vorhandene Tabelle `phone_notes` bauen und an UI koppeln, damit Daten echt sind).
2. **"Ehrliche Button-Beschriftungen & Kalender-Deaktivierung":** (Tote Buttons ausblenden, Mock-Buttons als "(Demo)" labeln).
3. **"Seed-Skript & Demo-Tenant":** (Saubere Demo-Generierung und Cleanup-Route bauen, um die App gefahrlos testen zu können).
