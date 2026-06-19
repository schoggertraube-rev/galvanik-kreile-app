# Connector- und Tool-Governance

Connectoren und Programme werden nur vorgeschlagen, wenn sie einen konkreten Projektbedarf besser lösen als Eigenbau oder vorhandene Mittel.

## Bewertungsmatrix

| Kriterium | Frage |
|---|---|
| Problem | Welcher Engpass wird gelöst? |
| Nutzen | Welche Zeit-, Qualitäts- oder Geldwirkung entsteht? |
| Daten | Welche Daten werden gelesen oder geschrieben? |
| Auth | Wie wird Zugriff gesichert? |
| Datenschutz | Wo werden Daten verarbeitet? |
| Kosten | Einmalig, laufend, transaktionsabhängig |
| Lock-in | Wie schwierig ist ein Wechsel? |
| Performance | Welche Latenz und Ausfallabhängigkeit entsteht? |
| Fallback | Was passiert bei Ausfall? |
| Wartung | Wer betreibt die Integration? |
| Vertrag | Welcher Adapter wird definiert? |
| Empfehlung | einsetzen / Pilot / später / ablehnen |

## Kategorien

Supabase, Git/GitHub, Vercel, Monitoring, Resend, Mollie, Kalender, Google/Gemini/Places, OCR, Buchhaltung, Kommunikation, Remote MCP und BI.

## Sicherheitsregel

Least Privilege, getrennte Umgebungen, Secrets, Audit, Rate Limits, Health Check, Retry, Fallback, Deaktivierbarkeit und Kostenalarm.

## Cowork-Hinweis

Für Cowork externe Tools nur über unterstützte beziehungsweise benutzerdefinierte Remote-MCP-Connectoren anbinden. Vor Einrichtung aktuelle offizielle Dokumentation prüfen.
