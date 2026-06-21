# SETUP — Schritt für Schritt

Diese Anleitung führt dich durch die Einrichtung von Claude Code. **Du musst nichts vorher können.** Tippe die Befehle so ab, wie sie dastehen. Nach jedem Schritt steht, woran du erkennst, dass es geklappt hat.

> Während Galvanik noch auf Antigravity läuft, brauchst du Claude Code noch nicht zwingend. Du kannst diese Einrichtung machen, sobald du vom Antigravity-Build wegmöchtest. Die Beweispflicht gilt in beiden Welten (in Antigravity über den PRÜFPHASE-Block).

---

## Schritt 0 — Was du brauchst

- einen Computer (Windows mit PowerShell oder Mac/Linux Terminal),
- ein Claude-Konto mit Claude Code,
- einen OpenAI-API-Key (für den GPT-5-Verifier),
- dieses Paket entpackt in einem Ordner.

---

## Schritt 1 — Claude Code installieren

Folge der offiziellen Anleitung von Anthropic zur Installation von Claude Code. (Da sich Installationswege ändern, lass dir den aktuellen Befehl im Zweifel von Claude im Chat geben — sag: „Wie installiere ich Claude Code aktuell?")

**Geklappt, wenn:** du im Terminal `claude` eintippen kannst und eine Reaktion bekommst.

---

## Schritt 2 — Das `.claude`-Verzeichnis an die richtige Stelle legen

In diesem Paket liegt der Ordner `04_CLAUDE_CODE_SETUP/.claude/`. Kopiere den **kompletten `.claude`-Ordner** in das Wurzelverzeichnis deines Projekts (z.B. in den Galvanik-App-Ordner).

```
# Beispiel Galvanik (Pfad bei dir anpassen):
# Windows PowerShell:
Copy-Item -Recurse ".\04_CLAUDE_CODE_SETUP\.claude" "C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\.claude"
```

**Geklappt, wenn:** im Projektordner ein Unterordner `.claude` mit `agents`, `rules`, `hooks`, `skills`, `config` existiert.

---

## Schritt 3 — OpenAI-API-Key als Umgebungsvariable setzen

Der Key gehört NIE in den Code und nie ins Terminal als Klartext-Befehl, der gespeichert wird. Setze ihn als Umgebungsvariable.

```
# Windows PowerShell (nur für diese Sitzung):
$env:OPENAI_API_KEY = "dein-key-hier"

# Mac/Linux (nur für diese Sitzung):
export OPENAI_API_KEY="dein-key-hier"
```

Für dauerhaft: in die Systemumgebungsvariablen eintragen (Claude kann dich auf Wunsch durch den genauen Klickweg führen).

**Geklappt, wenn:** `echo $env:OPENAI_API_KEY` (PowerShell) bzw. `echo $OPENAI_API_KEY` (Mac/Linux) deinen Key zeigt.

---

## Schritt 4 — Hooks prüfen

Die Hooks blockieren gefährliche Befehle und „fertig ohne Beweis". Sie liegen in `.claude/hooks/`. Die Datei `hooks.json` ist ein Startpunkt — je nach Claude-Code-Version musst du Hooks in den Einstellungen aktivieren. Sag Claude im Chat: „Aktiviere die Hooks aus meinem .claude/hooks-Ordner" — es führt dich durch den aktuellen Weg.

**Geklappt, wenn:** ein Testbefehl wie `rm -rf test` blockiert wird (NICHT ausführen, nur als Konzept — der Hook fängt ihn ab).

---

## Schritt 5 — Modell-Config kontrollieren

Öffne `.claude/config/MODELLE.json`. Hier stehen die Modelle je Tier. Du musst nichts ändern — aber du weißt jetzt: **Modell wechseln = nur diese Datei.** Der Market Scout schlägt dir Änderungen vor, du segnest ab.

---

## Schritt 6 — Erste Mission starten

Geh in den Projektordner und starte Claude Code. Sag:

```
Lies .claude und das Produktfirma-Paket. Starte als Mission Coordinator.
Erste Mission: Galvanik P0-Defekte — Scan→Order schreibt nichts in die DB,
und die OCR-URL ist ein Platzhalter. Klassifiziere, stelle das Team ein, leg los.
```

Ab hier übernimmt die Firma. Sie wird Beweise erzeugen und dich nur bei Entscheidungen fragen.

---

## Wenn etwas schiefgeht

Kopiere die Fehlermeldung in den Chat und sag „das kam, was nun?". Du bekommst die Ursache in einem Satz und den nächsten Schritt — keine Fehlerwand. Das ist der Mentor-Modus.

---

## Sicherheits-Erinnerung

- API-Keys nie in Dateien committen.
- DB-Passwort nie inline ins Terminal (der Hook blockiert das).
- Vor Go-Live alle Keys/Passwörter rotieren.
