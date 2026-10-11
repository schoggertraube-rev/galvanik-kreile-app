---
name: w4-gate-no-local-signal
description: Das W4-Read-Port-Gate laeuft nur in quality.yml, nicht in verify:precommit und ohne Unit-Beweistest — daher wiederkehrende "view missing from inventory"-Befunde.
metadata:
  type: project
---

Wiederkehrende Fehlerklasse: Ein Paket stellt einen Server-Port von direktem Drizzle-/Tabellenzugriff auf `private.v_*`-Views um, vergisst aber die Anmeldung in `docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json`. Das Gate meldet dann `W4_READ_PORT_CONTRACT=FAIL ... view missing from inventory`.

**Why:** Es gibt fuer W4 kein lokales Fruehwarnsignal. Stand 2026-09-27 verifiziert: KEIN npm-Script referenziert das Gate (`check-w4-cross-module-read-ports.mjs` wird nur als roher `node ...`-Aufruf in `.github/workflows/quality.yml` gestartet), und `.husky/pre-commit` → `verify:precommit` = `tsc --noEmit && lint:staged && test:unit` deckt es nicht ab. Es existiert auch kein Unit-Beweistest unter `src/test/` — anders als bei der S1-Modulnaht, die mit `src/test/s1_module_gates.test.ts` eine Testabdeckung hat. Der Writer merkt den Bruch also erst in der CI bzw. gar nicht, wenn lokal nur `verify:precommit` laeuft.

**How to apply:** Bei jedem Paket, das einen Read-Port oder eine Migration mit neuen `private.v_*`-Views anfasst, das Gate aktiv selbst ausfuehren (`node scripts/quality/check-w4-cross-module-read-ports.mjs --check`) statt auf gruenes `verify:precommit` zu vertrauen. Als Praevention empfehlenswert: entweder ein `quality:w4-read-ports`-npm-Script plus Aufnahme in `verify:precommit`, oder ein Beweistest analog `s1_module_gates.test.ts`. Verwandt: [[f0-review-manifest-stale-unwired]].

Nuetzlich zu wissen: `migrationContracts` in der Inventardatei ist eine Opt-in-Liste — fehlt ein Eintrag, wird die Migration gar nicht geprueft (Gate bleibt gruen). `readPorts` ist dagegen bidirektional validiert: eine deklarierte View, die der Code nicht liest, faellt als `declared relation missing` durch. Ein Eintrag dort kann also kein Polster sein.

Zweite, unintuitive Bruchquelle (2026-09-28 an B2 reproduziert): das Gate matcht den View-Namen als reinen TEXT ueber die ganze Datei, also auch in JSDoc-/Zeilenkommentaren. Es genuegt, `public.v_<name>` in einem ERKLAERKOMMENTAR einer Datei zu erwaehnen, die nicht als `readPorts`-Eintrag gefuehrt ist (Beispiel: `src/modules/orders/domain/orderTimelinessFacts.ts`, eine DB-freie Domaenendatei) — Ergebnis `undeclared view port public.v_...`, und die Domaenendatei in `readPorts` aufzunehmen waere fachlich falsch. Richtige Korrektur: den Viewnamen im Kommentar ohne `public.`-Praefix schreiben. Ausgenommen sind nur `excludedPathSegments` = `/__tests__/` und `/test/`.

Ebenfalls gepruefte Falle: `validateMigration` verlangt wortwoertlich `CREATE VIEW <view> WITH (security_invoker = true)`. Eine Nachtragsmigration mit `CREATE OR REPLACE VIEW` kann deshalb NICHT in `migrationContracts` aufgenommen werden, ohne das Gate zu brechen — die effektive View-Definition entzieht sich dem Register damit stillschweigend.
