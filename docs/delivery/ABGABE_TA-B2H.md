# TA-B2h – Web-Share und Nachrichten, P44/P47

Basis: `main` / `6ce527da70bdf5a9b6104226af7bb1cafa92864d` (#165). Eigener Anker-Branch `codex/ta-b2h`, Owner-Freigaben P44 vom 03.11., 22:05 und P47 vom 04.11., 03:35. Derselbe PR #172 wird ergänzt; kein neuer Anker und kein Produktcode.

Die B2-Allowlist erhält ausschließlich vier exakte Pfade:

- `src/app/api/eingang-share/route.ts`
- `src/test/eingang_share.integration.test.ts`
- `src/app/nachrichten/page.tsx`
- `src/test/nachrichten_page.integration.test.ts`

Der spätere POST verwendet die vorhandene App-Sitzung und den vorhandenen Original-Schreibweg. Die Nachrichten-Seite ist der kanonische Einstieg in 2.3, mit Test gegen die echte Replay-DB. Dieser Anker baut weder diese Einstiege noch einen Dateispeicher, Provider oder Schreibweg. Die unmittelbaren P44/P47-Freigaben bestimmen die Routen; die Testpfade sind ihre exakten technischen Ablagen. Neue Globs, Nachbarseiten und zusätzliche API-Routen bleiben gesperrt.

Der Anker selbst ist auf vier Dateien, den freigegebenen Main-SHA, Branch und die unveränderte B2-Mission begrenzt: Scope-Checker, dessen bestehender Test, `docs/evidence/live-line/b2/TRUST_ANCHOR_B2H.json` und diese Abgabe. Benachbarte API-/Testpfade bleiben gesperrt. Kein Workflow, keine Baseline, kein anderer Checker, keine Planungs- oder UI-Quelldatei wird geändert.

Probe: kompletter Teil-4-Stand `ad87b66b7f4281aa3a13b439171b0e82eabc273a` (206 Pfade) plus alle vier neuen Pfade gegen den neuen Checker: **PASS**, `newErrors: []`. Der unveränderte Main-Checker lehnt genau die vier neuen Pfade mit `SALES_STAGE_B2_SCOPE` ab. Originaler Bauplan bleibt SHA-256 `DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4`. Beleg: .git/kreile-ta-b2h-p47-probe.json.

Lokale Prüfung:

| Prüfung | Ergebnis |
|---|---|
| Scope-Selbsttest einschließlich aller vier neuen Pfade und negativer Nachbarpfade | PASS |
| Bestehende Scope-Tests einschließlich drei neuer P44-Fälle | 22/22 PASS |
| A11: Authority/Delivery mit Selbsttests, Live-Regressions-Selbsttest, Module, H18, H16, No-Fake, F0-Dokument-/Schema-Verträge, Supabase-Grenze, Advance/Close | PASS |
| `git diff --check origin/main` | leer / PASS |
| `npm run lint:full` | PASS |
| `npx tsc --noEmit --incremental false` | PASS nach Neugenerieren der lokalen Next-Routentypen |
| Vollsuite | gemäß Owner-Freigabe parallel in CI |

Umgebungsbefund beim Branchwechsel: `.next/types/validator.ts` enthielt noch die Produkt-Routen `/rein` und `/api/device-file-changes`, die auf Main noch fehlen. `npx next typegen` hat ausschließlich die ignorierten generierten Routentypen erneuert; der anschließende identische Typprüfbefehl besteht. Keine `tsconfig`-/Produktänderung.

Vor Merge: alle PR-Jobs mit Schritt und Fehlerzeile prüfen. Ein selbstreferenzieller Ratchet-Befund wird belegt gemeldet; keine weitere Hash-/Baseline-Anpassung ist enthalten. Main-Lauf nach Owner-Merge erforderlich. Kein Merge durch Codex.
