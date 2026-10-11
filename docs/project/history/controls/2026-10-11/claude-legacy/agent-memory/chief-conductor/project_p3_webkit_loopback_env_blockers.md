---
name: project-p3-webkit-loopback-env-blockers
description: P3 browser-matrix recovery — H1 (proxy) und H2 (beforeunload) sind beide falsifiziert; jede Suppression in PermissionsContext ist strukturell unwirksam, weil ein Fehler aus dem Next-Runtime-Chunk kommt
metadata:
  type: project
---

Branch `path1/p3-loopback-gate-recovery-20260919`, base/origin/main
`0e2216d01d22edac765ffd527fa71c50158e25d3`, Kandidat-SHA `73de6562`.

## Zwei falsifizierte Hypothesen — nicht wiederbeleben

- **H1 (2026-09-19) CI-Loopback-Proxy haerten** (`quality.yml`, hop-by-hop-Header):
  Wire-No-Op laut unabhaengiger Review `2a8b34f9-2bc9-4979-81ec-5bccd2a6ec21`. Nie committet.
- **H2 (2026-09-20) `beforeunload`-Fenster in `PermissionsContext`** (`navigationPendingRef` +
  `setTimeout(...,0)`): committet als `73de6562`, Quality-Run `35480055195` auf exakt diesem SHA
  rot. Der Patch hat den Zielfehler **nicht entfernt und die Fehlerflaeche von 1 auf 2 vergroessert**.

## Die strukturelle Erkenntnis (gilt fuer jede kuenftige H3)

Das Gate-Signal ist `expect(browserErrors).toEqual([])` in
`e2e/path1-ui-convergence-v5-p3.real.spec.ts:986` — **nicht** `requestFailures`. `requestFailures`
wird nur geloggt, wenn `browserErrors` bereits nicht leer ist. H1 und H2 haben beide auf das
Log-Signal hin gepatcht statt auf das Assertion-Signal.

Die zwei `browserErrors` stammen aus **zwei verschiedenen JS-Chunks**:

- `...chunks/1s78jujx6ydpf.js:58:6734` → `console.error("Failed to load permissions")`, unser
  `catch` in `PermissionsContext`.
- `...chunks/2up3w12ci8ja-.js:1:100075` → `pageerror`, ungefangene Rejection **aus dem
  Next-Runtime-Chunk**, ausserhalb jedes eigenen `try/catch`.

**Daraus folgt: Fehlerunterdrueckung in `PermissionsContext` kann `browserErrors` niemals leeren.**
Der Fix muss verhindern, dass der Server-Action-Fetch ueberhaupt in-flight ist, wenn die
Navigation das Dokument abraeumt — nicht dessen Rejection schlucken.

## Empfohlene Option O1 (belegt, noch nicht freigegeben)

`getAuthorizationSnapshotAction` (`src/app/actions/auth.actions.ts:47`) liefert exakt
`displayName` + `role` + `permissions` aus `resolveProductActorAuthorization()`. Genau diese
Funktion ruft `getAuthBootstrapState()` (`src/lib/server/authBootstrap.ts`) bei jedem SSR schon
auf — `buildInitialAuthState` wirft die Permissions nur deshalb weg (`PermissionsContext.tsx:40`),
weil `AuthBootstrapState` sie nicht traegt. Permissions in den Bootstrap aufnehmen ⇒ der
Client-POST beim Mount entfaellt ⇒ kein Teardown-Fehler, ein SSOT statt zwei Pfaden, ein
Auth-Roundtrip weniger pro Seitenaufruf. Beide Dateien stehen in `path1_ui_convergence_allowlist`.

## Offene, unbesetzte Spur

3x `{"event":"PRODUCT_ACTOR_READINESS_FAILED","code":"PROFILE_NOT_FOUND"}` im Next-Server-Log —
**identisch in beiden Laeufen**, also kein Pass/Fail-Diskriminator, aber in `e2e/` und
`docs/evidence/path1/` nirgends assertiert oder dokumentiert. Wahrscheinlich die
`curl /start`-Warmup-Probes vor dem `app_users`-INSERT. Muss erklaert und dokumentiert werden,
statt weiter mitzulaufen.

## Repair-Budget

`missions/F1_ORDER_TO_CASH_PILOT_001.yml` → `rules.max_repair_loops_per_gate: 2`. H1 + H2 sind
verbraucht bzw. strittig (H1 nie committet). Ein dritter Korrekturversuch braucht eine
ausdrueckliche Owner-Entscheidung — kein stiller dritter Loop.

## Umgebung

Der Arbeitsbaum ist 2026-09-20 **clean**; die frueher dirty `.github/workflows/quality.yml` ist
nicht mehr offen. Die pfad-skopierte EPERM-Beobachtung (`.github/workflows/**`, `missions/**`
nicht beschreibbar, `src/**` beschreibbar) bleibt als Umgebungsrisiko bestehen — vor einer
Lieferung, die `quality.yml` oder `missions/` anfasst, zuerst pro Verzeichnis mit einem echten
Schreibversuch proben, nie mit `test -w`/`ls`.

Siehe [[feedback_sole_writer_verifier_conflict]], [[project_tsx_userinfo_enomem_blocker]],
[[feedback_stop_gate_rules]].
