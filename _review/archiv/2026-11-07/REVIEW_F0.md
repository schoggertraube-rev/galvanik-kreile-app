# Review F0 · Login, Logins & Rechte, eigener Code

Prüfung: 27.10.2026 17:27 UTC (18:27 Berlin) · Prüfer Claude
Branch `kreile/s1-p2-eingang` · Kopf 333b61cb (Produkt 32294468) · PR #154
Preview: https://galvanik-kreile-werkstatt-8b4zqhnwm.vercel.app (READY, Kopf 333b61cb)

## Urteil: keine Blocker im F0-Code · PASS erst nach Owner-Klickweg (Regel 4d) und behobenem H1

## Geprüft

- Migration 20261027180000_f0_user_access_areas: additiv (neue Spalten kuerzel/bezeichnung, neue Tabelle app_user_rights, View ersetzt), keine alte Migration geändert, kein DELETE/DROP von Daten. `email DROP NOT NULL` nur für PIN-Logins. RLS enabled+forced, anon/authenticated/PUBLIC ohne Rechte. Remote angewandt (47 = Repo 47).
- Rechte: resolveAuthorization liest Bereiche bei jedem Aufruf aus app_user_rights; Rollen nur Vorlage. Alle Serveraktionen (Settings, Zahlung, Rechnung, Auftragskarte) auf Bereiche/Permissions umgestellt.
- Aussperrschutz: letzter aktiver Login mit `logins` nicht abwählbar/deaktivierbar; developer-Rechte `logins`/`wartung` fest.
- PIN: bcrypt (12), nur 4 Ziffern, Sitzung nach eigenem Code neu ausgestellt.
- Settings-Lesen blendet Firmendaten/Nummernkreise/Logins ohne passenden Bereich aus.
- Keine Hex-/rgb-Farben in neuen src-Zeilen. Keine verbotenen Pfade (scripts/ui beauftragt).
- spec-check laut Abgabe 8/8, 0 fehlend.

## Nicht als FAIL (DEZEMBER_LISTE)

- Werkstatt-Vorlage darf Termin/Inhalt bearbeiten (vorher nur Büro/Meister/Admin).
- Rechnungsstorno jetzt für jeden mit `geld` (vorher nur Meister/Admin).
- createManagedUser/setManagedUserArea prüfen `canManage` (immer true); Schutz hängt allein an der Action-Prüfung `logins`.
- 4-stelliger Code ohne nachgewiesene Fehlversuch-Sperre.

## Offen für PASS

1. H1 (Auftragskarte „nicht verfügbar“, Owner-Fund 18:10) beheben – Kernweg, gleicher Branch. Codex arbeitet daran (uncommitted).
2. Owner-Klickweg ABGABE_F0 Schritte 1–6; danach prüft der Prüfer app_users/app_user_rights.
