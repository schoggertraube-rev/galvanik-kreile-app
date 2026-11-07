# Review Q6b Rest · Eingehende Mail zuordnen

Prüfer: Claude · 27.10.2026 22:27 Berlin (21:27 UTC)
Branch: kreile/s1-p2-eingang · Produkt-SHA 69e7ff7c · Kopf 807fbd55

## Urteil: **PASS** (Owner-Klickweg + DB-Nachweis offen, Regel 4d)

Keine Blocker.

- Zuordnung läuft über den vorhandenen transaktionalen Kommunikations-Port (`src/lib/server/communicationPort.ts`), kein zweiter Schreibweg, keine Migration.
- Rechte: Client (`GlobalCreateAppAdapter.tsx:79` `hasArea("mails")`) und Server (`communicationPort.ts:25-31`, `communications.actions.ts:24`) prüfen dieselbe Fläche `mails`; Rolle `developer` öffnet den Mailweg nicht mehr ersatzweise. Verschärfung, keine Öffnung.
- Fläche kommt aus `authorization.ts` (serverseitig aufgelöst), nicht aus dem Client.
- Keine Hex-Farben, kein verbotener Pfad, keine Demo-Daten.

Nicht-Blocker -> DEZEMBER_LISTE (Kommunikation am Kunden nur noch mit Fläche `mails` sichtbar).

Owner-Abnahme: Abschnitt „Owner-Abnahme“ in docs/delivery/ABGABE_Q06B_REST.md (Rolle Rolf, zwei TEST-Mails).
