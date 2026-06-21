# REIHENFOLGE ALLER PROJEKTE

Strikt getrennt. Nie Inhalte vermischen.

## 1. Galvanik WerkstattCockpit (Priorität)
P0 → Stabilisierung → UI-Redesign → In-App-Assistent → Template. Siehe 01_ROADMAP_GALVANIK.md. Erst wenn Galvanik-Datenmodell und lib-Logik stabil sind, wird das gemeinsame Template extrahiert.

## 2. Evas Lerninsel (nach Template-Stabilisierung)
Fork des gemeinsamen Templates. Website + Praxis-Management (Lerntherapie/Psychomotorik, Heusenstamm). Mockups (Website + Cockpit) und Machbarkeitsstudie (12 Themenblöcke) liegen vor. USP + Twins + CI (Cyan-Petrol #007890, #005670, #003C52, #1A2A5C) neu setzen.

## 3. Hotel Revenue Intelligence (eigener, getrennter Stack)
Separates Repo (C:\hotel-rev-mvp, Express/Vite/Knex + PostgreSQL bzw. Firebase-Variante). NICHT mit Galvanik mischen. Nächster geplanter Schritt: Pricing Engine v1 (regelbasiert). Forecast-/Pricing-Logik nutzt höheren Modell-Tier (T3) und manuellen Trigger gegen Kostenkollaps.

## Template-Logik
Jede verkaufte App ist autark (kein Live-Monorepo zur Laufzeit). Template = forkbarer gemeinsamer Kern. Projektspezifische Begriffe zentral konfigurierbar.
