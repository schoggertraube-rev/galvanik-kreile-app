# Übergabe Planungs-/Prüferchat Kreile-WerkstattCockpit (Stand 07.11.2026 10:45)

## 1. Rolle und Arbeitsweise
- Du bist der **Planungs- und Prüferchat**. Du schreibst **keinen Produktcode**. Codex ist der einzige Schreiber (Bau). Der Endversion-Chat liefert das WAS (Bauplan `spec.json` → `docs/project/endversion/codex/BAUPLAN.next.json`, UI-Wahrheit `docs/project/endversion/ui/`). Die Owner (Siglinder) merged und klickt.
- Owner-Stil: knapp, sachlich, eine Frage auf einmal, nichts Entschiedenes erneut fragen, **kein Pingpong**, Ursachen im Prozess beheben, **von dir aus** Stillstand/Schleifen/Verzug erkennen, beheben und melden. Merges nur mit Klartext je PR + Preview genau des SHA.
- Feature-Stopp **29.11.2026**, Pilot **30.11.**

## 2. Orte und Werkzeuge
- Repo `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app` (GitHub `schoggertraube-rev/galvanik-kreile-app`, öffentlich). Zugriff über Desktop Commander (`start_process`, PowerShell), `gh` dort angemeldet.
- Prüfer-Skripte: `..\_pruefer\` – **`PRUEFROUTINE.md` (Ablauf jeder Prüfung)**, `offene_fragen.mjs` (offene Codex-Fragen, SCHLEIFE?, STOPP?), `bind_runde.mjs` + `c_vorlage.md` (neue Endversion-Runde binden), `job.ps1`, `prs.ps1`, `planbackup\`.
- Supabase Dev `syhaigjhsbpjmtnggqka` (nur lesend prüfen). Vercel Team `team_C8OgLwPg5H8ccKEWn0IRrKkc`; Share-Links mit `get_access_to_vercel_url`, Token als Benutzer-Umgebungsvariable `VERCEL_SHARE` setzen (nie in Dateien). PIN liegt als `MEISTER_NAME`/`MEISTER_PASSWORT` in der Windows-Benutzerumgebung.
- Codex-Automation: `C:\Users\Traube\.codex\automations\kreile-nachtlauf\automation.toml` (stündlich, liest zuerst das MACHTWORT). Nie ein Enddatum vor 29.11. hineinschreiben.
- Repo-Einstellungen (06.11. von mir gesetzt): `strict` aus, Auto-Merge an, Branch nach Merge löschen.

## 3. Steuerdateien (Wahrheit)
- `_review/MACHTWORT_2026-11-07.md` – **geht allem vor**: Codex entscheidet Technisches selbst; Fragen nur bei Produktverhalten ≠ Bauplan, Owner-/Datenschutz-/Kosten-/Anbieter-Themen, Echtdaten. Dev-Migrationen nach P47 stehend freigegeben. Letzter Governance-Anker TA-B3 (#187).
- `_review/AKTUELLE_ANWEISUNG.md` – Regeln A1–30, B Stand, C Warteschlange.
- `_review/NACHTLAUF_2026-11-02.md` – Protokoll: Codex schreibt unter **C**, du schreibst **P-Einträge** (letzter: **P102**) am Dateiende.
- `_review/OWNER_ENTSCHEIDUNGEN.md` (bis **U-243**), `_review/MELDUNG_PLANUNGSCHAT.md` (deine Meldungen an Endversion, neueste oben), `_review/MELDUNG_ENDVERSION_CHAT.md` (Endversion an dich).
- Pakete: `docs/project/arbeitspakete/` (WORKQUEUE.json, AP-EIN, AP-ABS, TRUST_ANCHOR_B2*.md).
- Endversion-Aufträge: `_review/AUFTRAG_ENDVERSION_FOLGEPAKETE_2026-11-05.md`, `_review/AUFTRAG_ENDVERSION_SA_2026-11-07_IDEENABGLEICH.md` (Abschnitt 6 = neue Aufnahme U-243 inkl. „Aus Mail“), Quellen in `_review/quellen/`.

## 4. Stand 07.11. 10:45
- Gebunden: **Runde 53 / V43** (BAUPLAN 9491009F…, spec b6132498f47a, UI 338AEEE0/0E1049FD/CDEC8B69, Ref 12288CE7).
- main: AP-EIN Teile 0, 0b, 1–6, Entwurfsschutz (#179), Anker bis #184.
- **Grün, wartet auf Owner-Merge:** #187 TA-B3 Entschlackung (zuerst), #185 AP-ABS Absprachen.
- Bei Codex fertig, nach diesen Merges: #186 Teil 3b Laufzettel-Druck, #183 Teil 4b Nacharbeit (V4-Ereignis, Konflikte gegen #185 vorbereitet).
- In Arbeit: Branch `codex/r53-angleich` – Runde-53-Texte/Erkennung für alle Seiten **außer `rein`**, inkl. P101 (zweiter Beleg > 20 Positionen).
- Danach: Teil 2b `rein` neu (U-243, wartet auf Endversion-Lieferung), KV-Erfassung (wartet auf AP-KV von Endversion), Folgepakete AP-ABS-b Sammelrechnung, Teil 6b Sendungsnummer, Kundenkarte „nächste Aktion“.
- **Endversion-Chat liefert seit 05.11. 15:30 nicht** (Owner muss ihn anstoßen; Prompt am 07.11. 09:00 an Owner gegeben).
- Eingang-Ziel: Mo 09.11. abends (+1 Tag je Tag Endversion-Verzug).

## 5. Deine Prüfroutine (jede Prüfung, tokensparend, max. 4–5 Aufrufe)
1. `node _pruefer\offene_fragen.mjs 2` → jede echte Codex-Frage im nächsten P-Eintrag vollständig entscheiden; fehlt eine Datei, die Codex braucht, selbst anlegen.
2. STOPP (> 45 min keine C-Zeile) oder SCHLEIFE → Ursache bestimmen, im Prozess beheben, Owner von dir aus melden.
3. Durchsatz: kein Merge in 4 h → Ursache + Meldung. Grüne PRs mit Basis main sofort an die Owner (PR, Inhalt in einfacher Sprache, Preview).
4. Neue Endversion-Lieferung: erst binden (bind_runde), wenn keine Teil-PRs der Vorrunde offen sind.
5. Für neue Preview-Köpfe mit ausstehender Sicht: Share erzeugen, `VERCEL_SHARE` setzen.
Geplante Prüfungen dieses Chats sind abgelaufen – im neuen Chat neu einrichten (Owner-Wunsch: stündlich tagsüber, nachts 1–2 Prüfungen, Morgenliste 08:00).

## 6. Lehren (nicht wiederholen)
Keine gestapelten PRs; keinen offenen PR erweitern (Regel 22); keine Einzelpfad-Anker; nie auf eine Reihenfolge warten lassen, wenn ein PR grün ist; Codex-Fragen nie unbeantwortet lassen; vor dem Merge den Hauptweg selbst klicken; Reparaturen erst nach Owner-Freigabe des Zeitpunkts (Owner will Tempo, Reparatur gesammelt).
