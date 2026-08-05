# Produktentscheidung: PIN-Sicherheitsstrategie

Stand: 2026-08-04 | Update: 2026-08-05

## Entscheidung

**Dreischichtiger Schutz:** Rate-Limiting + Device-Binding + optionaler Upgrade-Pfad.

## Status der Schichten

| Schicht | Prio | Status | PR |
|---|---|---|---|
| Rate-Limiting (3-Stufen) | P0 | **DONE** | PR #37 (gemergt) |
| bcrypt PIN-Hashing | P0 | **DONE** | PR #37 (gemergt) |
| Plaintext-Migration | P0 | **DONE** | Transparente Migration bei Login |
| Device-Binding | P1 | Offen | — |
| Session-Widerruf | P1 | Offen | — |
| 6-stellige PIN / WebAuthn | P2 | Offen | — |

## Implementierte Details (M4: SEC-PIN-002B)

### bcrypt-Hashing
- PINs werden mit `bcryptjs` (cost factor 10) gehasht
- Legacy-Klartext-PINs werden beim naechsten Login transparent migriert
- Funktion `verifyAndMigratePin()` in `src/app/actions/auth.actions.ts`
- PIN-Werte werden NIEMALS geloggt

### Rate-Limiting
- Tabelle `pin_rate_limits` (Production-Migration angewandt)
- 5 Fehlversuche → 15 Minuten Sperre
- 10 Fehlversuche → 60 Minuten Sperre
- 20 Fehlversuche → permanente Sperre (nur DB-Reset hebt auf)
- Counter wird bei erfolgreichem Login zurueckgesetzt
- Modul: `src/lib/server/pinRateLimit.ts`

### Tests
- 6 loginWithPin-Tests + 5 pinRateLimit-Tests
- Alle 109 Unit-Tests bestanden

## Offene P1-Massnahmen

### Device-Binding
- Browser-Fingerprint bei erstem Login registrieren
- Login von unbekanntem Geraet erfordert Chef-PIN
- Max 3 vertrauenswuerdige Geraete pro Operator

### Session-Widerruf bei PIN-Rotation
- Bei PIN-Aenderung: alle Sessions invalidieren
- Trusted Devices zuruecksetzen
- Audit-Log-Eintrag
