---
name: stop-gate-bash-lock-rule
description: Stop-Gate kann nur mit Bash-Freigabe oder expliziter manueller Bestätigung durchgeführt werden
metadata:
  type: feedback
---

## Stop-Gate-Bedingung bei Bash-Lock

**Regel:** Wenn Bash in `dontAsk`-Mode gesperrt ist, kann eine Stop-Gate-Bestätigung nur erfolgen, wenn BEIDE Bedingungen erfüllt sind:

1. Docker-Diagnose ist durchgeführt (manuell bestätigt)
2. Keine unbelegten Aufgaben stehen aus

**Why:** 
- Governance-Anforderung zur Kontrolle unvollständiger oder unbewiesener Auftragserfüllung
- Bash-Lock verhindert automatisierte Systembeweis-Erbringung
- Transcript-Zugriff fehlt → keine Log-basierte Validierung

**How to apply:**
- Vor Abschluss einer Mission: Explizite Bestätigung vom User einfordern, dass Docker-Access verified ist
- Keine Fertigmeldung ohne vollständiger Traceable Evidence (Akzeptanzkriterien, Nachweise, Logs)
- Bei Blockkern: Klar benennen ob `BLOCKED_EXTERNAL_PERMISSION` (Bash) oder `BLOCKED_PRODUCT_DECISION`
