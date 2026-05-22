# Phase 5: Autonomer Wareneingang (Kamera & OCR-Assistent)

Ziel dieser Phase ist die Umsetzung des Wareneingangs als tablet-optimierter, geführter Kamera-Assistent, ohne dabei bereits eine Live-Datenbank (Postgres/Supabase) fest anzubinden. Die Datenzugriffsschicht wird durch Repositories abstrahiert.

## User Review Required

> [!IMPORTANT]
> - Der gesamte Workflow wird vorerst auf **Mockdaten/LocalStorage** aufbauen, um die Demo-Fähigkeit ohne Datenbank-Abhängigkeit voll funktionsfähig zu machen. 
> - Die vorgeschlagene Trennung in Repositories (Datenzugriff) und Services (Business Logic) bereitet den perfekten, schmerzfreien Austausch auf Supabase in der Zukunft vor.

## Open Questions

> [!TIP]
> - Um den Demo-Modus stabil zu halten, werde ich in den Repositories `localStorage` als Persistenz-Layer für den Browser verwenden. Bist du einverstanden, dass die erzeugten Aufträge dort zwischengespeichert werden, damit sie auf der Startseite sichtbar sind?

## Proposed Changes

### 1. Data Abstraction Layer (Repositories)
Wir schaffen eine saubere Kapselung, die aktuell gegen LocalStorage arbeitet und später das Drizzle-Schema nutzt.
- **[NEW] `src/lib/repositories/customersRepository.ts`**: Lesen, Erstellen und Matchen von Kunden.
- **[NEW] `src/lib/repositories/ordersRepository.ts`**: Speichern der neuen Aufträge.
- **[NEW] `src/lib/repositories/itemsRepository.ts`**: Speichern der erfassten Teile.
- **[NEW] `src/lib/repositories/eventsRepository.ts`**: Protokollieren der geforderten `StatusEvents`.

### 2. Business Logic (Services)
- **[NEW] `src/lib/services/ocrService.ts`**: Simuliert einen OCR-Scan. Liefert Fake-Daten mit `confidence`-Werten zurück (z. B. 0.9 für sicher, 0.65 für gelb/unsicher).
- **[NEW] `src/lib/services/intakeService.ts`**: Orchestriert den Workflow. Verbindet Kunde, Auftrag, Teile und feuert automatisch Events (`OCR_SCAN_STARTED`, `ORDER_CREATED`, `INTAKE_COMPLETED`).
- **[NEW] `src/lib/services/photoService.ts` & `labelService.ts`**: Dummys für Dateiablage- und Etikettendruck-Logik.

### 3. UI-Komponenten (`src/components/intake/*`)
- **[NEW] `IntakeEntry.tsx`**: Der Startbildschirm mit den 2 großen Optionen (Kamera / Manuell).
- **[NEW] `CameraCapture.tsx`**: Vollbild-Kamerasimulation.
- **[NEW] `OCRReviewPanel.tsx`**: Zeigt die OCR-Ergebnisse an. Felder mit `< 0.85` Confidence werden farblich (gelb/orange) markiert und fordern den Nutzer zur manuellen Prüfung auf.
- **[NEW] `CustomerMatchPanel.tsx`**: UI, um den erkannten Text einem Bestandskunden zuzuordnen oder einen neuen anzulegen.
- **[NEW] `SuggestedItemsPanel.tsx`**: Schnelle Erfassung der Teile und Zuweisung von Fotos.
- **[NEW] `IntakeCompletionSummary.tsx`**: Checkliste am Ende (Zusammenfassung).

### 4. Routing & Container
- **[MODIFY] `src/app/orders/new/page.tsx`**: Wird der zentrale Wizard-Container, der den State (Schritt 1 bis 5) steuert und die neuen Komponenten zusammenführt.

## Verification Plan

### Automatisierte Tests
- `tsc --noEmit` & Linter für die saubere Typisierung von Services und Repositories.

### Manuelle Tests (Demo-Workflow)
- Klick auf "Wareneingang" öffnet die Entry-Ansicht (Kamera/Manuell).
- Auslösung der Kamera-Simulation führt zum OCR-Review.
- *Unsichere Felder (z.B. schwer lesbare Hausnummer)* leuchten gelb.
- Das Abschließen des Wizards erzeugt einen Auftrag im LocalStorage.
- Die Startseite zeigt nach dem Workflow den neuen Auftrag bei den "aktiven Aufträgen" an.
