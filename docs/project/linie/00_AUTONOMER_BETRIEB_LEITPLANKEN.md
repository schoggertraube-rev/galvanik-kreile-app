# SO LÄUFT DIE KETTE AUTONOM — UND DIE LEITPLANKEN BLEIBEN HART
**Stand 2026-09-02. Gilt für PL, Main/Writer und Orchestrator/Wächter. Bei Konflikt: die harten Leitplanken (Teil B) schlagen ALLES.**

Grundsatz: Autonomie entsteht durch Entfernen von **Rechte- und Infrastruktur-Reibung** — NIEMALS durch Absenken der **Prüf-, Ehrlichkeits- oder Review-Schwelle**. Im Zweifel: **härter, nicht weicher.**

---

## TEIL A — WAS DIE KETTE SELBSTSTÄNDIG MACHT (Reibung entfernen)

1. **Writer hat echtes Schreibrecht.** Jeder Writer-Thread ist fest an sein isoliertes Profil gebunden (`kreile-f1` bzw. `lerninsel-f1`) — mit explizitem `02_app/.git = "write"`. NICHT auf „Custom" (read-only) oder breitem `frei` laufen lassen. Der Chip darf nicht zurückspringen; nach Codex-Neustart einmalig fest setzen und prüfen. (Häufigster Freeze war „patch rejected: writing outside of the project".)

2. **CI ist die maßgebliche Prüfung — lokaler Docker/Supabase ist KEINE Commit-Voraussetzung.** Die Sandbox erreicht Docker/`127.0.0.1:54322` nicht. Regel: lokaler pre-commit-Hook ist best-effort; ist die Infra nicht erreichbar, `git commit --no-verify` und die **PR-CI** liefert den Beweis. WICHTIG (Teil B): `--no-verify` überspringt NUR die lokale Hook-Ausführung wegen fehlender Infra — NIEMALS die CI-Verifikation, das Review oder das Ehrlichkeitsprinzip.

3. **Koordination über den PR, nicht über Chat-Handshakes.** Kein „Main committet erst nach PL-Zuruf" (das erzeugte Deadlocks). Main committet in den **Draft-PR**, sobald seine eigenen Checks passen; der PL reviewt den **PR auf GitHub** und ratifiziert dort. GitHub ist das Koordinations-Substrat.

4. **Ein sparsamer Watcher je Projekt.** Kein Heartbeat-Schwarm (es liefen 8+ überlappende Zeitpläne im Minutentakt → jeder Lauf OBSERVE→STOPP). Ein Watcher prüft den PR-CI-/Drift-Zustand und handelt nur bei echter Zustandsänderung. Drift-/Integritäts-Monitore bleiben aber erhalten (Teil B).

5. **Genau ein Writer, eine aktive Einheit.** Keine parallelen claude.ai-Autorenaufträge auf dieselbe Einheit.

6. **Owner ist benannt.** Owner = Siglinder. Damit ist „Ratifikation" keine Dauer-Sackgasse. An einer Owner-Grenze stellt der PL **eine** knappe Entscheidungsfrage und lässt den Rest weiterlaufen — statt das ganze Goal einzufrieren.

---

## TEIL B — WAS UNVERÄNDERT HART BLEIBT (Leitplanken — NIE aufweichen)

Diese Regeln werden durch nichts in Teil A geschwächt. Wer sie senkt, verursacht genau das Chaos, das wir vermeiden.

1. **Ehrlichkeit absolut.** Kein False-Green, kein Test-Biegen, kein Evidence-Biegen, keine Erfolgsattrappe. Nachweis-/Prüf-Skripte werden NICHT umgeschrieben, um Grün zu erzeugen. Fehlende Daten = fehlend, nicht 0/Schätzung/Beispiel.

2. **Merge bleibt gesperrt bis ALLE drei erfüllt:** (a) CI vollständig grün auf dem exakten SHA, (b) getrenntes PL-Review ohne offene P0/P1, (c) Owner-Ratifikation. **Kein Self-Merge.** `--no-verify` ändert daran nichts — es betrifft nur den lokalen Commit-Schritt, nie das Merge-Gate.

3. **Projekt-Isolation.** Keine Fremdprojekt-, Secret-, DB-, Vercel- oder Supabase-Ressourcen übernehmen. Kreile und Lerninsel strikt getrennt. Die Writer-Profile sind dateisystem-isoliert auf ihr eigenes Repo (kein Zugriff auf das andere Projekt). Für Kreile zusätzlich: DIE LINIE (`KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md`) ist Beschluss-Autorität; alte Bauplan-Ordner sind ARCHIV, kein Bau-Input; nur der neue Ordner ist Wahrheit.

4. **Closed-world-CI-Lanes sind ATOMAR.** Manche Lanes sind hash-verriegelt (z. B. `check-foundation-integrity` pinnt den Hash von `delivery-foundation.yml`; `check-schema` pinnt Migrations-Hashes). Solche Lanes NIE stückweise minimieren oder aus zwei Versionen mischen — nur als kohärentes Set ändern, gepinnte Hashes im selben Commit nachziehen. (Genau hier ist am 2026-09-02 Chaos entstanden.)

5. **Owner-Grenzen halten.** Anhalten (nicht durchbrechen) bei: Remote-DB/Migration remote, Echtdaten, Produktion/Deploy, Kosten, destruktivem Löschen, Scope-/Gate-/Go-live-Änderung. Eine Entscheidungsfrage stellen, nicht die Grenze überfahren.

6. **Kein automatisches Wiederholen bei Risiko.** Auto-Retry nur für lesende/idempotente Checks. Nicht bei geändertem HEAD, DB/Provider/Deploy/Rechten, destruktiven Ops, Kosten, unklarem Ziel.

7. **Bauplan wird nicht interpretiert.** Unklarheit = STOP (BLOCKED_PRODUCT_DECISION), Beschluss in die Linie, dann bauen. Keine zweite Wahrheit, kein stiller Provider-Fallback. Nicht „irgendeinen alten Scheiss" bauen — nur den abgenommenen Plan (Rolf V8, Phillip V4, Auftragskarte V8, Kundenkarte V2; echte Ports, kein Mock).

---

## TEIL C — ROLLE VON ORCHESTRATOR/HELFER (Mensch oder Assistenz)
- Darf: Prozess-Hygiene, Lese-Checks, config.toml (Profile), reversible Git-Hygiene (Drift parken), und — bei echter Sandbox-.git-Sperre — den **mechanischen** Commit/Push des vom Writer erstellten, **unveränderten** Diffs in einen Draft-PR finalisieren (via `--no-verify`).
- Darf NICHT: App-Code selbst autoren, mergen, Owner-Grenzen überschreiten, closed-world-Lanes stückweise umbauen, icacls/System-Sicherheitsrechte ändern.
- `claude.exe` = Claude-Desktop-App (Bridge-Host), NIE killen. ChatGPT-(Beta)-App NIE stoppen (kappt die Bridge).
- Lehre 2026-09-02: „Harness minimieren" war eine Fehldiagnose an einer closed-world-Lane. Nie wieder eine kohärente Lane zerlegen — Ursache im Ganzen fixen.

---
*Diese Datei liegt in beiden Projekten (Kreile-Bibelordner + Lerninsel-Kundenprojekt). PL und Writer lesen sie zu Beginn jeder Mission. Änderungen nur mit Datum + Begründung; Teil B nie absenken.*
