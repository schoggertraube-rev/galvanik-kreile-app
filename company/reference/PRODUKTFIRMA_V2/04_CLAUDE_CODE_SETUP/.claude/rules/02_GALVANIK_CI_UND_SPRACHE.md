# GALVANIK — CI-TOKENS & SPRACHE

## Farben
| Token | Hex |
|---|---|
| Cream | #F1E9DC |
| Surface | #FBF6ED |
| Navy | #1A1F2E |
| Magenta | #C2185B |
| Success | #4F8F58 |
| Warning | #D89A2C |
| Danger | #B0413E |

Gradient: `linear-gradient(115deg,#7A3FB0,#C2185B 38%,#F2643C 72%,#F6A93B)`

## Typografie
- **Fraunces** (serif): Auftragsnummern, Namen, Beträge.
- **Inter**: Fließtext.
- Card-Radius: 18px.

## Regeln
- **Keine hartkodierten Hex-Werte** im Code — immer CI-Tokens referenzieren.
- **Keine englischen Labels** in der deutschen UI.
- Verifizierte Spaltennamen verwenden: `promised_due_date`, `completed_date`, `current_station_id`, Station-Events UPPERCASE (`STATION_EINGANG`, `STATION_AUSGANG`), `arbeitszeit_buchung.auftrag_id` (nicht `order_id`).
- Bekannte fehlende FKs (anlegen, nicht vertagen): `ausgangsrechnung.order_id`; `inventory_items.einkaufspreis_eur`, `inventory_items.tenant_id`.

## Stack
Next.js App Router · TypeScript · Supabase/Postgres · Drizzle · Recharts · Framer Motion · PWA · Vercel · Gemini Vision (OCR) · Klippa (primär) / Eagle Doc (Fallback) · Mollie (Payments).
