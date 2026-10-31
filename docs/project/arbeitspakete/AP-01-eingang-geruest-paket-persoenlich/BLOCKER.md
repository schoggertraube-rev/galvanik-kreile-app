# BLOCKER AP-01 – Paket ist gegen die geschützten Main-Gates nicht ausführbar

Stand: 2026-10-31
Branch: `kreile/s1-ap01-eingang`
Main-Basis: `ae79c12fb6bea83b8ac68fa065af4671f4bf09b5`

## Ergebnis

`AP-01` kann in der gelieferten Fassung nicht mit grüner CI umgesetzt werden. Es wurden noch kein Produktcode, keine Produktmigration und keine Dev-Daten geändert.

## 1. Geschützter Paket-Scope kennt AP-01 nicht

Der auf `origin/main` geschützte Checker `scripts/quality/check-live-package-scope.mjs` akzeptiert als Verkaufsstufen-Branch ausschließlich `kreile/b1-shell` und dessen alte B1-Allowlist. Der vom Owner geforderte neue Branch und schon der reine Planungscommit werden abgelehnt:

```text
SALES_STAGE_BRANCH_INVALID:kreile/s1-ap01-eingang
SALES_STAGE_B1_SCOPE:_review/AKTUELLE_ANWEISUNG.md
SALES_STAGE_B1_SCOPE:docs/project/arbeitspakete/...
```

Die geschützte CI führt die Checker-Fassung der Main-Basis gegen den Kandidaten aus (`.github/workflows/eslint-ratchet.yml`, Schritt „Enforce protected active-package scope and commit roles“). Eine Änderung des Checkers innerhalb AP-01 könnte die Sperre deshalb nicht beheben und wäre außerdem kein Produktumfang von AP-01.

## 2. Verlangter Action-Pfad widerspricht dem geschützten Modul-Gate

Das Paket verlangt gleichzeitig:

- das manifestierte Modul `src/modules/eingang/`, und
- die Server-Action unter `src/app/eingang/actions.ts` (der unveränderliche Akzeptanztest importiert exakt `@/app/eingang/actions`).

Das geschützte Main-Gate `scripts/quality/check-module-gates.mjs` verbietet für ein manifestiertes Fach jeden gleichnamigen Pfad außerhalb `src/modules/<fach>/`. Unter `src/app/<fach>/` erlaubt es nur Next-Kompositionsdateien (`page`, `layout`, `loading`, `error`, `not-found`) oder einen `*AppAdapter.tsx`; `actions.ts` wird ausdrücklich nicht akzeptiert. Auch dieses Gate läuft in `eslint-ratchet.yml` als Main-Basis-Skript gegen den Kandidaten und kann in AP-01 nicht umgangen werden.

## 3. Geforderte Ein-Transaktions-Kette ist mit dem unveränderten Command nicht möglich

`PAKET.md` verlangt, dass die neue Eingang-Action in **einer** Transaktion `intake_item`, den Auftrag über `createOrderIntake` und `intake_event` schreibt. Gleichzeitig sind `createOrderIntake` und `order_intake_receipts` als „nicht anfassen“ festgelegt.

Der vorhandene `createOrderIntake` öffnet selbst über `withPrivilegedTenantTransaction(...)` eine eigene Transaktion (`src/lib/server/commands/orderIntakeCommand.ts`). Er nimmt keinen bestehenden Transaktionskontext entgegen. Ein äußerer Eingang-Command kann seine eigenen Inserts daher nicht atomar in dieselbe Transaktion legen, ohne den bestehenden Command um eine interne, transaktionsgebundene Naht zu erweitern.

## Erforderliche Korrektur – eine empfohlene Lösung

Vor dem Bau wird ein enges Trust-Anchor-/Paket-Amendment auf `main` freigegeben und gemergt, das zusammenhängend:

1. den geschützten Paket-Scope um genau Branch und Pfade von AP-01 erweitert,
2. den Action-Vertrag auf den bereits gate-konformen Pfad `src/app/actions/eingang.actions.ts` umstellt und den unveränderlichen Akzeptanztest mit neuem SHA-256 neu ausgibt,
3. in `PAKET.md` eine interne transaktionsgebundene Naht des bestehenden `createOrderIntake` erlaubt; beide Aufrufe verwenden danach denselben Order-Writer-Kern, es entsteht kein zweiter SQL-Schreibweg.

Wesentlicher Nachteil: Das Amendment berührt einen geschützten Checker und den bestehenden Order-Command, bevor AP-01 gebaut werden kann. Ohne diese Korrektur wären grüne CI oder echte Atomarität nur durch Regelumgehung beziehungsweise eine zweite Wahrheit vortäuschbar.

Nach Merge dieses Amendments muss AP-01 auf einem frischen Branch aus dem neuen `origin/main` neu begonnen werden. Der Planungscommit `215ced0da296bb729aa9ca8b8ef2242c1fccee98` ist dann nur Herkunftsnachweis und keine Produktbasis.
