# MACHTWORT 07.11.2026 (Planungschat im Auftrag der Owner) – gilt vor allen P-Einträgen und Regeln, wo abweichend

## Befund
Die Prüf- und Freigabe-Maschinerie kostet mehr als der Bau. In 72 h: 511 Commits, davon rund 100 Feature, der Rest Restack, Anker, Fix, Test. Jede neue Grenze (Pfad, Hash, Branchname, Rollen-Trennung, Share, PIN, Migration) erzeugte eine Frage, und Codex wartete auf die Antwort. Das hört jetzt auf.

## A. Codex entscheidet selbst (Regel 30)
Ohne Rückfrage entscheidet und dokumentiert Codex (eine Zeile in C: Entscheidung + Grund) alles **Technische, das kein Produktverhalten ändert**: Test- und Harness-Mechanik, Fixtures, CI-Mechanik, Ereignis-Versionen, Folge-Migrationen und ihre Namen, Inventar- und Manifest-Einträge, Rebase und Reihenfolge, Rot-Liste nach Regel 23/27, Dev-Migrationen nach P47 (**stehende Owner-Freigabe**, auch künftig). Der Planungschat prüft nachträglich; Korrekturen nur als Folge-PR, nie als Stopp.
**Fragen gibt es nur noch bei:** (a) Produktverhalten weicht vom Bauplan ab und Regel 23 passt nicht, (b) Owner-Entscheidung, Datenschutz, Kosten, neuer Anbieter, (c) Echtdaten oder Produktion. Alles andere ist keine Frage – entscheiden, vermerken, weiter.

## B. Letzter Governance-Anker „TA-B3 Entschlackung“ (#187 wird dazu erweitert, ein Merge)
1. **Scope-Prüfung schützt nur noch:** bestehende Migrationsdateien (unveränderlich), `docs/project/endversion/codex/BAUPLAN.json` und `docs/project/endversion/ui/**` (nur per Bindung), `_review/**`, `docs/project/**` (Planung). **Alles andere ist frei** – auch Workflows, `scripts/quality/**`, Inventare, ESLint-Baseline. Entfallen: Branch-Muster, Commit-Rollen-Trennung, Inventar-Hash-Pins, `judgeContractHash`-Zwang, Einzel-Anker für Pfade.
2. **Ratchet** raus aus `quality.yml`; eigener Job bleibt, nur Warnung, kein Pflicht-Check.
3. **XPASS** (ein Rot-Listen-Fall ist grün) ist nur noch eine Warnung; Codex bereinigt die Liste im nächsten PR.
4. **Generierte Wege:** PR = eigene Seiten + Smoke (`_pr_scope.json`), main und nachts voll; Browser im Playwright-Container (wie #187).
5. **Pflicht-Checks bleiben:** `quality` (Lint, Typen, Unit) und `agentur-gate` (Replay, H18, Acceptance, Wege). Keine Testaussage wird geschwächt.

## C. Sicht lokal
Sichtläufe laufen gegen den **lokalen Build** (`npm run build` + `npm run start`) mit der lokalen Replay-DB und deren Test-Logins. Keine Abhängigkeit mehr von Vercel-Share, Preview-SSO oder Dev-Datenstand. Der Preview-Link ist nur noch für die Owner zum Klicken.

## D. Takt
Ein Paket = ein PR gegen main, Ziel **4 h** vom Start bis „bereit für Auto-Merge“. Codex meldet der Owner direkt (PR, was drin ist in einfacher Sprache, Preview). Niemand wartet auf den Planungschat.

## E. Reihenfolge ab jetzt
#187 auf Umfang B erweitern → Owner-Merge → #186 → #185 → #183 → R53-Angleich ohne `rein` → Teil 2b `rein` nach Endversion-Lieferung (U-243) → KV, sobald AP-KV gebunden.

## Ausgleich für die Lockerung
Der Planungschat liest jeden PR-Diff nach dem Merge-Antrag; Regeln 14 (Paket abschließend), 19 (UI-Wahrheit), 22 (fester Umfang) und das Mock-Verbot gelten unverändert. Ein Verstoß wird per Folge-PR zurückgenommen.

## F. Sicht-Abnahme bis zum R53-Merge (07.11. 14:00, beendet die Sicht-Schleife)
Ursache der Hänger: Der gebundene Sichtvertrag ist Runde 53, main zeigt noch den alten Stand. Jeder Teil-PR ist deshalb auf Seiten rot, die er gar nicht ändert – und `routen.json` hat für manche Fälle (Reklamation) keine Route. Ab sofort:
1. **Teil-PR (nicht R53):** Sicht bestanden = **kein neues Rot** in den Kennungen/Texten, die der PR-Diff berührt. Rot an unberührten Stellen gehört zum R53-Angleich und blockiert nie – keine Frage, eine Zeile in C.
2. **Route `null` oder kein Beispiel-Datensatz:** Gelb mit Grund `Endversion-Angleich routen <Fall>`; der geänderte Weg gilt dann über realRender + echten Replay-Test als belegt. Keine Frage.
3. **R53-Angleich** ist die Korrektur auf die neue Oberfläche: für ihn gilt Regel 19 voll (`pruefe_sicht` für alle Seiten außer `rein` grün, Gelb nur mit Grund).
4. Danach PR sofort Draft aus, Auto-Merge an, Klartext + Preview direkt an die Owner.

## G. Owner-Popups (07.11. 14:20, Owner: „Codex fragt ständig, ich bin weg“)
Ein Popup an die Owner (`request_user_input`) gibt es **nur** für:
1. **Merge-Bitte**, genau **eine** je PR, wenn er bereit für Auto-Merge ist (PR-Link, in einfacher Sprache was drin ist, Preview genau des SHA). Keine Nachträge, Korrekturen oder Erinnerungen per Popup – Änderungen am Stand stehen in C und in der PR-Beschreibung.
2. Eine echte Owner-Entscheidung nach A(b): Produktverhalten weicht vom Bauplan ab und Regel 23 passt nicht, Kosten, Datenschutz, neuer Anbieter, Echtdaten/Produktion.
**Alles andere ist kein Popup**, sondern eine Zeile in C an den Planungschat, und Codex arbeitet weiter: Vercel-Share/Freigabelinks (setzt der Planungschat stündlich), Reihenfolge, Sicht-Einordnung, Rebase, fehlende Dateien, Rückfragen zu P-Einträgen.
**Testdaten:** Dev (`syhaigjhsbpjmtnggqka`) und die lokale Replay-DB sind Testsysteme. Eindeutig als Test markierte Datensätze (z. B. Kunde/Auftrag mit Präfix `TEST`) darf Codex dort ohne Frage anlegen; vorhandene Daten nicht ändern oder löschen. Das ist keine Echtdaten-Frage.
Ist die Owner abwesend und ein Popup unbeantwortet: kein zweites Popup, weiterarbeiten; der Planungschat sammelt die Merge-Liste (08:00 und stündlich).
