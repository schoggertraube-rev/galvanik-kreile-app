# VERIFIER — ANTI-LÜGE-MECHANIK

Der Chief Verifier ist die technische Garantie, dass du nicht angelogen wirst. **Variante A:** GPT-5 über die **OpenAI-API direkt**.

---

## 1. Warum es funktioniert

- **Anderer Anbieter, anderes Modell.** Der Builder ist Claude. Der Prüfer ist GPT-5. Ein Modell kann seine eigene Behauptung nicht durchwinken.
- **Prüft Artefakte, nicht Worte.** Der Verifier bekommt Test-Logs, Query-Outputs, Screenshots, Deployment-IDs — nicht den Satz „ist fertig".
- **Kann nur bestehen, wenn die Artefakte aufgehen.** Fehlt ein Artefakt aus der Beweistabelle → Ablehnung, Status `UNVERIFIED`.

---

## 2. Risikoklassen und Prüf-Stack

| Klasse | Beispiele | Prüf-Stack |
|---|---|---|
| **R0 Minimal** | Doku, Markdown, Texte | nur Builder |
| **R1 Normal** | Bugfix < 50 Zeilen, Refactoring | Builder + T0-Maschinenprüfung (tsc/lint/test) |
| **R2 Hoch** | UI-Redesign, neues Feature, Integration | Builder + Maschine + **1× GPT-5** |
| **R3 Maximum** | Auth, Zahlungen (Mollie), irreversible Migration, P0-Defekt, RLS/Multi-Tenancy | Builder + Maschine + **2× GPT-5 (Doppelkontrolle)** |

**Doppelkontrolle bei R3** (deine Anregung): Zwei unabhängige GPT-5-Durchläufe mit unterschiedlicher Fragestellung —
1. Durchlauf „Bestätige nur, was die Artefakte zweifelsfrei belegen."
2. Durchlauf „Versuche zu widerlegen: Wo könnte das trotz grüner Artefakte falsch sein?" (Red-Team-Haltung)

Beide müssen passieren. Damit ist Doppelkontrolle dort, wo ein Fehler teuer/irreversibel ist — und nicht überall, was Kosten sparen würde.

---

## 3. Ablauf einer Verifikation

```
Builder meldet "fertig" + hängt Beweis-Artefakte an
        │
        ▼
T0-Maschinenprüfung (tsc, lint, test, schema-diff)  ── scheitert ─▶ zurück an Builder
        │ besteht
        ▼
Klasse R2/R3?  ── nein (R0/R1) ─▶ Mission Coordinator meldet dir Ergebnis
        │ ja
        ▼
GPT-5 prüft Artefakte gegen Akzeptanzkriterien
   R3: zweiter GPT-5-Durchlauf (Widerlegung)
        │
        ├─ Lücke gefunden ─▶ Befund ins RISK_REGISTER, zurück an Builder
        │
        └─ alles gedeckt ─▶ Verifier-Gegenzeichnung ins EVIDENCE_LEDGER
                              ─▶ Mission Coordinator meldet dir "fertig + Beweis"
```

---

## 4. Was der Verifier NICHT akzeptiert

- „Tests grün" ohne Report-Datei,
- „Migration durch" ohne Query gegen die echte Supabase-DB,
- „schreibt in DB" ohne SELECT-Beweis nach der Aktion,
- „live" ohne `curl`-200 und Deployment-ID,
- Akzeptanzkriterien, die nachträglich umformuliert wurden,
- Twin-Freigabe ohne dokumentierte Twin-Antwort.

---

## 5. Technische Einrichtung (Kurz, Details im Setup-Ordner)

- OpenAI-API-Key als **Umgebungsvariable**, nie im Code, nie im Klartext im Terminal.
- Verifier-Aufruf als Skript, das die Artefakt-Pfade einliest und an GPT-5 schickt.
- In Claude Code: angebunden über einen **Stop-Hook**, der „fertig" ohne Verifier-Gegenzeichnung blockiert.
- In Antigravity-Phase: Verifier wird als separater Schritt nach dem Build manuell ausgelöst (PRÜFPHASE verweist darauf).

---

## 6. Grenze (ehrlich)

Der Verifier senkt das Risiko drastisch, beseitigt es nicht zu 100 %. Er prüft, was als Artefakt prüfbar ist. Nicht prüfbar bleibt: ob der USP wirklich den Markt trifft, ob ein Twin die Realität korrekt abbildet, ob eine Geschäftsentscheidung klug ist. Dafür bleibst du als Stakeholder zuständig — plus echte Pilotnutzer nach Livegang.
