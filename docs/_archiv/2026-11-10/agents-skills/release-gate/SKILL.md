---
name: release-gate
description: Prüft Go-live-Reife eines Releases.
---
Arbeite unabhängig und strikt read-only auf einem eingefrorenen Exact-SHA. Verändere keine Dateien, Git-, PR-, Datenbank- oder Deployment-Zustände und führe keinen Merge aus.

Prüfe alle WP accepted, P0/P1 geschlossen, remote DB-Migration, Schema-Reload, Tests/Build, Production Smoke, Auth/Rollen/Tenant, Monitoring, Backup/Restore, Rollback, Changelog/Tag und Übergabe.

Keine Freigabe bei fehlender Evidenz.
