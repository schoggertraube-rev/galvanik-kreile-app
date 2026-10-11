---
name: release-gate
description: Prüft Go-live-Reife eines Releases.
---
Prüfe alle WP accepted, P0/P1 geschlossen, remote DB-Migration, Schema-Reload, Tests/Build, Production Smoke, Auth/Rollen/Tenant, Monitoring, Backup/Restore, Rollback, Changelog/Tag und Übergabe.

Keine Freigabe bei fehlender Evidenz.
