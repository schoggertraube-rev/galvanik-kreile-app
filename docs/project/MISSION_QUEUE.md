# Mission Queue

Stand: 2026-08-05 — korrigiert nach Live-Audit

## Abgeschlossen und belegt

| ID | Ergebnis |
|---|---|
| `TRUTH-CLEANUP-001` | Kanonische Lieferquelle und Branch-Disposition hergestellt. |
| `QUALITY-RATCHET-001` | Geschuetzter Quality-/Ratchet-Vertrag aktiv. |
| `LINT-DEBT-001` | PR #31, ESLint 0/0. |
| `AUTH-IDENTITY-002` | PR #33, atomarer Auth-State ohne localStorage-Identitaet. |
| `APP-STRUCTURE-001-A` | PR #36, erste Ownership-/Importregeln; Gesamtmission bleibt partiell. |

## Aktiv

### `FOUNDATION-RECOVERY-001` — nur die verifizierten Luecken

**Prioritaet:** P0
**Status:** isolierter Kandidat; kein Merge, Deploy oder Remote-DB-Write

Akzeptanz:

1. Production-Ledger mit exakten Versionen, Namen und Hashes pruefen.
2. Ledger-Vertrag tatsaechlich in CI ausfuehren.
3. Falsch versionierte PIN-Migration an Production angleichen und nicht angewandte
   RLS-Datei aus dem automatischen Pfad quarantainieren.
4. Direkte Browserzugriffe auf die 26 offenen Tabellen entfernen.
5. `anon`/`authenticated`-Grants als separate, noch nicht angewandte Migration entziehen.
6. PIN-Race, Klartext-Neuschreibpfade, Bestandsrotation und Session-Widerruf schliessen.
7. Namen, Rollen und UUIDs aus dem oeffentlichen Start-Payload entfernen.
8. Vollstaendige Gates, Draft-PR, Preview und unabhaengige Review.

## Danach

| Reihenfolge | ID | Status / Grenze |
|---:|---|---|
| 1 | `FOUNDATION-RECOVERY-001` | Kandidat pruefen; Production bleibt bis Freigabe unveraendert. |
| 2 | `RLS-CONTRACT-001` | Relationenspezifische Matrix und negative Tests; keine pauschale Policy. |
| 3 | `SEC-PIN-DEVICE-001` | Device-Challenge nach Produktentscheidung. |
| 4 | `OFFLINE-SHELL-001` | Eine sichere Offline-Shell und eine Registrierungswahrheit. |
| 5 | `APP-STRUCTURE-001-B` | Verbleibender Vertrag, keine Ordner-Grossoperation. |
| 6 | `OPERATIVE-SLICE-001` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Aktion -> Today -> Receipt -> Reload. |
| 7 | `OFFLINE-48H-001` | Derselbe Kernweg ueber eine Outbox mit Restart-, Idempotenz- und Konfliktnachweis. |

## Freigabepunkte

- Merge nach `main`: separat.
- Vercel Production: separat.
- Remote-Supabase-Migrationen: separat und in Reihenfolge Grant-Entzug, PIN-Bestand,
  danach Postflight.
- RLS-/Policy-Aenderungen: eigene Mission und separate Freigabe.
