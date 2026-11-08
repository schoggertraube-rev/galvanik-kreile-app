# Review P2 – Zwischenstand (erster sichtbarer Stand)

Prüfer: Claude · 26.10.2026 16:35 Berlin · Branch `kreile/s1-p2-eingang` · Produkt-SHA `8e194f4c`, Kopf `88dfc7a3` · PR #154 (Draft, gestapelt auf P1) · CI grün, Vercel Ready

## Geprüft

- S04: `public.tenant_features` mit RLS (Tenant-Isolation), nur `service_role` hat Rechte; Pflege nur Rollen meister/admin/developer (`src/app/actions/settings.actions.ts:11-16`); Lesen fail-closed (`tenantFeaturePort.ts`). Standard Stufe 1 an, Rest aus.
- A08: Anbieter-Register; Rechnungen rollenabhängig.
- Verbote: keine Dateien aus scripts/quality, .github, AGENTS.md, missions, quality; nur neue Migration `20261026190000`, nur INSERT. `settings.module.css` +23 Zeilen, 0 Hex.
- DB: remote = Repo (32).

## Urteil: keine Blocker im gebauten Teil – kein PASS

Paket unvollständig (A07, E03, E04, E05, R02 offen, laut Abgabe selbst). Merge-Anfrage erst mit vollständiger P2-Abgabe. Zuerst die 2 Blocker aus `REVIEW_P1B.md` beheben (FAIL zuerst).

## Kein Blocker (→ DEZEMBER_LISTE)

- Neuer Mandant ohne `tenant_features`-Zeilen → Schalter „nicht verfügbar“ (nur Mehrmandanten relevant).
- `SearchDialog.module.css` 38 und `StartScreenClient.module.css` 36 feste Hex-Farben (Altbestand, in P2 nicht geändert).


## Zwischenblick 26.10. 17:30 Berlin (Kopf e828459f, Abgabe-Text noch auf 2256d9b1)

- Nach der Abgabe gebaut, noch nicht abgegeben: A07 Katalog/KV-PDF (2c69c6a2), E03 private Dokumente an Kunde/Auftrag (39dbad20), E05/R02 Mail-Port Graph (cdf28fa4), E04 Document-Intelligence-Vorschläge (f289c98d), A08 Anbieter Dokumente/Mail/Termine (e828459f).
- Keine neue Migration, keine verbotenen Dateien, DB synchron (32).
- Volle Prüfung erst mit aktualisierter ABGABE_P2 am neuen SHA. Vorab beobachtet, kein Blocker: Overlay-Farbe und PDF-Farben fest kodiert (→ DEZEMBER_LISTE).


## Volle Prüfung 26.10. 18:30 Berlin – Produkt-SHA `5cb2d56e`, Kopf `9438abd1`, PR #154

Vercel `5cb2d56e`: READY (galvanik-kreile-werkstatt-qmqi196nn.vercel.app). PR-Checks laut Abgabe grün.

Geprüft:
- Verbote: Diff `s1-p1-daten..5cb2d56e` berührt weder scripts/quality, .github/workflows, AGENTS.md, missions, quality noch alte Migrationen; einzige Migration `20261026190000` (neu). Keine Secrets im Repo (Graph/Azure nur serverseitig per Env).
- Rechte/Tenant: Upload/Finalize nur `perm_op_photos`, Download nur `perm_view_leitstand`, alle Zugriffe `tenant_id`-gebunden (`domainAttachment.ts:80-189`). Mail lesen `perm_view_customers`, zuordnen/senden `perm_data_customers|orders`, Empfänger aus gespeicherter Kunden-E-Mail (`communicationPort.ts:43-61`), Doppelversand per Advisory-Lock + clientRequestId gesperrt. KV-Anhang nur, wenn KV zum Kunden/Auftrag gehört (`communications.actions.ts`). Suche tenantgebunden (`searchAuxiliaryRead.ts`).
- Pflichtdaten: Zuschlag nutzt unveränderten P1b-Weg `convertQuoteToOrderAction` → `createOrderIntake` (P1b-Blocker behoben, PASS).
- DB: remote 32 = Repo 32 (`20261026190000` letzte). Synchron.
- Farben: neue CSS ohne Hex; PDF-Farben/Overlay bereits in DEZEMBER_LISTE.

## Urteil: PASS

Keine Blocker. E04/E05/R02 fail-closed „In Klärung“, bis der Owner die 6 Preview-Werte einträgt (laut AKTUELLE_ANWEISUNG Z. 30 zulässig); Live-Nachweis danach in DEZEMBER_LISTE.


---

## Prüfung Owner-Korrektur Abschnitt F (26.10. 22:30 Berlin / 21:30 UTC)

Branch `kreile/s1-p2-eingang`, Kopf 5c9d31da, Produkt-SHA f8fed7ce, PR #154 (Draft). Korrekturrunde 1 zu F (5 Produktcommits 20:37–21:05 Berlin + 1 Doku).

**Urteil: PASS** (alle drei F-Punkte am Preview-Screenshot sichtbar behoben; keine Blocker).

| F-Punkt | Befund | Beleg |
|---|---|---|
| 1 Farben V1.1 | behoben. `src/styles/tokens.css:4` setzt ground #F4F2EE, surface #FFFFFF, line #E4E0D8, rand #D5D0C7, flaeche #F7F6F3 = Werte aus `docs/project/linie/ui/designsystem_v1_1/tokens.css`. Alte Beige-Werte aus beiden Mock-CSS (Zeile 14) entfernt. Berechnet body/Hauptfläche rgb(244,242,238). Screenshot `p2-f8fed7ce-der-tag` vs `v11_rolf_desktop`: neutrale Grundfläche, weiße Karten – stimmt. | 91a2f829 |
| 2 Ein Einstieg | behoben. `GlobalCreateFlow.tsx:1053` „+ Anlegen“ ruft `loadDirectIntake()`; kein „Was möchtest du anlegen?“ mehr als Startschritt, Zurück-zur-Auswahl entfernt. Neukunde startet leer (`:476-478`). Pflichtfelder Firma/Name, Ansprechpartner, Telefon, E-Mail, Anschrift, Zahlung sichtbar im Schritt 1. | 91a2f829, 19734ec4 |
| 3 Tempo | gemessen: Login→Der Tag 922 ms, +Anlegen→Dialog 45 ms, Neukunde→Position 1 884 ms (alle < 1 s). | ABGABE_P2.md |
| DB | neue Migration 20261026194956 (Constraint-Erweiterung `completeForOrder`, NOT VALID, kein Datenverlust). Remote 33 = Repo 33. | c9232c07 |

Kein Blocker. Sichtbare Restabweichungen gegen V1.1 (nicht Teil von F, kein FAIL) → DEZEMBER_LISTE: Seitenleisten-Einträge als helle Kacheln statt Text auf Navy; Suchfeld/Logo-Feld leicht beige getönt; „+ Anlegen“ als orange Schwebeknopf unten rechts statt Plus im Kopf; Dialog zeigt „Firma / Name“ und „Firmenname“ doppelt.
