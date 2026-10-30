# Galvanik-Kreile WerkstattCockpit — verbindliche Baulinie

Bis auf Widerruf des Owners steuert `_review/AKTUELLE_ANWEISUNG.md` (Warteschlange)
Reihenfolge, Branch, Nachweis und Abgabe. Bei Widerspruch gilt sie vor Abschnitt 1, 4 und 7.

## 1. Einziger Arbeitsort und einzige Lieferwahrheit

- Repository: dieses Checkout `02_app`; keine weiteren Clones oder Worktrees.
- Lieferwahrheit: `origin/main`.
- Vor jedem Paket: `git fetch origin`, sauberer Baum, Branch aus frischem `origin/main`.
- Kein Merge nach `main`, Production-Effekt, Remote-Migration, RLS-/Rollen-/Session-Aenderung,
  Echtdatenmutation oder kostenpflichtiger Dienst ohne ausdrueckliche Owner-Freigabe.

## 2. Geschlossener aktiver Kontext

PL, Writer und Reviewer verwenden fuer die Ausfuehrung nur:

1. `AGENTS.md`
2. `docs/delivery/KREILE_VERKAUFSSTUFE_1.md`
3. `missions/F1_ORDER_TO_CASH_PILOT_001.yml`
4. die Routen, Ziele und Abgabesaetze des aktiven Blocks
5. `docs/project/linie/MODULKARTE_KANON.md`
6. `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md`
7. `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md`
8. fuer visuelle Pakete ausschliesslich die in `docs/project/linie/00_UI_REFERENZEN_PFADE.md`
   geschichteten Quellen.

`docs/project/history/**`, alte Paketmanifeste, Rolling Queues, externe Paketplaene,
alte Gesamtmocks und Alt-PRs sind nicht ausfuehrbar und werden weder als Auftrag noch
als Abnahmequelle gelesen. Fehlt eine Aussage im aktiven Paket, entscheidet der PL nur
gewoehnliche Implementierungsdetails innerhalb bestehender Struktur. Nur eine wirklich
neue dauerhafte Produkt-, Daten-, Provider-, Auth-/Rollen-/Session- oder Modulentscheidung
geht mit genau einer konkreten Frage an den Owner.

`docs/delivery/KREILE_LIVE_PLAN_V1.json` und D-GOV-004 sind seit der
Owner-Rebaseline vom 25.10.2026 ausschliesslich historischer Nachweis und nicht
ausfuehrbar. Bei Widerspruch mit dem alten Paketablauf bestimmt
`docs/delivery/KREILE_VERKAUFSSTUFE_1.md` den aktiven Block, Branch, Zeitrahmen und
die Abgabe. Fuer die dort bezeichneten ausgegrauten Anschluss-Stellen ersetzt der
neue Plan das fruehere absolute Verbot von „kommt bald“-Flaechen; ausserhalb dieser
ausdruecklichen Liste bleibt das Verbot bestehen.

Diese Grenze ist nicht nur Text: `.claude/settings.json` sperrt den direkten Lesezugriff
auf Altquellen und auf Pfade ausserhalb des Repositorys. Alte Projekt-Agenten, Skills,
Memories und Stop-Hooks liegen ausschliesslich unter `docs/project/history/**`; im aktiven
`.claude`-Bereich existiert nur die restriktive Settings-Datei.

## 3. Rollen ohne Ueberlappung

- PL: besitzt Laufzeiger, roten Akzeptanztest und Receipts; schreibt keinen Produktcode.
- Writer: bei `kind: BUILD` genau einer; aendert nur `editablePaths`; darf Test, Plan,
  Mission und Receipts nicht aendern. Bei `kind: GATE` gibt es keinen Writer und keine
  Produktpfadaenderung.
- Reviewer: unabhaengig von PL und Writer; prueft den exakten Kandidaten-SHA.
- Koordinator: ueberwacht Reihenfolge, Prozessleben, Drift und Nachweise; schreibt keinen
  Produktcode und ersetzt weder PL noch Writer.

Die Commitfolge wird maschinell erzwungen: zuerst ein reiner PL-Preflight-Commit,
danach reine Writer-Produktcommits, zuletzt reine PL-Abnahme-/Statuscommits. Kein Commit
darf Rollen mischen.

## 4. Paketablauf

1. PL liest nur das aktive Paket und erstellt dessen `focusedSpec` plus
   `docs/evidence/live-line/<paket>/PREFLIGHT.md`.
   Die auslegungsfreie Projektion liefert `npm run live:package`.
2. Bei BUILD muss der Test auf dem unveraenderten Paket-Base ausschliesslich wegen der
   neuen Produktassertion rot sein (`ASSERTIONS_RED=PASS`). Bei GATE muss die reine
   Abnahme auf dem Base gruen sein (`GATE_BASELINE=PASS`). Infrastruktur- oder
   Zugriffsfehler zaehlen fuer keines von beiden.
3. Nur bei BUILD erhaelt der Writer Paketprojektion, roten Test und `editablePaths` und
   baut genau diesen vertikalen Nutzwert. Ergibt die Preflight-Messung, dass der noetige
   Pfad ausserhalb liegt, stoppt der PL vor Writer-Start als Produktentscheidung.
