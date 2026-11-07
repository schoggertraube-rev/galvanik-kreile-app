# REVIEW H13 – Stille Ersatzwerte

Prüfer: Claude, 28.10.2026 21:27 UTC (22:27 Berlin)
Stand: `docs/delivery/ABGABE_H13.md` + H13.3-Änderungen **gestaged, nicht committet** (HEAD 2e064eac, origin 5a090dc0; 9 lokale Commits ungepusht).

## Urteil: keine Blocker, kein PASS (vorläufig)

H13.3 inhaltlich ohne Blocker. PASS erst, wenn H13.3 als eigener Commit vorliegt (Regel „je Unterpunkt ein Commit“). H13 insgesamt unvollständig: H13.1 und H13.2 regelkonform nach einem Fixversuch zurückgenommen, Rückfragen in `docs/project/endversion/codex/RUECKFRAGEN_H13.md` → Entscheid Owner/Planungschat, kein Codex-Auftrag durch den Prüfer.

## Geprüft (H13.3)

- `src/lib/server/authorization.ts:104-193`: `resolveAuthorization()` fängt Sitzungs- und DB-Fehler selbst ab (try/catch) und wirft nicht → Entfernen von `.catch(() => null)` ist sicher, keine unbehandelte Ausnahme. DB-Fehler jetzt `AUTH_DB_ERROR: …`, Sitzungsfehler `AUTH_SESSION_ERROR: …`.
- 13 Produktpfade (communications, customers, invoices, intakeDraft, warendurchlauf, invoiceItemPrice, orderContent, orderIntake, InvoicesAppAdapter, permissions) reichen `authorization.message` durch. Keine Rechte-Lockerung: alle `perm_*`/Bereichs-Prüfungen unverändert.
- Keine Migration, keine Datenzeile, keine verbotene Datei, keine Farbe.

## Nicht als FAIL (→ DEZEMBER_LISTE)

- `src/lib/auth/permissions.ts:10-53`: Helfer (`isAdminOrDeveloper`, `hasPermission`, `getUserPermissions`) werten einen DB-Fehler weiter still als „kein Recht“ bzw. Redirect „/“ – kein Code sichtbar.

## Hinweis Schleifen

H13.1 und H13.2 wurden nicht wegen Fachfehlern zurückgenommen, sondern weil der vollständige Commit-Check an der 10-Minuten-Grenze hängt (H13.1) bzw. eine einzelne Test-Fixture fehlte (H13.2, `invoiceTermsEnabled`). Regeln eingehalten (ein Fixversuch, dann zurück), aber zwei fertige Patches liegen ungenutzt. Ursache Werkzeug (siehe DEZEMBER_LISTE 17:30 UTC).
