# W3 Order Station Transition Evidence

```yaml
BASE: 465f8967a0bd55baf3cbd2d496cbb6dc7bcbefe6
SCOPE: wareneingang-to-galvanik-only
COMMAND_RESULT: OK | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION_ERROR | UNAVAILABLE
READBACK: fresh tenant-bound Wareneingang and Galvanik reads; source absence plus target presence and version increment
READ_CAPABILITY: perm_view_leitstand
COMMAND_CAPABILITY: perm_op_status
LOCAL_DB_REPLAY: PENDING
W4_PENDING: Events, Evidence, Attachments, versionierte SQL-Read-Models
REMOTE_PRODUCTION: BLOCKED_EXTERNAL_PERMISSION
```

## Lieferumfang

- Einziger aktivierter Command: `wareneingang -> galvanik` mit Session, Tenant,
  Capability, Ownership, Item-Lock und `expectedVersion`.
- Der Item-Lock enthält den Tenant-Prädikat; der Legacy-Stationswriter bleibt
  unmittelbar `NOT_AVAILABLE`.
- Die UI meldet Erfolg erst nach zwei frischen autorisierten Reads: Auftrag nicht
  mehr im Wareneingang und als `ready` mit inkrementierter Version in Galvanik.
- Nicht bestätigte oder fehlgeschlagene Readbacks melden keinen Erfolg und sperren
  den Retry dieser Browser-Sitzung.
- Stations-Read ist für `readonly` und `buero` ausschließlich tenantgebunden und
  read-only mit `perm_view_leitstand`; er verwendet weder Service-Role noch Mutation.
- Der negative Rollen-/Capability-Test belegt, dass `readonly` und `buero` mit
  `perm_view_leitstand` keinen Command erlauben und vor Öffnung einer Transaktion
  `FORBIDDEN` liefern. Der adversariale
  Tenanttest belegt, dass ein eingeschleustes `tenant-b`-Argument ignoriert und
  ausschließlich der aufgelöste Authorization-Snapshot für `tenant-a` verwendet wird.
- Stations-Start und -Abschluss sowie alle übrigen Legacy-Writer bleiben bewusst
  nicht verfügbar.

## Nachweisgrenze

Die Migration ist nur ein lokaler Kandidat. Ein lokaler Datenbank-Replay steht bis
zum separaten Docker-Gate auf `PENDING`. Dieser Nachweis behauptet weder eine
Remote-Migration noch eine Production-Prüfung oder einen F0-PASS. W4 schließt
Events, Evidence, Attachments und versionierte SQL-Read-Models Ende-zu-Ende.
