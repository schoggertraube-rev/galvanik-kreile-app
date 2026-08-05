# Produktentscheidung: PIN-Sicherheitsstrategie

Stand: 2026-08-05 — korrigierter Live- und Recovery-Status

## Entscheidung

Dreischichtiger Schutz: serverseitiges Hashing, serialisiertes Rate-Limiting und
eine noch festzulegende Device-Challenge. Sitzungen muessen nach einer
sicherheitsrelevanten Benutzeraenderung widerrufbar sein.

## Status der Schichten

| Schicht | Production | Recovery-Kandidat |
|---|---|---|
| Rate-Limiting-Tabelle | vorhanden | unveraendert |
| Rate-Limiting-Logik | gestuft, aber Check und Zaehler nicht gemeinsam serialisiert | Advisory-Lock sowie Check, Vergleich und Zaehler in einer Transaktion |
| bcrypt-Code | Lazy-Migration vorhanden | neue und rotierte PINs immer bcrypt cost 12 |
| PIN-Bestand | 0 bcrypt / 6 Legacy | In-place-Migration ausstehend; keine Werte werden ausgelesen |
| Session-Widerruf | nur Rolle/Aktivstatus indirekt geprueft | `updated_at` widerruft aeltere Sitzungen nach Rolle, Status oder PIN-Aenderung |
| Device-Binding / Challenge | offen | offen |
| 6-stellige PIN / WebAuthn | offen | offen |

## Vertraege

- PIN-Eingaben bestehen aus genau vier Ziffern.
- PIN-Werte werden nie geloggt, nie im DTO geliefert und nie als Klartext gespeichert.
- Admin-Neuanlage und PIN-Rotation hashen ausschliesslich serverseitig.
- PIN-Rotation und Lock-Reset sind atomar.
- Parallele Versuche desselben Operators werden vor der Sperrpruefung serialisiert.
- 5 Fehlversuche sperren 15 Minuten, 10 sperren 60 Minuten, 20 dauerhaft.
- Die Bestandsmigration bricht bei einem unbekannten Altformat ab, statt Werte
  still umzudeuten.

## Noch offene Produktentscheidung

Device-Binding bleibt P1. Vor Implementierung sind Enrollment, Verlust/Wechsel des
Geraets, maximale Geraetezahl und Chef-Freigabe als Werkstattablauf festzulegen.
Der Recovery-Kandidat behauptet diesen Teil nicht als erledigt.
