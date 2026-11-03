# TA-B2h – Web-Share-Einstieg, P44

Basis: `main` / `6ce527da70bdf5a9b6104226af7bb1cafa92864d` (#165). Eigener Anker-Branch `codex/ta-b2h`, Owner-Freigabe P44 vom 03.11., 22:05 und direkter Folgeauftrag. Kein Produktcode in diesem PR.

Die B2-Allowlist erhält ausschließlich zwei exakte Pfade:

- `src/app/api/eingang-share/route.ts`
- `src/test/eingang_share.integration.test.ts`

Der spätere POST verwendet die vorhandene App-Sitzung und den vorhandenen Original-Schreibweg. Dieser Anker baut weder die Route noch einen weiteren Dateispeicher, Provider oder Schreibweg. Die Datei `TRUST_ANCHOR_B2H.md` liegt beim Anlegen des Ankers nicht vor; die unmittelbare P44-Freigabe bestimmt die beiden Pfade. Der Testpfad ist die exakte technische Ablage des dort verlangten Integrationstests.

Der Anker selbst ist auf vier Dateien, den freigegebenen Main-SHA, Branch und die unveränderte B2-Mission begrenzt: Scope-Checker, dessen bestehender Test, `docs/evidence/live-line/b2/TRUST_ANCHOR_B2H.json` und diese Abgabe. Benachbarte API-/Testpfade bleiben gesperrt. Kein Workflow, keine Baseline, kein anderer Checker, keine Planungs- oder UI-Quelldatei wird geändert.

Probe: kompletter Teil-3-Stand `ecd08fcbcab7402a6e3ed0eb6d34510473c0f1e2` (185 Pfade) plus beide neuen Pfade gegen den neuen Checker: **PASS**, `newErrors: []`. Der unveränderte Basis-Checker lehnt genau beide neuen Pfade mit `SALES_STAGE_B2_SCOPE` ab. Originaler Bauplan bleibt SHA-256 `DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4`.

Lokale Prüfung:

| Prüfung | Ergebnis |
|---|---|
| Scope-Selbsttest einschließlich beider neuer Pfade und negativer Nachbarpfade | PASS |
| Bestehende Scope-Tests einschließlich drei neuer P44-Fälle | 22/22 PASS |
| A11: Authority/Delivery mit Selbsttests, Live-Regressions-Selbsttest, Module, H18, H16, No-Fake, F0-Dokument-/Schema-Verträge, Supabase-Grenze, Advance/Close | PASS |
| `git diff --check origin/main` | leer / PASS |
| `npm run lint:full` | PASS |
| `npx tsc --noEmit --incremental false` | PASS nach Neugenerieren der lokalen Next-Routentypen |
| Vollsuite | gemäß Owner-Freigabe parallel in CI |

Umgebungsbefund beim Branchwechsel: `.next/types/validator.ts` enthielt noch die Produkt-Routen `/rein` und `/api/device-file-changes`, die auf Main noch fehlen. `npx next typegen` hat ausschließlich die ignorierten generierten Routentypen erneuert; der anschließende identische Typprüfbefehl besteht. Keine `tsconfig`-/Produktänderung.

Vor Merge: alle PR-Jobs mit Schritt und Fehlerzeile prüfen. Ein selbstreferenzieller Ratchet-Befund wird belegt gemeldet; keine weitere Hash-/Baseline-Anpassung ist enthalten. Main-Lauf nach Owner-Merge erforderlich. Kein Merge durch Codex.
