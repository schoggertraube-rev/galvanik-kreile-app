# werkstatt/db - ehrlicher Vertrag

Dieses Modul besitzt keine Tabellen. Seine beiden Startseiten-KPIs kommen ausschliesslich
aus dem tenantgebundenen SQL-Vertrag `public.v_werkstatt_kpis_v1` (Migration
`20260908101500_werkstatt_kpi_view.sql`).

Die bestehenden Stations-Reads liefern weiterhin die Auftragskarten. Der App-Read-Port
liest genau einen typisierten KPI-Snapshot; fehlender Tenant-Kontext sowie fehlende oder
ungueltige Projektionen schlagen geschlossen fehl. `werkstatt` selbst leitet nur
Kartenreihenfolge, Risikogruppen und Buendelvorschlag ab. Auftrags- und Terminmengen
werden dort nicht berechnet. Keine eigene Persistenz und keine erfundene Eigentuemerschaft
an fremden Tabellen.
