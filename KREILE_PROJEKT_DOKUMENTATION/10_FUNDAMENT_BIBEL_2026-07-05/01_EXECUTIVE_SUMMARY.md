# 01 · Executive Summary

## Ampel des Fundaments

| Bereich | Ampel | Ein-Satz-Urteil |
|---|---|---|
| Auth-Bausteine (Session, Guards, Rollen) | 🟡 | Sauber gebaut, aber **nicht zentral erzwungen** (15/18 API-Routen ungeschützt). |
| Tenant-/RLS-Isolation | 🔴 | **Nur auf dem Papier** — App verbindet als Superuser, `app.tenant_id` wird nie gesetzt. |
| Datenbank-Schema & Migrationen | 🔴 | **Nicht reproduzierbar** — zentrale Tabelle/Spalte existieren nur remote, nie versioniert. |
| Datenpfade (Vernetzung) | 🔴 | **Zwei konkurrierende Welten + Mock-Schalter** in 9 Repositories = deine „Vernetzung funktioniert nicht"-Ursache. |
| Offline/Capture | 🔴 | **4 parallele Systeme**, eins reiner RAM-Mock; Original geht bei Crash verloren; base64 im localStorage. |
| SQL-Views & Berechnungslogik | 🟢 | Fachlich solide, größtenteils regelkonform — **wiederverwendbar**. |
| Transaktionslogik (Auftragsanlage) | 🟢 | Advisory-Lock, atomar — **wiederverwendbar**. |
| Build/Repo-Hygiene | 🟡 | Build grün, aber 647-Datei-Klon im Scan-Scope, Root verschmutzt, 404 Lint-Fehler als „Schuld" eingefroren. |
| Governance/Register | 🔴 | Cowork-Maschinerie vorhanden, **Register leer** → Entscheidungen gingen bisher verloren. |
| Secrets im Git | 🟢 | Nie committet — sauber. Lokal aber breit gestreut. |

## Kernzahlen (verifiziert)

- **613** Quelldateien in `src/`, **78** Seitenrouten, **18** API-Routen — davon **15 ohne jede Auth-Prüfung**.
- **136** Hardcodes von `galvanik-kreile` in **47** Dateien → Wiederverwendung blockiert.
- **9** Repositories mit `isSupabase`-Mock-Schalter → doppelte Datenwahrheit.
- **4** konkurrierende Offline-Systeme, davon 1 reiner RAM-Mock, 1 toter Code.
- **647** Dateien im verworfenen `.agents/`-Auth-Clone — liegen im tsconfig/eslint-Scan-Scope.
- **0** Treffer für `bcrypt/argon/scrypt/pbkdf2` → PINs im Klartext.
- **0** Treffer für `FORCE ROW LEVEL SECURITY` und für `set_config('app.tenant_id')` → RLS wirkungslos.
- QA-Gates: `tsc`=**0 Fehler**, Unit **75/75**, Build **77/77 Routen** — alle grün. **Aber**: das beweist nur Kompilierbarkeit, nicht Funktion.

## Warum du seit Wochen nicht vorankommst (die eine Ursache hinter den vielen Symptomen)

Es gibt **zwei getrennte Datenwelten**, die nie zu einer verschmolzen wurden:

1. **Server-Welt (Drizzle)** — verbindet als Datenbank-Owner, filtert Mandanten per hartkodiertem `"galvanik-kreile"` im TypeScript.
2. **Client-Welt (Supabase anon)** — liest über den Browser-Client, verlässt sich auf RLS, **die aber nie greift**, weil `app.tenant_id` nie gesetzt wird.

Dazwischen sitzt in 9 Repositories ein `isSupabase`-Schalter mit **Mock-Fallback**. Je nachdem, welcher Pfad zieht, sieht ein Screen **andere oder gar keine Daten** — und niemand merkt es, weil Fehler still verschluckt werden (leere `catch`, Fake-Erfolg). Das ist kein Bug an einer Stelle, den man „wegfixt". Es ist ein **struktureller Widerspruch im Fundament**. Solange er besteht, produziert jedes neue Modul neue Vernetzungsfehler. **Deshalb konvergiert die Arbeit nicht.**

## Die Board-Entscheidung (Fachvotum, Auftraggeber-Freigabe ausstehend)

> **Sanieren statt Neustart** — in 6 sequenziellen Wellen. **Bau-Stopp für neue Module**, bis Welle 0–2 (Blocker + kanonischer Datenpfad) abgeschlossen und per Laufzeitbeweis abgenommen sind.

Begründung: Der teure Teil (Datenmodell-Denkarbeit, Views, Transaktions- und Auth-Bausteine, die ganze Ideen-/Vertragsdokumentation) ist vorhanden und gut. Die Probleme sind **konzentriert, benannt und behebbar** — kein Totalschaden. Ein Neustart würde 4.385 Zeilen Ideenarbeit und einen soliden Kern wegwerfen und dieselben Fallen erneut aufstellen.

## Was zuerst passieren muss (P0 — vor allem anderen)

1. **Sicherheits-Blocker schließen** (Kapitel 03, Welle 0): 15 offene Routen, `customer-search`-Leak, `item-photo-upload`, öffentliche Storage-URLs, Klartext-PIN. Diese sind **DSGVO- und Missbrauchsrisiken** und dürfen eine Live-Instanz nie erreichen.
2. **Datenpfad-Dualität auflösen** (Welle 2): genau **ein** kanonischer Datenzugriff, Mock-Schalter raus.
3. **Schema reproduzierbar machen** (Welle 1): Baseline-Migration aus dem realen Remote-Schema, danach kein `db push` mehr.

Erst danach ist es sinnvoll, Module weiterzubauen — oder den Kern für Evas Lerninsel auszugründen (Kapitel 04).

## Livegang-Realismus

Ein *ehrlicher* Livegang des Slice-1-Kerns (Foto → Auftrag → erste Produktionskarte, mandantensicher, offlinefest) ist erreichbar, aber **nicht auf dem heutigen Stand**. Nach Welle 0–2 mit unabhängiger E2E-Abnahme ist ein kontrollierter Pilot-Livegang mit einem Mandanten verantwortbar. Details und Gate: Kapitel 07.
