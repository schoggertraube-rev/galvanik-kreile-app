---
name: b2-stacked-on-unmerged-b1
description: claude/kr-b2-auftrag-zeitpunkte enthaelt die noch nicht gemergten B1-Storno-Commits; ein Merge von B2 nach main merged B1 inkl. Migration 20260926120000 mit.
metadata:
  type: project
---

Stand 2026-09-28 (Review-Nacharbeit zu PR #115 nachgeprueft): `claude/kr-b2-auftrag-zeitpunkte`
ist nicht von `main` abgezweigt, sondern auf den noch offenen B1-Branch gestapelt.
`origin/main` = `21a23567` (Merge PR #112) ist gleichzeitig die Merge-Base; `origin/main..HEAD`
enthaelt inzwischen zehn Commits, davon zwei B1-Commits (`517720de`, `0d3bacc6`).
`git diff origin/main...HEAD` umfasst deshalb B1-Artefakte, die nichts mit G04 zu tun haben:

- `supabase/migrations/20260926120000_f1_4_invoice_cancel_payment_guard.sql`
- `src/test/f1_4_invoice_cancel_payment_guard.integration.test.ts`
- Aenderungen an `src/test/f1_4_immutable_invoice_contract.integration.test.ts`
- den F1.4-Storno-Schritt in `.github/workflows/quality.yml`

**Why:** Ein Merge des B2-PR nach `main` zieht damit stillschweigend B1 (PR #114,
nicht gemergt, Review-Oszillation offen) samt einer Migration mit. AGENTS.md verlangt
fuer Merge und Remote-Supabase-Migration ausdrueckliche Freigabe — die hier fuer B1
nicht vorliegt. Die Reihenfolge (B1 erst mergen und B2 rebasen, oder PL entscheidet
explizit) ist eine PL-Entscheidung, keine technische.

**How to apply:** Bei jeder B2-Abnahme diesen Umstand als eigenen Befund nennen und
den Scope-Nachweis auf `git diff main...HEAD` stuetzen, nicht auf den Worktree-Diff —
sonst sieht das Paket sauber aus. Der Hinweis stand einmal als `base_note` im
`out_of_band_packages`-Block der Missionsdatei; dieser Block wurde im Worktree von
Runde 5 wieder entfernt, der Stacking-Sachverhalt bleibt aber real. Nach einem
B1-Merge und B2-Rebase ist diese Notiz obsolet — dann pruefen und loeschen.
Verwandt: [[b1-storno-ci-wiring-oscillation]], [[g07-dossier-not-authoritative]],
[[package-deliverables-arrive-uncommitted]].
