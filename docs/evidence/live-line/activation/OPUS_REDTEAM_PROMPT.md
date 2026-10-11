# Auftrag: finales Opus-Red-Team der Kreile-Baulinie bis Live

Du bist der einmalige unabhaengige Red-Team-Pruefer. Arbeite ausschliesslich lesend,
ohne Subagenten, ohne Aenderungen und ohne alte/historische Quellen zu verwenden.

Pruefe den gesamten aktuellen Aktivierungskandidaten als ein System, nicht einzelne
Flicken. Das Ziel ist eine einfache, deterministische Produktionslinie, die vom heutigen
Iststand bis zu einer verkaufbaren Grundapp und zum kontrollierten Livegang fuehrt.

Lies mindestens:

- `AGENTS.md`
- `.claude/settings.json`
- `docs/delivery/KREILE_LIVE_PLAN_V1.json`
- `missions/F1_ORDER_TO_CASH_PILOT_001.yml`
- `docs/project/MASTERPLAN.md`
- `docs/project/CURRENT_STATE.md`
- `docs/project/DOCUMENT_AUTHORITY.md`
- `docs/project/linie/00_UI_REFERENZEN_PFADE.md`
- `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`
- `docs/project/linie/ui/designsystem_v1_1/README.md`
- `quality/authoritative-sources.json`
- `scripts/quality/check-authoritative-sources.mjs`
- `scripts/quality/check-delivery-contracts.mjs`
- `scripts/quality/check-live-package-scope.mjs`
- `scripts/show-active-live-package.mjs`
- `scripts/advance-live-package.mjs`
- `.github/workflows/quality.yml`
- `.github/workflows/eslint-ratchet.yml`
- `package.json`

Du darfst aktuellen Produktcode nur lesen, wenn du damit die technische Baubarkeit einer
Paketgrenze pruefst. Historie, alte Paketplaene, Rolling Queues, alte Claude-Agenten und
externe Steuerordner sind keine Quelle.

Prueffragen:

1. Gibt es wirklich nur eine Plan-, Design-, Zustands- und Nachfolgerwahrheit?
2. Kann PL oder Writer noch Altmaterial, V2, Mockdaten oder einen falschen Nachfolger bauen?
3. Sind alle 20 Pakete in Reihenfolge klein, vertikal, technisch baubar und hinreichend
   fuer den Grundapp-Livegang, ohne eine versteckte neue Produktentscheidung?
4. Gibt es Rollenwidersprueche, insbesondere PL/Writer/Reviewer, Evidence-only-Pakete,
   Kandidaten-SHA, visuelle Freigabe, Merge und Production?
5. Erzwingen lokale und geschuetzte CI-Gates dasselbe oder existiert eine Umgehung,
   Sackgasse beziehungsweise Endlosschleife?
6. Funktioniert der Uebergang vom Aktivierungskandidaten zu KR-L01 und danach atomar von
   Paket zu Paket?
7. Fuehren die UI-Quellen eindeutig zu V1.1, den vier Seitenkompositionen und V5 nur als
   Ablaufquelle?
8. Welche konkrete Tatsache koennte den Bau trotz gruener Governance noch stoppen?

Bewertung:

- `PASS`: keine P0/P1-Findings; die Linie kann nach den normalen Gates aktiviert werden.
- `FAIL`: mindestens ein P0/P1-Finding verhindert eine belastbare Aktivierung.
- Keine Stilwuensche. Findings nur bei konkret belegter Fehlfunktion, Umgehung, Sackgasse
  oder fehlendem Livebestandteil.
- Jede Abhilfe muss die einfachste systemische Korrektur nennen, nicht einen neuen
  Parallelprozess.
