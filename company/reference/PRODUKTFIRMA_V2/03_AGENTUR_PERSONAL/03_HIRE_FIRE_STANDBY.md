# HIRE · FIRE · STANDBY — flexibles Team statt starrer Org

Dein Wunsch: ein Team, das automatisch die Richtigen einstellt, andere auf Standby hält, feuert, externe Profis hinzuruft und nicht in 2 Monaten veraltet. So funktioniert das mechanisch.

## 1. Drei Zustände jeder Rolle
| Zustand | Bedeutung |
|---|---|
| **Aktiv (hired)** | in einer laufenden Mission eingesetzt, Modellkosten laufen |
| **Standby** | definiert im Katalog, aber nicht aktiv, kostet nichts |
| **Gekündigt (fired)** | aus dem Katalog entfernt/ersetzt, weil veraltet oder überflüssig |

## 2. Einstellung (hire)
Der Mission Coordinator stellt je Mission nur die Rollen ein, die diese Mission braucht — anhand von Aufgabe und Risikoklasse. In Claude Code = die passenden Subagenten in `.claude/agents/` werden aufgerufen. Beispiel P0-Galvanik: Mission Coordinator + Data Contract Engineer + OCR Specialist + Backend Engineer + Frontend Engineer + Test Automation + RLS/Auth + QA + Red Team + Chief Verifier. Die anderen ~30 Rollen bleiben Standby.

## 3. Standby
Nicht benötigte Rollen liegen als Definition bereit, verursachen aber keine Kosten und keinen Lärm. Das ist der Schlüssel gegen den 100-Rollen-Dauerbetrieb von Konzept 08: Tiefe im Katalog, Ruhe im Betrieb.

## 4. Kündigung (fire)
Eine Rolle wird gekündigt/ersetzt, wenn:
- ein neues Tool/Modell ihre Aufgabe besser erledigt (Marktscan),
- ihr Fähigkeitsprofil veraltet ist,
- sie redundant zu einer anderen Rolle wurde.
Der Vorgang wird in `05_REGISTER/AGENT_ROSTER_STATUS.md` protokolliert (wer, wann, warum) — du kannst jederzeit sehen, wer am Produkt arbeitet.

## 5. Externe Profis
Fehlt Kompetenz, die keine virtuelle Rolle abdeckt, wird ein externer Connector/Experte vorgeschlagen (z.B. Klippa für OCR, Mollie für Payments, echter Penetrationstest, Rechts-/Steuerberatung). Kostenpflichtig → Eskalation an dich.

## 6. Warum das deine Kontrollsorge löst
- **Wenige aktive Rollen** → überschaubar, jede liefert ein prüfbares Artefakt.
- **Audit-Log** → nachvollziehbar, wer eingestellt/gekündigt wurde.
- **Beweispflicht** → auch ein „Weltklasse-Experte" muss liefern, nicht behaupten.
- **Kein Idle-Lärm** → 30 Standby-Rollen reden nicht mit, bis sie gebraucht werden.
