# Current State

Stand: 2026-06-27

## Lieferwahrheit

- GitHub Default Branch: `main`.
- Vercel Production Branch: `main`.
- Branch Protection: aktiv.
- Required Check: `quality`.
- Letzte verifizierte App-Code-Basis: `797e89dfd87642984a0f36dd570734d6869b36d2` (`LIVE-AUTH-001`).
- PR 1 und PR 2: geschlossen, Branches als Quellenarchiv erhalten.
- Dokumentations-PRs aendern nicht automatisch den fachlichen App-Code-Stand; Git-/Vercel-SHAs sind vor jeder Mutation live zu verifizieren.

## Abgeschlossen oder ausgerollt

- Control Plane mit PR-, CI-, Preview- und Branch-Schutz ist aktiv.
- P0-PIN-Payload-Leak: live behoben; `pinHash` und PIN-Werte werden nicht an den Client ausgeliefert.
- `LIVE-AUTH-001`: per PR 6 gemerged und auf Production ausgerollt.
  - Overlay wird bei Re-Login geschlossen.
  - kanonischer Logout wird verwendet.
  - Navigation erfolgt nach `/start`.
  - automatisierte Tests und Preview waren gruen.
  - realer Ablauf mit tatsaechlich abgelaufener vorher gueltiger Sitzung ist noch vollstaendig zu bestaetigen.

## Aktuelle P0-/Live-Blocker

1. `AUTH-IDENTITY-002`
   - Nach MK-Abmeldung und Admin-Anmeldung kann die UI weiter MK anzeigen.
   - Root Cause: `PermissionsProvider` friert Rolle, Name und Initialen aus dem ersten Layout-Mount ein und aktualisiert bei `refreshPermissions()` nur Permissions/Status.
   - Weitere Identitaetsquellen: App-Session, Supabase-Session, Local Storage und `bypass-auth` muessen gemeinsam geprueft werden.
   - Production enthaelt noch einen Tablet-Test-Login mit Debug-Alert und Bypass-Cookies.

2. `OFFLINE-SHELL-001` / `OFFLINE-48H-001`
   - Ohne WLAN erscheint eine ungestylte oder unvollstaendige App.
   - Aktueller Service Worker cached nicht die vollstaendige App-Shell.
   - Es existieren zwei Service-Worker-Registrierungen.
   - 48-Stunden-Arbeitsfaehigkeit ist nicht nachgewiesen.

3. `APP-0001D`
   - Kamera-Icon im Header startet `mode: scan` und damit den Dokument-/Dateiupload.
   - Echte Kameraaufnahme, Dokument-Upload, OCR und Teile-/Zustandsfoto sind noch nicht sauber getrennt.

## Salvage-Quellen

- Urspruenglicher Dirty-Worktree:
  - Branch `feature/capture-auth-tenant`.
  - bekannter HEAD `0e87cf65c69d50ed50977ac1b20dffba8485f047`.
  - unveraendert erhalten und ohne Freigabe read-only.
- Offline-Diagnose:
  - Branch `diagnose/auth-session-permissions-2026-06-17`.
  - bekannter HEAD `1621702`.
  - enthaelt bessere Service-Worker-/Offline-Shell-Arbeit.
- Im Dirty-Worktree liegt nicht versionierte Capture-/Foto-/Testarbeit, darunter Auth-/Tenant-Pruefung, `item_photos`-Vertrag, Upload-Haertung und umfangreiche Tests.
- Keine dieser Quellen ist Lieferwahrheit; Verwertung erfolgt ueber neue kleine PRs.

## Naechste Schritte

1. `PLAN-SYNC-001` mergen: Dokumentenautoritaet, aktuelle Reihenfolge und Non-Loss-Register.
2. `AUTH-IDENTITY-002` als naechste Code-Mission.
3. Danach `OFFLINE-SHELL-001` und `OFFLINE-48H-001`.
4. Danach `SEC-PIN-002`.
5. Anschliessend Capture-/OCR-/Wareneingangsfolge gemaess `MASTERPLAN.md`.

## Nicht erlaubt

- Dirty-Worktree resetten, staschen, bereinigen oder pauschal mergen.
- alte Governance-/Masterplan-Dateien als aktuelle Lieferentscheidung verwenden.
- Remote-Supabase-Migration, RLS-Aenderung, Production-Promotion oder Dateiloeschung ohne ausdrueckliche Freigabe.
