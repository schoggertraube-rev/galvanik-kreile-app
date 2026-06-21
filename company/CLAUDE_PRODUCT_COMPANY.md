# Product Company V3 — verbindlicher Projektbetrieb

## Stakeholder-Modus

Der Nutzer ist Stakeholder, nicht Build-Manager.

Jede freie Idee, Kritik, Wunschliste, Bildbeschreibung oder HTML-Mock gilt als Innovationseingang. Der Stakeholder muss keine Agenten auswählen, keine Bauprompts formulieren und keine technischen Aufgaben verteilen.

### Schlüsselwörter

- `Los` → `node company/scripts/company-runner.mjs los`
- neue Idee → `node company/scripts/company-runner.mjs idea --text "<Originaltext>"`
- `Freigegeben` → `node company/scripts/company-runner.mjs approve`
- `Ändern: <Feedback>` → `node company/scripts/company-runner.mjs revise --text "<Feedback>"`
- Statusfrage → `node company/scripts/company-runner.mjs status`

Führe den passenden Befehl selbst aus. Gib dem Stakeholder keine technischen Zwischenaufträge.

## Unternehmensziel

Idee → USP/Problem → unabhängige Fachanalyse → kompromissloser Zielentwurf → klickbarer HTML-Prototyp → Stakeholder-Freigabe → vertikaler Bau → automatische Qualitäts- und Reparaturschleife → Preview → Stakeholder-Abnahme → Produktion → Smoke-Test → Wirkung.

## Verbindliche Regeln

1. Bestehende UI ist keine Vorgabe. Bei strukturellen UX-Mängeln entsteht zuerst ein Nullbasis-Zielentwurf.
2. Kein sichtbarer Umbau ohne Prototyp und Stakeholder-Freigabe.
3. Kein Spezialistenbericht ohne konkrete Entscheidung, Owner und Folgearbeit.
4. Keine technische Frage an den Stakeholder, die intern lösbar ist.
5. Keine Abgrenzung als „pre-existing“, wenn sie Build, Sicherheit, Datenintegrität oder Release blockiert. Erzeuge eine interne Stabilisierungsschleife.
6. Keine Mockdaten im Produktionspfad, keine erfundenen Kennzahlen, kein `Math.random()` für Geschäftsdaten.
7. Datenquelle → Vertrag → Server → UI → Aktion → Persistenz → Reload → Folgeprozess → Analyse.
8. Der Erbauer nimmt sich nicht selbst ab.
9. Status und Evidenz liegen in `company/missions/`, nicht nur im Chat.
10. Stoppen ist nur zulässig bei Stakeholder-Gate, echtem externem Blocker, `LIVE_VERIFIED` oder sicher dokumentiertem Fehlerzustand nach ausgeschöpfter Reparaturschleife.

## Projektbindung Kreile

- Tenant: `galvanik-kreile`
- Stack: Next.js App Router, TypeScript, Supabase, Drizzle, Recharts, Framer Motion, PWA.
- Keine fachliche Vermischung mit anderen Apps.
- CI-Tokens zentral; keine neuen hartkodierten Markenwerte.
- Navigation nur ändern, wenn der freigegebene Zielentwurf dies ausdrücklich vorsieht.
- KPI-Berechnungen in SQL-Views beziehungsweise versionierten Datenverträgen.

## Produktgrundlagen

Lies, sofern vorhanden:

- @docs/product/PRODUCT_CONSTITUTION.md
- @docs/product/USP_CONSTITUTION.md
- @docs/user-twins/USER_TWIN_ROLF.md
- @docs/user-twins/USER_TWIN_PHILLIP.md
- @docs/user-twins/USER_TWIN_MICHAEL.md
- @company/config/company.config.json
- @company/state/state-machine.json

Fehlende Produktgrundlagen sind interne Firmenaufgaben. Rekonstruiere sie aus belegten Projektquellen; ändere USP oder Twins nur als Vorschlag und lege sie dem Stakeholder zur Freigabe vor.
