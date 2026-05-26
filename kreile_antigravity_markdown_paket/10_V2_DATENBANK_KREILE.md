# Kreile WerkstattCockpit — Phase V2 (Datenbank & Backend)

> **Status: VORSCHAU (Nach MVP-Demo)**
>
> Diese Datei dient als Ausgangspunkt für die nächste Iterationsstufe (V2) des WerkstattCockpits. Das Ziel dieser Phase ist die Ablösung der LocalStorage-Mockdaten durch ein echtes Cloud-Backend (Supabase).

## 1. Ausgangslage

Die MVP-Phase (Sessions 1-3) wurde erfolgreich abgeschlossen. Die Applikation verfügt über ein komplettes Frontend in Next.js 14, umfangreiche Mockdaten, Routing, Formulare und Offline-First-Konzepte (Dexie/IndexedDB Queue).
Da wir im MVP vollständig typisierte Repository-Muster (`src/lib/repositories`) eingeführt haben, ist die Architektur optimal für einen sanften Austausch der Datenquelle vorbereitet.

## 2. Zielsetzung V2

- **Supabase-Projekt anlegen:** Initialisierung in der Region EU-West (Frankfurt).
- **Drizzle ORM:** Schema-Definition auf Basis unserer aktuellen Typen (`Order`, `Customer`, `StatusEvent` etc.).
- **Schrittweise Ablösung:** Repositories (`ordersRepository` etc.) rufen nicht mehr `mockData.ts` auf, sondern das Backend.
- **Auth & RLS:** Nutzer-Login und Row Level Security (RLS) aktivieren.
- **Echte APIs:** Anbindung von Google Cloud Vision für die tatsächliche OCR-Auslesung des Fotos.

## 3. Umsetzungsstrategie

1. **Session 4:** Supabase Setup, Drizzle Schema, Migrationen, Seed-Skript bauen (gleiche Mockdaten wie bisher, aber in SQL).
2. **Session 5:** Umstellung Repositories: `customersRepository` und `ordersRepository`.
3. **Session 6:** Auth, RLS-Policies und Umstellung der Events/Complaints.
4. **Session 7:** Backend-Routen für Bild-Upload (Supabase Storage) und OCR (Google Vision).

## 4. Offene Fragen vor V2

- Wurden alle Anforderungen der MVP-Demo freigegeben?
- Existiert bereits ein Supabase-Account für Kreile?
- Wie lautet der Google Cloud API-Key für die Vision API?
