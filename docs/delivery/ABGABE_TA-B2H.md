# TA-B2h – P52-Ergänzung „Was ist neu“

Basis: `origin/main` / `b6d94bccad812883cddaefa1d050c1506c722d8b` (Owner-Merge #172). Auftrag: NACHTLAUF P52, sofort wirksam über AKTUELLE_ANWEISUNG C. #172 wurde während der Produktarbeit geschlossen; die bereits beauftragte Ergänzung erhält daher einen Folge-PR auf demselben Anker-Branch `codex/ta-b2h`.

Die B2-Allowlist erhält genau sechs zusätzliche Pfade:

- `src/lib/server/authBootstrap.ts`
- `src/lib/server/__tests__/authBootstrap.test.ts`
- `src/components/layout/WasIstNeu.tsx`
- `src/components/layout/__tests__/WasIstNeu.test.tsx`
- `src/content/was-ist-neu.json`
- `src/app/buchhaltung/__tests__/w2c.activeRouteContainment.test.tsx`

Der Bootstrap liefert ausschließlich den bereits öffentlichen, opaken Login-Handle für den von P52 verlangten lokalen Lesemarker. Authentisierung, Rechte, Sitzung und DB werden dadurch nicht umgestellt. Diesen Produktcode enthält erst #166, nicht dieser Anker. Bereits freigegebene Layoutpfade reichen für die übrige Einbindung. Der sechste Pfad ist ein mechanischer Anschluss des vorhandenen Import-Testgerüsts: echte JSON-Auflösung mit strikter Gültigkeitsprüfung, keine Ignorierliste. Alle bestehenden Sperrziele und Assertions bleiben erhalten; #166 ergänzt Negativfälle für fehlende/ungültige JSON-Daten (21/21 gezielte Tests PASS).

Ankerumfang unverändert genau vier Dateien: Scope-Checker, dessen bestehender Test, `docs/evidence/live-line/b2/TRUST_ANCHOR_B2H.json`, diese Abgabe. Die enge Ankerprüfung wird auf obige Main-Basis und den Produktkandidaten fortgeschrieben. Keine neuen Globs, kein Workflow, keine Baseline, kein anderer Checker und keine Planungs-/UI-Quelldatei. P44/P47-Pfade bleiben unverändert erlaubt.

**Probe:** vollständiger Produktkandidat #166 `f4d88b8e5024f8311e7533fe3619be010209f1b5`, 29 Pfade gegen Main: vorher genau sechs `SALES_STAGE_B2_SCOPE`-Fehler für die obige Liste; mit diesem Checker **PASS**, `after: []`. Beleg `.git/kreile-p52-anchor-probe.json`. Der bestehende Scope-Test prüft jeden neuen Pfad sowie verbotene Nachbarpfade einzeln. Bauplan unverändert `DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4`.

Lokal: Scope-Tests 23/23 PASS; 22/22 A11-Befehle einschließlich Selbsttests, Modul-/H18-/H16-Verträgen, No-Fake, Supabase-Grenze, Typprüfung, Lint und leerem `git diff --check origin/main` PASS. Beleg `.git/kreile-p52-anchor-a11.log`. Nach Branchwechsel wurden ausschließlich ignorierte Routentypen mit `npx next typegen` erneuert. Die exakte Ankerprüfung läuft zusätzlich nach dem Commit.

Der exakte PR-Check-Stand wird in NACHTLAUF C belegt. Volltests laufen gemäß Owner-Freigabe parallel in CI. Ein roter Check wird nur mit Run, Schritt und tatsächlicher Fehlerzeile eingeordnet; kein pauschaler Grün-Claim. Ein selbstreferenzieller Ratchet muss vom Planungschat geprüft werden. Keine eigenmächtige Hash-Anpassung und kein Merge durch Codex.

DB-Soll und Klickweg: dieser Anker verändert keine DB-Zeile und keine Oberfläche. Nach Owner-Merge wird der konkrete Produktstand #166 mit seinem READY-Link geprüft; dessen Hand-off verweist auf `src/content/was-ist-neu.json` als einzige Inhaltsquelle.
