# Übergabe Planungschat Kreile-WerkstattCockpit (Stand 02.11.2026, ca. 01 Uhr)

Diese Datei ist die vollständige Übergabe an einen frischen Planungs- und Prüferchat. Sie enthält keine Login-Codes, keine Secrets und keinen Mock.

## 1. Rolle
- Planungs- und Prüferchat. Übersetzt das WAS (BAUPLAN, vom Endversion-Chat) in das WIE (Arbeitspakete mit Akzeptanztest, Wege-Matrix, Anker). Prüft jeden Stand gegen Code, CI, DB und per eigenem Playwright-Lauf. Schreibt **keinen Produktcode**.
- Bau: genau **ein** Codex (einziger Schreiber im Produkt). Endversion-Chat: pflegt BAUPLAN inkl. `testmodell`, schreibt keinen App-Code. Owner (Siglinder): reicht Nachrichten weiter, Klicktest, Merge.
- Owner-Arbeitsweise: knapp, präzise, deutsch; eine Frage auf einmal; keine bereits beantworteten Fragen erneut stellen; Prüfer ≠ Bauer; keine Reparaturschleifen; nichts härten, was später ersetzt wird; eine Wahrheit (ersetzen statt parallel); Klickwege immer mit Preview-Link genau des geprüften SHA; Owner nicht als Dauer-Vermittlerin einsetzen; Fehler im Prozess selbst beheben.

