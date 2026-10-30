# Abgabe Reparatur-Abschluss H10

Stand: 28.10.2026
Branch: `kreile/s1-p2-eingang`
PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>
Produktkopf K25: `d3bf7225d2c1963a8a1cd143208beafdb7b66a23`
Preview (Branch-Alias): <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app>

## K1–K25

| ID | Seite | Status | Commit |
|---|---|---|---|
| K01 | rechte | erledigt | `72e1f5b3` |
| K02 | rechte | erledigt | `1994c1e0` |
| K03 | tag | erledigt | `5da5868a` |
| K04 | tag | erledigt | `e4b3cc07` |
| K05 | tag | erledigt | `a962c123` |
| K06 | tag | erledigt | `fd970e56` |
| K07 | login | erledigt | `507a94c8` |
| K08 | rechte | erledigt | `54cd80f7` |
| K09 | rechte | erledigt | `1d5c5915` |
| K10 | rechte | erledigt | `df9a6720` |
| K11 | meincode | erledigt | `a6b3fa46` |
| K12 | tag | erledigt | `d60e8077` |
| K13 | tag | erledigt; Stufe-2-Anschluss seit K16 grau „geplant“ | `1a997d52` |
| K14 | tag | erledigt; Stufe-2-Anschluss seit K16 grau „geplant“ | `e5e52b30` |
| K15 | tag | erledigt | `b0213fe6` |
| K16 | tag | zurückgestellt nach U-212; Entwürfe, Bündeln und „Der Tag anpassen“ ausgeblendet bzw. grau „geplant“ | `96fbafb8` |
| K17 | spaeter | erledigt | `5b5a3c9b` |
| K18 | login | erledigt | `6ca7ab84` |
| K19 | login | erledigt | `a43412ec` |
| K20 | rechte | erledigt | `63e73e54` |
| K21 | tag | erledigt | `cd499e01` |
| K22 | tag | erledigt | `a61c0899` |
| K23 | tag | erledigt; Tastatursteuerung aktiv, Dialog-10-Ziel laut BAUPLAN bis F3/F4 zurückgestellt | `cbbff229` |
| K24 | tag | erledigt; Entwurfszustand nach U-212 Stufe 2 | `c049d02c` |
| K25 | hbmehr | erledigt; Weitergabe zeigt Status, Frist und „Rückgängig“ | `d3bf7225` |

## Prüfnachweis

- K25 fokussiert: `src/components/home/__tests__/RolfHome.realRender.test.tsx` — 20/20 grün.
- Vollständiger lokaler Vor-Commit-Lauf am Produktkopf: TypeScript, ESLint und 137 Testdateien mit 1119 Tests grün.
- BAUPLAN-Spec-Check: `hbmehr,tag` — 5 erwartet, 5 gefunden, 0 fehlend.
- GitHub `agentur-gate` am Produktkopf: **grün** — [Lauf 40720037788](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/40720037788/job/122928107856).
- Vercel am Produktkopf: **grün**, Deployment abgeschlossen — [Deployment-Nachweis](https://vercel.com/schoggertraube-revs-projects/galvanik-kreile-werkstatt/7sq7gy1SV7Dc8DsXp52sDrih2MpE).
- Kein Klicktest und keine Datenbankänderung durch Codex gemäß Regel 4d.

## Owner-Klickweg (höchstens 8 Schritte)

Rolle: bestehender Login **Rolf**. Bestehenden persönlichen Code verwenden; kein Testnutzer wurde angelegt.

1. Preview öffnen, auf `/start` Rolf wählen und mit dem bestehenden Code anmelden. Danach ist „Der Tag“ sichtbar; eine falsche Eingabe würde ihren Fehler direkt im aktiven Login-Schritt zeigen.
2. „Einstellungen“ → „Personen & Rechte“ öffnen. Die Spalten tragen die echten Login-Namen; die freigegebenen Bereiche sind je Person sichtbar.
3. Zurück zu „Der Tag“. „Anpassen · geplant“ und „Bündeln · geplant“ sind grau und nicht ausführbar; offene Stufe-1-Einträge bleiben sichtbar.
4. Bei einem Auftrags-Eintrag „Weitere“ → „an Phillip delegieren“ wählen. Der Eintrag bleibt gedimmt mit „bei Phillip · Frist …“ beziehungsweise „bis erledigt“ stehen und zählt nicht mehr in der Lage.
5. Am selben Eintrag „Rückgängig“ wählen. „Zurückgeholt“ erscheint, der Eintrag ist wieder aktiv und wird wieder gezählt.
6. „+ Anlegen“ → „Auftrag / KV anlegen“ wählen und einen Auftrag für einen vollständig gepflegten bestehenden Kunden mit mindestens einer Position speichern. Erwartung in der Datenbank: genau ein neuer Auftrag mit der eingegebenen Position und einer neuen Auftragsnummer.
7. Den soeben angelegten Auftrag direkt öffnen. Die Auftragskarte zeigt dieselbe Auftragsnummer und die gespeicherte Position; es erscheint kein „nicht verfügbar“-Zustand.
