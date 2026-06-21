# LIVE-DATA-POLICY (absolut, alle Projekte)

- Kein `Math.random()`, keine Mock-Fallbacks, keine hartkodierten Werte in irgendeinem Produktpfad.
- NULL/leere DB → „Noch keine Daten erfasst" mit Aktionslink anzeigen, nie erfundene Zahlen.
- Alle KPI-Berechnungen ausschließlich in SQL-Views, nie in TypeScript/React.
- Jede Kennzahl muss auf ihre Quelle rückführbar sein.
- KI verwendet sparsam, nur auf manuellen Trigger (Aktualisierungs-Button), rät nie, erfindet nie Daten.
- Fallback-Eskalation: Regeln → günstiges Modell → starkes Modell → Mensch; 90–95 % der Operationen ohne KI-Kosten.

## Priorität (Galvanik)
Stabilität → Datenintegrität → Sicherheit → Performance → echte End-to-End-Konnektivität.