## 2. Infrastruktur
- Repo `schoggertraube-rev/galvanik-kreile-app`, lokal `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app` (Zugriff per Desktop Commander; **derselbe Arbeitsbaum wie Codex** – bestehende Dateien nur ändern, wenn Codex nicht arbeitet; sonst neue Dateien anlegen).
- Supabase Dev `syhaigjhsbpjmtnggqka` (eine Dev-DB, keine zweite). Vercel Projekt `prj_zY4ExMs5Q8Q8Ga0YQL1mYhYoLX2i`, Team `team_C8OgLwPg5H8ccKEWn0IRrKkc` (Share-Link per `get_access_to_vercel_url`).
- Pflicht-Checks (Ruleset 20208063): quality, agentur-gate, Fresh Supabase replay. Ratchet ist nicht Pflicht; bei Anker-PRs ist er erwartbar rot **nur** am Schritt „Enforce protected active-package scope and commit roles“ (Log: „Package-scope checker is not the protected-base checker“). Prüfen per `gh run view <id> --json jobs`.
- Governance: Mission `missions/F1_ORDER_TO_CASH_PILOT_001.yml`, Block B2, Branch `kreile/b2-eingang`. Scope-Wächter `scripts/quality/check-live-package-scope.mjs` (B2-Allowlist, byte-geschützt) → jede neue Pfadgruppe braucht einen Anker-PR (`codex/ta-*`, Muster TRUST_ANCHOR_B2*.md, Pfad-Probe des lokal gebauten Pakets). H18: jede Server-Action in `scripts/quality/h18-server-actions.json` mit `*.integration.test.ts`-Nachweis. CI-Schritt „Acceptance tests against replay DB (all packages)“ führt `src/test/acceptance/` aus.
- Prüfskripte: `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_pruefer\` – `lib.mjs` (BASE/SHARE aus env), `t14_ap01_matrix.mjs` (AP-01-Wege-Matrix), `t16_detail.mjs`, `t17_click.mjs`, `t18_buchen.mjs`, `bp_grep.mjs` (Bauplan-Suche), Generatoren `gen_ap01b.mjs`, `gen_k1.mjs`. Login-Codes **nur** als Umgebungsvariable im Befehl (`$env:KR_CODE_ROLF=…`), Werte nennt die Owner im Chat; nie in Dateien schreiben. Lange Läufe per `Start-Process … | Out-File …log` starten und Log abfragen (Desktop Commander bricht nach 60 s ab). Erster Login-Versuch scheitert manchmal → Script versucht zweimal.
- Fallen: PowerShell zerlegt Umlaute/Anführungszeichen → Inhalte per Node-Skript oder `write_file` schreiben; `write_file` auf bestehende Datei braucht `mode`; vor Abgabe jeder Planungsdatei Whitespace prüfen (keine Leerzeichen am Zeilenende, keine Leerzeile am Dateiende) – `quality` prüft `git diff --check`.

## 3. Regeln (AKTUELLE_ANWEISUNG, Abschnitt A)
Regel 11 Durchlauf statt Pingpong (A11-Strecke inkl. `git diff --check origin/main`); Regel 12 Spec-Freeze (Endversion-Chat schreibt nur `BAUPLAN.next.json`, Übernahme nach `BAUPLAN.json` nur mit Anker); Regel 13 Wegeprüfung vor dem Bau + eigener Playwright-Lauf vor jedem Owner-Klicktest. Entscheidungen U-220 … U-231 in `_review/OWNER_ENTSCHEIDUNGEN.md`. Befunde nur über `docs/project/arbeitspakete/BEFUNDE.md` (jetzt / späteres Paket / Optik / parken).

## 4. Stand
- main nach Merge von #160 (TA-B2c2). Vorher main `8e1e03f5` (#159).
- Bauplan gültig: `BAUPLAN.json` spec `6b782924134c`, SHA `225B7FB5…5305`. Nächste Fassung: `BAUPLAN.next.json` SHA `e0712e63adf4…a8395f`, spec `c5f2374e04a5` (mit Abschnitt `testmodell`: eingang 45 Fälle, kundeneu 29; 5.2 offen) – kommt mit TA-B2d; Endversion-Chat arbeitet ggf. noch weiter (dann neue SHA abwarten).
- #158 (AP-01, Branch `kreile/b2-eingang`): Fassung 4.3 lokal bei Codex (6bca5f68), wartet auf #160. Akzeptanztests: `ap01_…` SHA `BE54C2C5…`, `ap01b_…` SHA `4B67978D…`. Migration intake_item `308A6A15…`, Dev 66/66.
- Letzter Prüflauf (foa1yv18m/1acf9118): grün M0–M3, M5, M8, M9, M11, Ebene Kundenkarte; rot: Buchen legt keinen Auftrag an (Ursache: createOrderIntake lehnte Privat ohne Ansprechpartner ab → TA-B2c2), Namenserkennung aus „Schnell erfassen“. Zwei verwaiste `intake_item` auf Dev (Testdaten, nicht löschen).
- Pakete (WORKQUEUE): TA-B2c2 → AP-01 4.3 → TA-B2d → AP-G (Generator Testmodell) → AP-K1 (Kunde, Migration `C724DA84…`, Test `CFFFA031…`) → AP-K2 (OpenPLZ, in Planung) → AP-02 Fassung 2 (Kunde inline, eine Transaktion) → AP-C, AP-E, AP-W, AP-F, AP-Q1 → B3/B4 → B5. Feature-Stopp 29.11., Pilot 30.11.
- Mindmap Auftragseingang: https://claude.ai/artifact/A6Hh6asV2F5oecZm2GdP64

## 5. Offene Nachträge (noch nicht in den Paketdateien, beim nächsten Anker eintragen)
1. AP-01 4.3 zusätzlich: Meldung nach Erfolg exakt „Wareneingang gebucht · {auftrag}“ (Bauplan `werkbank.interaktion[eingang-erfolg]`), ersetzt 4.2 Punkt 7. An Codex mitgegeben.
2. AP-K1 Rechte nach Bauplan: 3.1 Kunde anlegen = `eingang`, 5.2 Kunde bearbeiten = `kunden`.
3. „PLZ passend zum Land“: Endversion-Chat soll `formulare.kunde.vollstaendigkeit` ergänzen (Anschrift gefüllt **und** gültig nach `felder[].validierung`) und den Fall `kunde_plz_land_widerspruch` aufnehmen; AP-01-Test `ap01b` bleibt.
4. 5.2 Kunde bearbeiten ist im Bauplan nicht bau-frei → Owner-Entscheidung offen (Empfehlung: freigeben, Endversion-Chat modelliert 5.2; sonst baut AP-K1 nur 3.1).
5. Bauplan-Lücke Prüfliste (Art, Eingangsart, Termin ist, Einheit) → Endversion-Chat.
6. TA-B2d: Bauplan-SHA auf die dann aktuelle `BAUPLAN.next.json` setzen (heute e0712e63), WORKQUEUE nachziehen.
7. Zwei alte Kontrollaufträge (trig_01TDE857ijKdhYfBz8qJdkaj, trig_01SEftjFrdtbgSa6Nn4RkCGQ) sind veraltet; Owner hat über Umschreiben/Abschalten noch nicht entschieden.

## 6. Nächste Schritte
1. Codex meldet 4.3 auf #158 → Code/CI prüfen → `t14_ap01_matrix.mjs` (+ `t18_buchen.mjs`) auf der Preview genau dieses SHA → DB-Beleg (Auftrag + `intake_item.vorgang_id`) → nur bei Grün Klickweg mit Share-Link an die Owner → Merge.
2. Danach AP-G und AP-K1 lokal bauen lassen → TA-B2d (Bauplan + Pfade + CI-Schritt) → PRs → prüfen.
3. Jeden Owner-Befund zuerst in BEFUNDE.md einordnen; an Codex nur „jetzt“.
