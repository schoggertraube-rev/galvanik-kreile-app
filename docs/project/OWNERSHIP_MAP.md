# Ownership Map — Galvanik Kreile

Stand: 2026-08-04 | Referenz: `MODULARITY_STRATEGY.md`

## Aktuelle Verzeichnisse → Fachliche Domaenen

| Zieldomaene | Aktuelle Verzeichnisse | Wahrheit |
|---|---|---|
| **identity** | `lib/auth/`, `contexts/` (auth-related) | Nutzer, Rolle, Session, Device |
| **customers** | `lib/customers/`, `lib/customerType/`, `features/customers/` | Kunde, Kundenakte |
| **orders** | `lib/orders/`, `features/orders/` | Auftrag, Statusmaschine |
| **intake** | `lib/erfassung/` | Eingang, Behaelter, QR, Capture |
| **production** | `lib/stations/`, `lib/baths/`, `lib/today/` | Teil, Aktion, Station |
| **dispatch** | `lib/quality/` | QS, Ausgang, Reklamation |
| **accounting** | `lib/buchhaltung/`, `lib/payments/`, `lib/costs/`, `lib/pdf/` | Beleg, Rechnung, Zahlung |
| **cockpit** | `lib/analyse/`, `lib/analytics/`, `lib/performance/`, `lib/whatif/`, `features/analyse/` | Read-Models, KPIs |

### Plattform-Dienste

| Plattform | Aktuelle Verzeichnisse | Zweck |
|---|---|---|
| **database** | `db/`, `lib/drizzle/`, `lib/supabase/`, `lib/repositories/` | Schema, Queries, Repos |
| **storage** | `lib/images/` | Fotos, Dokumente |
| **offline** | `lib/offline/` | Outbox, Sync |
| **telemetry** | `lib/diagnostics/`, `lib/tracking/` | Audit, Events |
| **email** | `lib/email/` | Vorlagen, Versand |
| **ai** | `lib/ai/`, `lib/ocr/` | KI-Dienste, OCR |
| **search** | `lib/search/` | Volltextsuche |
| **server** | `lib/server/` | Auth-Middleware, Autorisierung |

## Import-Regeln (CI-enforced)

Folgende Grenzen haben aktuell **0 Verletzungen** und werden per ESLint geblockt:

| Quelle | Darf NICHT importieren von | Grund |
|---|---|---|
| `lib/auth/` | `lib/orders/`, `lib/customers/`, `lib/buchhaltung/`, `lib/erfassung/`, `lib/marketing/` | Identity ist domaenneutral |
| `lib/orders/` | `lib/customers/`, `lib/buchhaltung/` | Auftraege koppeln nicht an Kunden- oder Buchhaltungsdetails |
| `lib/buchhaltung/` | `lib/orders/`, `lib/customers/` | Buchhaltung ist eigenstaendige Domaene |
| `lib/erfassung/` | `lib/buchhaltung/`, `lib/marketing/` | Erfassung kennt keine Finanzen oder Marketing |
| `features/` | `app/actions/` | Feature-Logik darf nicht an Server-Actions koppeln |
| `db/` | `app/`, `lib/` | Schema ist Blatt-Abhaengigkeit |

## Bestehende Verletzungen (Tech Debt)

Folgende Grenzen haben **bestehende Verletzungen**, die nicht sofort behoben
werden. Die Regeln koennen erst aktiviert werden, wenn die Verletzungen
refactored sind.

| Muster | Verletzungen | Schwere | Beschreibung |
|---|---|---|---|
| `components/` → `app/actions/` | 30 Dateien | HOCH | Komponenten importieren Server-Actions direkt |
| `lib/` → `app/` | 14 Dateien | HOCH | Invertierte Abhaengigkeit (Repos importieren Actions) |
| `app/actions/` → `db/schema` direkt | 19 Dateien | MITTEL | Kein Repository-Layer dazwischen |

### Erlaubte Cross-Domain-Imports

Einige lib-zu-lib Imports sind architektonisch korrekt:

- `lib/analytics/` → `lib/buchhaltung/`: Analytics liest Buchhaltungsdaten (Read-Richtung)
- `lib/pdf/` → `lib/orders/`: PDF-Generierung braucht Auftragsdaten
- `lib/repositories/` → `lib/offline/`: Plattform-Abhaengigkeit (Offline-Manager)
- `lib/server/` → `lib/auth/`: Server-Autorisierung braucht Auth-Vertrag
