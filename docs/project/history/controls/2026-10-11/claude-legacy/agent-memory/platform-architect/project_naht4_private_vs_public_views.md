---
name: naht4-private-vs-public-views
description: Ruling 2026-09-27 (PR #115/B2): Kriterium fuer private.v_* vs public.v_* ist ownsTables, nicht Konsumenten-Existenz; das S1-Gate ist absichtlich laxer als Naht 4
metadata:
  type: project
---

Architektur-Entscheid 2026-09-27 (PR #115, Paket B2 "Auftrag-Zeitpunkte", Runde 3): Ob ein Modul-Lesevertrag `private.v_*` oder `public.v_*` heissen darf, entscheidet sich **allein daran, ob `ownsTables` im Modul-Manifest die Basistabellen dem Modul zuordnet** — nicht daran, ob der Fremdkonsument schon existiert und nicht daran, ob die View direkt oder nur ueber einen TS-Port gelesen wird. Modul mit `ownsTables: []`, das `public.orders`/`public.events` liest, produziert Fremdfakten → `public.v_*`.

**Why:** Naht 4 (`docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md`) nennt als Kriterium ausschliesslich Eigentum ("Fremdfakten nur ueber `public.v_*`"). Der Begriff `private.v_*` kommt im Nahttext nicht vor — er stammt aus der Implementierung von `scripts/quality/check-module-gates.mjs`, die `private.v_*` bei Ein-Modul-Deklaration durchlaesst und dabei selbst sagt "private Views/Funktionen sind keine Cross-Modul-Naht". Ein Modul mit leerem `ownsTables` kann darueber jede Fremdtabelle waschen: bekannte, bewusste Gate-Luecke, kein Freibrief (AGENTS.md: "Gruen in der CI ist NICHT genug"). Das Argument "public wuerde die Leserschaft verbreitern" ist sachlich falsch: Schemaplatzierung != Grants — `public.v_werkstatt_kpis_v1` (`supabase/migrations/20260908101500_werkstatt_kpi_view.sql`) haertet mit `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT SELECT TO service_role` und ist damit fuer PostgREST unerreichbar.

**How to apply:** Bei jedem neuen SQL-Lesevertrag in einem Modul erst `ownsTables` pruefen. Eigene Tabellen → `private.v_*` ist korrekt (Muster `customers`, `quotes`). Fremde/unbesitzte Tabellen → `public.v_*` plus REVOKE/GRANT-Haertung (Muster `werkstatt`). `private.v_payment_summary_v1` und `private.v_goods_out_ui_state_v1` sind KEIN Precedent fuer modul-deklarierte Vertraege: sie werden aus `src/lib/server/*` gelesen, stehen in keinem Manifest und liegen ausserhalb der Gate-Sicht. Offen bleibt Q-G04-008 (Eigentum an `public.orders`/`public.events`, Owner PL/Architektur) — solange unentschieden, gilt `public.v_*`. Siehe [[project-b1-b2-branch-stack]], [[reference-moduldossiers]].
