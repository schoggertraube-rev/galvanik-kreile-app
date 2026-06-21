# PRODUKTFIRMA — Start hier

**Version:** 2.0 · **Stunde null** · ersetzt die alten Konzepte `08_AUTONOME_WELTKLASSE_PRODUKTFIRMA.md` und `09_UMSETZUNGSPLAN_COWORK_CLAUDECODE_TOOLCHAIN.md`.

Du musst nichts können. Dieses Paket ist so geschrieben, dass es dich Schritt für Schritt führt. Lies diese Seite, dann öffne die Ordner in der Reihenfolge der Nummern.

---

## Was das hier ist

Eine virtuelle Produkt-Agentur, die deine Apps baut. Sie ist:

- **schlank steuerbar** statt unkontrollierbar groß,
- **tief** statt breit-und-flach,
- **beweispflichtig** statt behauptend — sie kann dich technisch nicht anlügen,
- **erweiterbar** für alle drei Projekte (Galvanik, Hotel-Rev, Evas Lerninsel) und spätere Kunden.

Oberstes Ziel: **Kundenzufriedenheit nach Livegang.** Alles andere ordnet sich dem unter.

---

## Die drei Ebenen — bitte nicht verwechseln

| Ebene | Wer / Was | Aufgabe | Liegt in Ordner |
|---|---|---|---|
| **A — Du (Stakeholder)** | Du | USP festlegen, Ideen einbringen, Produkt/Design endabsegnen, Nutzerprofile (Twins) liefern | `02_DEINE_SCHNITTSTELLE` |
| **B — Build-Team (Agentur)** | Claude.ai Project + Claude Code + (Übergang: Antigravity) | Baut, prüft, bringt live | `03_AGENTUR_PERSONAL`, `04_CLAUDE_CODE_SETUP` |
| **C — In-App-Assistent** | Claude-API **in** der fertigen App | Hilft den **Endnutzern** täglich („allwissender Mitarbeiter") | Roadmap, eigene Mission **nach** Galvanik-Stabilisierung |

> Deine Vision „die App ist der beste, allwissende Mitarbeiter" = **Ebene C**. Das ist eine **Produktfunktion**, kein Team-Mitglied. Wir bauen sie bewusst später, weil sie eigene Kosten (API pro Nutzerfrage) und eigene DSGVO-Pflichten hat. Details: `06_ROADMAP/00_LAYER_A_B_C.md`.

---

## Wie die Agentur aufgebaut ist (1 Bild)

```
DU (Stakeholder)
   │  Ideen · USP · Twins · Endabnahme
   ▼
PERSISTENTER KERN (3 Rollen, immer aktiv)
   ├─ Mission Coordinator   → nimmt Ideen, stellt ein/aus, koordiniert, redet mit dir
   ├─ Product Steward       → wacht über USP, bereitet deine Entscheidungen vor
   └─ Chief Verifier (GPT-5)→ prüft Beweise, blockiert Lügen, gibt nichts frei ohne Beleg
   │
   ▼
USER-TWIN-RAT (deine hochgeladenen Nutzerprofile)
   └─ Pflicht-Konsultation + Veto bei Design und vor Livegang
   │
   ▼
SPEZIALISTEN-POOL (~40 Rollen im Katalog, nur wenige je Mission AKTIV)
   ├─ werden je Mission „eingestellt"  (hire)
   ├─ liegen sonst auf „Standby"
   ├─ werden bei Veralten „gekündigt"  (fire)
   └─ externe Profis als Connector (Klippa, Mollie, …)
   │
   ▼
DAUER-DIENSTE (quer)
   ├─ Market & Tooling Scout → scannt wöchentlich neue Modelle/Tools, schlägt Updates vor
   └─ Knowledge Officer      → sammelt Lessons-Learned, Firma wird mit jeder Mission besser
```

Warum so und nicht 100 Dauer-Rollen: siehe `03_AGENTUR_PERSONAL/03_HIRE_FIRE_STANDBY.md`. Kurz: **viele Experten im Katalog (Tiefe), wenige gleichzeitig aktiv (Kontrolle).**

---

## Der ehrliche Punkt zu „Lebensläufen"

Du wolltest Vitæ und Referenzen für jeden Mitarbeiter. **Erfundene Lebensläufe („Ex-Google, 12 Jahre Stripe") machen keinen Subagenten besser** — und sie arbeiten gegen dein wichtigstes Ziel: nicht angelogen zu werden. Eine erfundene Autorität tarnt Fehler.

Echte Expertise lebt nicht im Logo auf dem Lebenslauf, sondern in den **Methoden und Standards**, die eine Weltklasse-Kraft anwendet. Darum bekommt jede Rolle ein **Fähigkeitsprofil**: die konkreten Frameworks, Checklisten und Prüfstandards, die sie beherrscht. Das steht real im System-Prompt des Subagenten und macht ihn messbar besser. Statt „hat bei X gearbeitet" → „wird an WCAG 2.2, Nielsen-Heuristiken, Jobs-to-be-Done gehalten". Siehe `03_AGENTUR_PERSONAL/00_ROSTER_HANDBUCH.md`.

---

## Was DU tust (3 Dinge, sonst nichts)

1. **Ideen einwerfen** — formlos, im Project-Chat. Format: `02_DEINE_SCHNITTSTELLE/01_IDEA_FORMULAR.md`.
2. **Twins hochladen** — als Markdown-Datei ins Project. Vorlage: `02_DEINE_SCHNITTSTELLE/02_TWIN_TEMPLATE.md`.
3. **Absegnen** — Design siehst du als klickbaren Visual Pitch, Entscheidungen kommen als 5-Zeilen-Vorlage. `04_VISUAL_PITCH_PFLICHT.md`, `01_VERFASSUNG/05_ESKALATION_AN_DICH.md`.

Alles andere erledigt die Agentur. Du wirst nie mit technischen Detailfragen behelligt.

---

## Reihenfolge zum Loslegen

| Schritt | Was | Wo |
|---|---|---|
| 1 | Diese Seite lesen | hier |
| 2 | Verstehen, wie Beweise & Modelle funktionieren | `01_VERFASSUNG/` |
| 3 | Claude Code einrichten (geführt) | `04_CLAUDE_CODE_SETUP/SETUP_ANLEITUNG_SCHRITT_FUER_SCHRITT.md` |
| 4 | Erste Mission: Galvanik P0-Defekte fixen | `06_ROADMAP/01_ROADMAP_GALVANIK.md` |
| 5 | Twins für Galvanik im anderen Chat erstellen, hochladen | `02_DEINE_SCHNITTSTELLE/03_TWIN_UPLOAD.md` |

Du bist Stakeholder. Du gibst Richtung und Freigabe. Die Firma liefert Ergebnisse und Beweise.
