---
name: turbopack-next-font-flaky-build
description: "`npm run build` kippt in diesem Repo sporadisch mit dem next/font/google-Turbopack-Fehler (Fraunces in src/app/layout.tsx); ein einzelner gruener Build beweist nichts."
metadata:
  type: project
---

`npm.cmd run build` (Next 16.2.12, Turbopack) faellt in diesem Repo **intermittierend** mit
`next/font/google queries have exactly one entry` /
`<NextFontGoogleFontFileReplacer as ImportMappingReplacement>::result failed` /
`*AssetContext::process_resolve_result failed` aus. Betroffen war ausschliesslich `Fraunces`
aus `src/app/layout.tsx` (18 Turbopack-Fehler), nicht `Inter`/`Geist_Mono` und nicht
`src/app/telefonnotiz/layout.tsx`.

Belegt am 2026-09-28 durch 4 aufeinanderfolgende Builds auf derselben Maschine:
Build 1 (Quellstand A) gruen, Build 2 (Quellstand B) gruen, Build 3 (Quellstand A, byte-identisch
zu Build 1) ROT mit exakt dieser Signatur, Build 4 (Quellstand A, unveraendert) wieder gruen.
Gleiche Quelle -> mal gruen, mal rot. Die Fehlermeldung stammt aus dem nativen next-swc-Binary,
nicht aus `node_modules/next/dist` (dort nicht auffindbar).

**Why:** Der Fehler ist NICHT quellcodeabhaengig. Er haengt am Turbopack-/Font-Cache bzw. am
Netzabruf gegen fonts.gstatic.com. Wer ihn mit einer Quellcode-Aenderung "behebt" und einen
gruenen Build zeigt, hat nur eine gluecklich gezogene Stichprobe.

**How to apply:** (1) Einen ROT-Bericht zu dieser Signatur niemals mit *einem* gruenen Build
widerlegen — mindestens 3 Laeufe, sonst Ergebnis als OPEN/nicht-reproduzierbar melden statt als
PASS. (2) Umgekehrt beweist ein einzelner roter Lauf keinen Quellcodefehler. (3) Ein
Kontrollbuild mit temporaer wiederhergestelltem Altzustand ist nur aussagekraeftig, wenn der
Neuzustand mehrfach dagegen gebaut wird. Siehe auch [[runner-report-staleness]].
