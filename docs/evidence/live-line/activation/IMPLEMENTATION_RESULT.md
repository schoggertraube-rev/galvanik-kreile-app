# Kreile-Live-Baulinie V1 - Umsetzungsergebnis

Datum: 2026-10-11

## Ergebnis

Der Aktivierungskandidat ersetzt die konkurrierenden Bau- und Paketwahrheiten durch
einen einzigen maschinenlesbaren Weg von KR-L01 bis KR-L20. Er aendert keinen
Produktcode, keine Datenbank, keine Rollen, keine Echtdaten und keine Production.

Nach Aktivierung gilt:

- genau ein aktives Paket und ein fest gebundener Nachfolger,
- genau ein Writer nur bei BUILD-Paketen,
- writerlose GATE-Pakete KR-L17 bis KR-L20,
- Designsystem V1.1 als einzige Komponentenbasis,
- alte Quellen nur noch unveraendert im nicht ausfuehrbaren Historienarchiv,
- eine Korrekturrunde und danach hoechstens eine ownerautorisierte Amendierung desselben
  Pakets statt Ersatzpaket oder Parallelplan,
- exakter SHA fuer Review, reale Browserbelege fuer visuelle Pakete und getrennte
  Nachweise fuer Main, Production und den finalen Livegang.

## Reale Pruefergebnisse

| Pruefung | Ergebnis |
|---|---|
| Authority-Gate samt Selftest | PASS |
| Delivery-Vertrag samt Selftest | PASS |
| Package-Scope-Selftest | PASS |
| Live-Regressionsvertrag samt Selftest | PASS, 0 vorhandene lokale Paketspecs vor KR-L01 |
| Advance-Selftest | PASS |
| Close-Selftest | PASS |
| No-Fake-Production | PASS |
| Modulgrenzen | PASS |
| Modul-Gate-Regression | PASS, 63 Tests |
| TypeScript | PASS |
| Vollstaendiges ESLint | PASS |
| Unit-Tests | PASS, 118 Dateien / 983 Tests |
| Next.js Production-Build | PASS, Exit 0 / 26 Seiten |
| Archiv-Bytegleichheit | PASS, 23 von 23 verschobene Altdateien unveraendert |

Beim Production-Build wurden ohne Runtime-Session mehrere fail-closed
`AUTHORIZATION_UNAVAILABLE`-Ereignisse protokolliert. Der Build blieb erfolgreich und
lieferte keinen stillen Datenfallback. Die Paketlinie behandelt Runtime-Login und reale
Latenz deshalb weiterhin zuerst in KR-L01; diese Aktivierung behauptet keine bereits
erfolgte Produktreparatur.

## Noch ausstehend

1. Die abgeschlossene Korrekturrunde als exakten Commit einfrieren.
2. Paket-Scope gegen `origin/main` auf diesem Commit pruefen.
3. Draft-PR bereitstellen. Kein Merge und keine Production ohne separate Owner-Freigabe.

Erst nach dem Aktivierungs-Merge startet KR-L01. Sichtbarer Produktfortschritt entsteht
ab KR-L01; dieser Kandidat ist bewusst die einmalige Reparatur der Produktionslinie.

## Einmalige Aktivierungsgrenze

Der `pull_request_target`-Lauf **ESLint Ratchet** verwendet absichtlich die unveraenderte
Checker-Kopie aus dem bisherigen `main`. Weil dieser Aktivierungskandidat genau diese
Governance-Checker und deren Hash-Pins ersetzt, wird jener nicht-required Ratchet-Lauf
bei der Aktivierungs-PR erwartbar rot. Das ist kein Admin-Bypass und keine Ausnahme fuer
Produkt-, Sicherheits- oder Build-Gates: `quality`, `agentur-gate` und Fresh-Supabase
muessen gruen sein. Vor dem normalen Merge muss der Owner einmal explizit bestaetigen,
dass er genau diesen erwarteten Ratchet-Fehler fuer die Aktivierung akzeptiert. Danach
schuetzen die neuen Pins wieder jeden Folgekandidaten.

Die interne `quality`-Spur bleibt dabei vollstaendig gruen: Nur das nicht ausfuehrbare,
bytegebundene V1.1-Quellpaket und das gesperrte Historienarchiv sind vom Produkt-Lint
ausgenommen. Jede dort liegende Code-Referenz ist im Ratchet mit Inhalts-Hash erfasst;
spaetere Aenderungen bleiben verboten. Produktcode darf beide Baeume per ESLint-Vertrag
nicht importieren. Fuer alle Runtime-, Test- und Steuerpfade gilt weiterhin das
Null-Fehler-/Null-Warnungen-Budget.
