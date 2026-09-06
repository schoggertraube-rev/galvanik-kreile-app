# KREILE — PROBLEMLÖSUNGEN (teuer gelernte Fallen + verbindlicher Fix)

Diese Fehler sind mehrfach passiert. Wiederhole sie nicht.

## P1 — Die „alte-App-Falle" (falsches Design kroch immer zurück)
Symptom: Startseite wurde als Stationsband (Wareneingang→Galvanik→Warenausgang, „Station öffnen") gebaut — mehrfach verworfen, kam immer wieder.
Ursache: Die richtige Referenz lag nicht im Repo; im Repo lagen ~10 konkurrierende Home-Routen + verworfene Mockups als Vorlage.
Fix (gilt): Home = Phillip V4 „Heute sichern" (`ui/`), NIE Stationsband (CI-FAIL). Konkurrierende Routen (today/start/cockpit/kontrolle/status/…) sind ENTFÄLLT (Modulkarte) und werden gelöscht. Nur `docs/project/linie/ui/` ist Vorlage.

## P2 — Tenant-Literal `'galvanik-kreile'` (65× hart)
Symptom: Kern nicht forkbar; verletzt D-ARCH-007.
Fix: `TenantProvider`/Injektion; Literal per ESLint verboten (Fehler). Siehe `BEISPIELE_MODUL.md`. Neue Datei mit dem Literal = FAIL.

## P3 — F1.3-Regress durch F1.5-B2-Zahlungsmodus (CONFLICT statt OK)
Symptom: `f1_3_live_card` „creates real master data" bekam CONFLICT statt OK, nachdem `payment_mode` bei Intake dazukam.
Ursache: Der INSERT-Guard `private.guard_f1_5_order_payment_mode_insert` verlangt, dass JEDE neue Order kanonisch geboren wird: `payment_mode='vorkasse'` UND `payment_mode_version=0`. `createOrderIntake` legte sie nicht so an → Guard wirft 23514 → auf CONFLICT gemappt.
Fix (sauber, niemand gibt nach): `createOrderIntake` legt jede Order kanonisch an (vorkasse, v0) — Spalten-Defaults nicht überschreiben. Damit F1.3 wieder OK, Guard bleibt scharf, D-F15-002 erfüllt. NIE den Test/Guard aufweichen oder die CI-Lane umgehen.

## P4 — „Grün ≠ fertig"
Symptom: Falscher Code bekam grüne CI (CI prüft Verträge, nicht Designtreue/Module).
Fix: Fertig = grün UND designtreu (`ui/`) UND modultreu (5 Nähte) UND Scope (Modulkarte). Die neuen CI-Checks (UI-Contract, dependency-cruiser, Manifest, Tenant-Lint) machen genau das build-rot.

## P5 — Erfundene Daten / Mock
Symptom: Demo-Daten (Mustermann, 300 SL) als Produktdaten; Erfolgs-Attrappen.
Fix: Ports/Reads gegen ECHTE (auch leere) Daten. „Noch keine Daten erfasst" ist korrekt und ehrlich. Kein Mock, keine erfundenen Rückgaben. (LIVE_STATUS/Go-Regeln der Mission beachten.)

## P6 — Autor = Prüfer (Interessenkonflikt)
Symptom: Derselbe Agent baut, benotet sich selbst und merged — Drift bleibt unentdeckt.
Fix (Rollenregel): Der Prüfer eines Baus ist NIE sein Autor. Ein unabhängiger Prüf-Chat fährt die §5-Kontrolle (dependency-cruiser + Tenant-Scan + UI-Contract) gegen Code+CI und liefert den Rotstand. „Fertig"-Behauptungen des Autors zählen erst nach dieser Kontrolle.

## P7 — Closed-world-Naht (Vorbild Lerninsel, so wird die CI-Grenze gebaut)
Muster: Pfad-Allowlist je Einheit im Workflow, genau EIN Commit auf beobachteter Basis, Manifest/Public-Surface je Modul, keine Binärdeltas, Exact-SHA-Review. Das ist die Blaupause für Kreiles S1-Gate — nicht neu erfinden, von Lerninsel übernehmen.