4. Alle Paketchecks laufen. Danach prueft der unabhaengige Reviewer exakt den Kandidaten-SHA.
5. Es gibt hoechstens eine Produktkorrekturrunde. Ein belegter Umgebungsfehler wird vom PL
   behoben und verbraucht diese Runde nicht. Nach `FAIL_FINAL` existiert genau ein
   Rueckweg: eine ownerautorisierte Amendierung desselben aktiven Pakets. Sie ist auch
   nach `BLOCKED_PRODUCT_DECISION` im Preflight zulaessig. Der Amendierungscommit darf
   den fokussierten Test genau einmal neu schreiben; ein gescheitertes GATE darf darin
   genau einmal zu einem eng begrenzten BUILD mit expliziten `editablePaths` werden.
   Paket-ID, Reihenfolge und globaler Plan bleiben unveraendert; ein Ersatzpaket ist
   verboten.
6. Bei `ownerView: true` werden vor Merge Preview-Link, sichtbares Delta sowie Screenshots
   in 1914x917, 1220x880 und 390x844 vorgelegt.
7. Erst nach ausdruecklicher Mergefreigabe darf der normale Merge nach `main` erfolgen.
   Der automatische Production-Effekt jedes solchen Main-Merges muss Teil derselben
   Freigabe sein; er ist noch kein Gesamt-Liveclaim. Danach werden Main-Gates und
   Production-Status real belegt; der PL startet den im Plan
   bereits festgelegten Nachfolger. Dafuer erstellt er den exakten Nachfolger-Branch frisch
   aus `origin/main` und fuehrt einmal `npm run live:advance -- --apply` aus. Das Skript
   verweigert jeden anderen Branch, einen unsauberen Baum, eine abweichende Main-Basis oder
   einen nicht in `origin/main` enthaltenen Kandidaten.
8. KR-L20 wird nach seinem autorisierten Main-Merge, Production-Smoke und Betriebsnachweis
   einmal ueber `codex/kreile-live-close` und `npm run live:close -- --apply` als
   `LIVE_COMPLETE` geschlossen. Dieser Abschluss darf keinen Produktcode aendern.

## 5. Produkt- und Architekturgrenzen

- Stack: Next.js App Router, TypeScript, Supabase, Drizzle, Recharts, Framer Motion, PWA.
- Vor Next.js-Aenderungen die passende lokale Next.js-Dokumentation unter
  `node_modules/next/dist/docs/` lesen.
- Tenant nur ueber `KREILE_TENANT_SLUG`; nie als Literal in Modulkernen.
- Keine Mock-, Demo-, Fake- oder synthetische Produktfunktion. Synthetische Daten nur in
  klar isolierten Tests.
- Keine zweite fachliche Wahrheit, kein stiller Fallback, keine erfundenen Erfolgsclaims.
- Datenkette: reale Quelle -> stabiler Vertrag/View -> Query/Action -> Komponente ->
  Loading/Empty/Error/Blocked/Data.
- Keine Client-`tenantId`-Autorisierung, keine offene Public-RLS, keine Secrets/PINs im
  Client-Payload.
- Modulgrenzen laufen ueber oeffentliche Ports/Fassaden; `npm run quality:module-gates`
  bleibt bindend.

## 6. UI-Wahrheit

- Designsystem V1.1: Tokens, Typografie, Komponenten, Responsiveness.
- Vier gelistete HTML-Referenzen: Seitenkomposition und Rollenlayout.
- V5 mit gebundenem SHA: ausschliesslich Ablauf und Zwischenschritte.
- Keine andere Design- oder Mockdatei ist Bauinput. Demodaten aus Referenzen duerfen nie
  in Produktpfade gelangen.

## 7. Pflichtchecks und Abschluss

Mindestens:

- `npm run quality:authority-gate:selftest`
- `npm run quality:authority-gate`
- `npm run quality:delivery-contracts:selftest`
- `npm run quality:delivery-contracts`
- `npm run quality:package-scope:selftest`
- `npm run live:advance:selftest`
- `npm run live:close:selftest`
- `npm run quality:package-scope -- --base <base> --head <head> --branch <branch>`
- `npm run quality:no-fake-production`
- `npm run quality:module-gates`
- `npm run quality:h16-eslint-contracts:selftest`
- `npm run quality:h16-eslint-contracts`
- `npm run quality:f0-f2-schema:selftest`
- `npm run quality:f0-f2-schema`
- `npx tsc --noEmit --incremental false`
- `npm run lint:full`
- `npm run test:unit`
- `npm run build`
- paketbezogener Browser-/E2E-Nachweis.

Dauerregressionen laufen nur fuer gemergte BUILD-Pakete ohne externe Voraussetzung auf
der frischen lokalen Supabase-Replay-Umgebung. Externe BUILDs und GATEs werden ueber ihre
gebundenen Receipts abgenommen. `skip` und `fixme` sind in keinem `kr-l*.spec.ts` erlaubt.
Nach `LIVE_COMPLETE` duerfen normale Produkt-Hotfixes weiterlaufen; die Live-Steuerung
selbst bleibt gegen beiläufige Aenderungen gesperrt.

Erlaubte Ergebniszustaende: `PASS`, `FAIL_INTERNAL`, `BLOCKED_EXTERNAL_PERMISSION`,
`BLOCKED_PRODUCT_DECISION`. Ein beendeter oder toter Prozess ist kein Fortschritt.
Kein Lieferclaim ohne Commit-SHA, sauberen Baum, Exact-SHA-Review, relevante gruene Gates
und belegte Einordnung in `main`.
