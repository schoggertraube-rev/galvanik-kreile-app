# 08 · Kommende Komplikationen & Tipps (über den Tellerrand)

Was dich auf dem Weg zum Livegang noch treffen wird — und wie du es entschärfst, **bevor** es Wochen frisst.

---

## Komplikation 1 — Die „Reconcile-Falle" schlägt wieder zu

Sobald du eine Baseline-Migration erzeugst (Welle 1), wirst du feststellen, dass Remote-DB und Migrationen an mehr Stellen abweichen als die zwei bekannten (events, current_station_id). Es gibt uuid-vs-text-Reste aus einer alten Umstellung.
**Tipp:** Mach **einmal** einen vollständigen `pg_dump --schema-only` der Remote-DB zum Wahrheitsanker. Diffe *jede* vermeintlich vorhandene Tabelle. Danach **friere** das Schema ein: `db push` und ad-hoc-`apply_migration` per MCP komplett verbieten (auch in AGENTS.md notieren). Jeder Sonderweg reißt die Reproduzierbarkeit sofort wieder ein.

## Komplikation 2 — RLS scharfstellen bricht erstmal alles

In dem Moment, wo du von Superuser auf eine echte App-Rolle mit FORCE RLS umstellst (Welle 3), werden **alle** Queries, die keinen Tenant-Kontext setzen, plötzlich leere Ergebnisse liefern. Das fühlt sich an wie „jetzt ist alles kaputt".
**Tipp:** Das ist **erwünschtes** Verhalten — es macht die vorher unsichtbaren Lücken sichtbar. Führe `SET LOCAL app.tenant_id` **zentral** in einem Transaktions-Wrapper ein (nicht in 200 Einzelqueries). Teste mit zwei künstlichen Tenants von Tag 1 — nie mit nur einem, sonst bleibt der Defekt unsichtbar (genau der heutige Fehler).

## Komplikation 3 — Der Datenpfad-Umbau (Welle 2) berührt sehr viele Dateien

136 Hardcodes, 9 Mock-Repos, ~48 Drizzle- und ~27 anon-Nutzer. Das ist ein großer, angstbesetzter Umbau.
**Tipp:** Nicht alles auf einmal. Gehe **entität-für-entität** (erst Orders, dann Customers, dann Items …). Pro Entität: kanonischen Server-Zugriff bauen, Konsumenten umhängen, Mock-Zweig löschen, Screen verifizieren. So bleibt jederzeit ein lauffähiger Stand. Ein „Big Bang" hier ist der sichere Weg in die nächste Wochen-Blockade.

## Komplikation 4 — Offline-Konsolidierung bricht bestehende Screens

Wenn du 3 der 4 Offline-Systeme entfernst (Welle 4), verlieren deren Konsumenten ihre Imports.
**Tipp:** Erst **alle** Konsumenten von `useOfflineManager`/`idbSync`/`OfflineManager` auf `OfflineOutbox` migrieren, **dann** löschen. `grep -r` auf die Importpfade als Vollständigkeitscheck. Und: teste Offline **wirklich offline** (DevTools → Network → Offline + echter Reload), nicht nur im Happy Path.

## Komplikation 5 — Gemini/Kosten & Timeouts

Ungeschützte KI-Proxies (F-A8) + kein Timeout (F-G1) = ein einziger Bot kann echte Kosten verursachen, und ein langsamer Gemini-Call hängt Requests bis zum Plattform-Timeout.
**Tipp:** Timeout (AbortController) + Auth + einfaches Rate-Limit sind billig und gehören in Welle 0/4. Entscheide früh: **synchron** (mit Timeout, ohne Polling) **oder** **asynchron** (Queue + echtes Statuspolling) — heute ist es unglücklich beides gleichzeitig.

## Komplikation 6 — Der grüne Build lullt ein

Weil `tsc`/Build grün sind, entsteht das Gefühl „läuft doch". Genau dieses Gefühl hat vermutlich mit zum 35%-Trugschluss beigetragen.
**Tipp:** Miss ab jetzt **Funktion, nicht Kompilierbarkeit**. Führe die Livegang-Gates G1–G11 (Kapitel 07) als reale Checks ein. Ein Feature gilt erst als fertig, wenn sein Laufzeitbeweis existiert — nicht wenn es baut.

## Komplikation 7 — Lint-Baseline-Schuld

404 Fehler/370 Warnungen sind als „Schuld" eingefroren. Der Ratchet verhindert *neue* Fehler, tilgt aber die alten nie.
**Tipp:** Tilge die 404 **Fehler** (nicht nur Warnungen) in kleinen Batches parallel zu den Wellen. Sonst maskiert das Rauschen irgendwann einen echten neuen Fehler.

## Komplikation 8 — Governance-Rückfall

Die Register waren leer, weil sie freiwillig sind. Unter Zeitdruck werden sie es wieder.
**Tipp:** Mach Register-Pflege zum **Abschlusskriterium** jeder Mission (kein PASS ohne aktualisiertes FINDINGS/DECISION/CHANGELOG). Sonst wiederholt sich exakt das Problem, das dich hierher gebracht hat: verlorene Entscheidungen.

---

## Fünf Leitsätze für den Weg (an die Wand hängen)

1. **Eine Wahrheit pro Sache.** Ein Datenpfad, eine Outbox, eine Stationsspalte, ein Schema-Anker.
2. **Sicherheit ist kein Feature, sondern die Startbedingung.** Erst 401/RLS/Hash, dann alles andere.
3. **Fertig heißt bewiesen.** Kein „fertig" ohne Laufzeitnachweis.
4. **Tenant kommt aus der Session, nie aus dem Code.** Das ist der Schlüssel zu Kreile *und* Evas Lerninsel.
5. **Register führen, sonst verlierst du wieder.** Entscheidungen gehören ins Register, nicht in den Chatverlauf.

---

## Ein ehrliches Schlusswort

Du hast nicht „nichts" nach diesen Wochen. Du hast ein durchdachtes Datenmodell, gute Auth-Bausteine, solide Views, eine echte Outbox, 4.385 Zeilen Ideenarbeit und drei präzise User Twins. Was fehlte, war **Verdrahtungsdisziplin** und **eine einzige Wahrheit pro Sache**. Das ist reparierbar — und der Reparaturweg macht das Fundament gleichzeitig mehrprojektfähig. Der 35%-Eindruck täuscht: die teure Denkarbeit ist weiter fortgeschritten, nur die letzten, entscheidenden 20% Verdrahtung fehlen — und die sind jetzt benannt.
