# TA-B2k1 · enger Pfad-Anker für offene Runde-52-Teile

Basis: `origin/main` `ce762422266089d694a12a94fe2129095003e82e` nach Owner-Merge von #168. Dieser Anker enthält ausschließlich Scope-Checker, dessen Tests, den Ankerbeleg und diese Abgabe. Er enthält keinen Produktcode, keine Migration und keine Bindung der Runde 53.

P68 erlaubt genau diese Folgepfade für die bestehenden, bereits gestapelten Runde-52-Teile:

- Stationsbefehl-Test: `src/lib/server/commands/__tests__/orderStationCommand.test.ts`
- Druckweg: `src/app/actions/pdf.actions.ts`, `src/lib/pdf/OrderLabel.tsx`, `src/lib/pdf/__tests__/w2cB2m5u.orderLabelDateTruth.test.tsx`
- Nacharbeit: `src/modules/orders/server/reworkOrderCommand.ts`, `src/modules/orders/server/__tests__/reworkOrderCommand.test.ts`, `src/modules/orders/server-public.ts`, `src/modules/orders/orders.manifest.json`

Der Scope-Test erlaubt jeden dieser acht Pfade und weist einen benachbarten Befehl zurück. Der Anker selbst ist auf seine vier Nachweisdateien, den Branch `codex/ta-b2k1` und die oben genannte Main-Basis festgelegt. Die Prüfung bestätigt außerdem, dass `BAUPLAN.json` in diesem Anker nicht zulässig ist: Runde 53 folgt ausschließlich mit TA-B2k2 nach den offenen Runde-52-Merges.

DB-Soll: keine Datenänderung. Kein Merge und kein Production-Deploy durch Codex.
