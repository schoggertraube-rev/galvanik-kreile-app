# REVIEW H11 – Eine Rechte-Wahrheit

Prüfer: Claude · 28.10.2026 18:30 Berlin (17:30 UTC) · erste Prüfung
Branch `kreile/s1-p2-eingang`, Kopf/Produkt `5a090dc0`, Preview `galvanik-kreile-werkstatt-o6djjlc2z.vercel.app` (READY)

## Urteil: FAIL – 1 Blocker

### Blocker 1 – Datenbank nicht synchron, Kernweg H11 auf der Preview wirkungslos
- Datei: `supabase/migrations/20261028163707_h11_align_access_rights.sql` (ganze Datei); Abgabe `docs/delivery/ABGABE_H11.md:7` („Remote-/Live-Daten geändert: nein“).
- Befund: Remote (syhaigjhsbpjmtnggqka) 57 Migrationen, Repo 59 SQL. Fehlend remote: `20261028163707_h11_align_access_rights` (neu) und weiter `20261028115141_f2_today_layout` (Owner-Entscheid H10).
- Folge: Rolf hat auf der Preview weiter kein `logins` → `settings.actions.ts` lehnt Rechteänderung ab → Owner-Klickweg Schritt 4–6 (Rolf setzt Haken bei Phillip, DB-Nachweis) scheitert. Pflicht laut OWNER_ENTSCHEIDUNGEN Z. 29 Punkt 2: je Paket lokal grün, dann dieselbe Migration auf dieses Projekt einspielen, dann Preview prüfen.
- Änderung: `supabase db push` nur für `20261028163707` gegen syhaigjhsbpjmtnggqka (115141 nicht anfassen, bis Owner entscheidet; falls db push wegen Reihenfolge 115141 mitnehmen will: nur 163707 einzeln per `supabase migration up`/SQL-Apply mit identischem Inhalt). Danach in ABGABE_H11.md ergänzen: `migration list` remote vorher/nachher, SQL-Nachweis (Gregor ohne auftraege/eingang/kunden/geld/kassieren/mails; Rolf mit logins), Preview-Klick Rolf → Phillip-Haken → „Recht ist sofort wirksam.“, `granted_by = Rolf-ID`.

## Geprüft, in Ordnung
- DELETE in der Migration ist durch H11 Punkt 2 beauftragt („nur Rechte-Zeilen von Gregor, per Migration“); begrenzt auf role=developer und sechs Geschäftsbereiche, keine anderen Daten. Kein Blocker.
- Eine Quelle: `isAccessAreaAllowedForRole` in `authorizationContract.ts`, genutzt von `hasAuthorizationArea`, `resolveAuthorization`, `resolveLoginIdentityByEmail` und den fünf Befehlen; Gate-Test vorhanden.
- Inaktive Logins eigener eingeklappter Bereich; Farben nur Tokens (`--bg-app-soft`, `--text-muted`, `--neutral-gray-100`).
- Keine verbotenen Pfade (eslint.config.mjs nur Ignore `supabase/.temp/**`).


## Zweite Prüfung – 28.10.2026 20:28 Berlin (19:28 UTC)

**Urteil: PASS (Blocker 1 behoben).**
- `list_migrations` syhaigjhsbpjmtnggqka: jetzt 58, `20261028163707_h11_align_access_rights` remote angewandt. Kopf origin weiter `5a090dc0` (kein neuer Commit).
- Rest-Differenz Repo 59 vs. Remote 58 = nur `20261028115141_f2_today_layout` (Owner-Entscheid H10, kein Codex-Blocker).
- SQL-Nachweis (Gregor ohne Geschäftsbereiche, Rolf mit `logins`, `granted_by`) konnte der Prüfer nicht selbst lesen (DB-Lesezugriff im Lauf gesperrt); `ABGABE_H11.md` nicht ergänzt -> Owner-Klickweg Schritt 4–6 bestätigt es. Kein Blocker.
- H11 Rest a–f (U-216) liegt lokal uncommitted (12 src-Dateien) -> Prüfung nach Commit.
