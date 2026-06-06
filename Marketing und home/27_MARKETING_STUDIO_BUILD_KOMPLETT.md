# 27 — Marketing-Studio: vollständige Bauanweisung (Framer Motion, Feedback-Mail, Statistik, Home-Ergänzung)

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** ausführungsfertig, keine offenen Fragen
**Zielplattform:** Antigravity / Claude Code
**Stack:** React PWA + TypeScript, Framer Motion, Data-Provider-Pattern (Mock/Api), Supabase (Postgres/Storage/Auth/RLS), Drizzle ORM
**Bindet ein und gilt zusätzlich zu:** `00_PRIORITY_RULES_KREILE.md`, `SPEC_LICENSE_FEATURE_TOGGLES_v1.md`, Dateien **19–26** (Marketing-Paket)
**Referenz-Mockups (maßgeblich, optisch nachbauen):** `kreile_marketing_studio.html`, `kreile_home_v3.html`

---

## 0. Verbindliche Arbeitsregeln für Antigravity

Diese Datei ist die **Single Source of Truth** für diesen Bauabschnitt. Antigravity stellt **keine Rückfragen mehr** und weicht **nicht vom Plan ab**. Einzige erlaubte Ausnahme: **bestehende, unveränderliche Strukturen** — insbesondere der App-Rahmen (linke Navigationsleiste, obere Abschlussleiste). Dieser Rahmen wird **nicht angefasst**, nur die Inhaltsfläche.

Es gelten weiterhin die **STOPP-Bedingungen** aus Datei 19 (keine Datenlöschung statt Storno; kein echter Versand ohne Einwilligung + Freigabe + aktiven Toggle; sauberer Git-Status vor Migration). Diese STOPP-Bedingungen sind **kein** „Plan-Abweichen", sondern Teil des Plans.

**Reihenfolge halten** (Abschnitt 9). Pro Schritt ein Commit `F-MK2-XX`. Migrationen am Tagesende auf Supabase pushen und **auf Supabase verifizieren** (nicht nur lokal).

---

## 1. Geltungsbereich dieses Bauabschnitts

| Nr. | Was gebaut wird |
|---|---|
| A | Marketing-Studio-UI mit **Framer Motion** (statt CSS-Deko), gem. Datei 26 + Mockup |
| B | **Automatische Bildquellen**: Auftragsfotos + von Kunden eingesandte Bilder fließen automatisch in den Marketing-Asset-Pool |
| C | **Feedback-Mail nach Paketankunft**: Auslöser manuell **oder** Versand-Tracking; Versandzeit aus Lern-Loop (beste Öffnungszeit); Mail fragt Fotos + Google-Bewertung + 1-Klick-Zufriedenheit ab |
| D | **Statistik-Erweiterung**: Zufriedenheit, Google-Bewertungen, Website-Aufrufe, Google-Treffer/Sichtbarkeit — im Marketing + gespiegelt in Performance |
| E | **Home-Ergänzung**: optisches Upgrade Schnellstart + neue Marketing-Signale auf der Startseite |

---

## 2. Geklärte Entscheidungen (keine Annahmen mehr nötig)

| Punkt | Entscheidung |
|---|---|
| Animationstechnik | **Framer Motion** |
| Bildquellen | Auftragsfotos **und** von Kunden eingesandte Bilder, **automatisch** im Asset-Pool |
| Ankunft-Auslöser Feedback-Mail | **Beides**: manueller Statuswechsel **+** Versand-Tracking, wenn verfügbar |
| Versandzeitpunkt der Mail | **Zeitfenster aus dem Lern-Loop** (beste Öffnungszeit je Segment), Fallback Default-Fenster |
| Mail-Inhalt | **Drei Bitten in einer Mail**: Fotos hochladen + Google-Bewertung + 1-Klick-Zufriedenheit |

---

## 3. Frontend — Marketing-Studio mit Framer Motion

### 3.1 Bibliothek & Grundsatz
- `framer-motion` als Animations-Bibliothek. Keine konkurrierende Animations-Lib für Deko.
- Animiert werden **nur** `transform`/`opacity` (Performance). `prefers-reduced-motion` respektieren: bei Reduktion Varianten auf `transition:{duration:0}` setzen.

### 3.2 Komponentenbaum (Sub-Navigation = Untermenüs, Datei 26 §3)
```
<MarketingStudio>                     // Inhaltsfläche, NICHT der App-Rahmen
  <StudioHeader/>                     // animiertes Verlaufs-Logo + Titel
  <SubNav/>                           // Pill-Tabs + animierter Gleiter (layoutId)
  <AnimatePresence mode="wait">       // View-Wechsel
    <StudioView/> | <IdeenView/> | <KampagnenView/> | <ReichweiteView/> | <KundenView/> | <WirkungView/>
</MarketingStudio>
```

### 3.3 Framer-Motion-Vorgaben (verbindlich)
| Element | Umsetzung |
|---|---|
| Tab-Gleiter | `motion.span layoutId="glider"` hinter aktivem Tab (Verlaufsfüllung) |
| View-Wechsel | `<AnimatePresence mode="wait">`, Varianten `floatIn` (opacity 0→1, y 14→0), `staggerChildren: .05` |
| Composer-Hero | Container `whileHover`, Post-Vorschau Schimmer als `motion.div` mit `repeat:Infinity` |
| Story-Ringe | `whileHover={{scale:1.07}}`, Klick befüllt Composer-State |
| Wirkung-Zahlen | hochzählen via `useMotionValue`+`animate()` (de-DE-Format) |
| Reichweite-Funnel | Balken `initial={{width:0}} animate={{width:zielBreite}}` beim Mount der View |
| CTA „Jetzt posten" | `whileTap={{scale:.96}}`, danach Toast |
| Verlaufsbewegung | CSS `gradShift` beibehalten (nicht JS), Tokens aus Datei 26 §2 |

### 3.4 Inhalt je View
Exakt wie `kreile_marketing_studio.html` und Datei 26 §4. **Weniger pro Screen, Tiefe in Untermenüs.** Studio-Reihenfolge: Composer-Hero → 3-Schritte-Leiste → Story-Ideen → Wirkung-Mini → Untermenü-Einstiege.

### 3.5 Rahmen-Schutz
Linke Navigationsleiste und obere Leiste werden **importiert/wiederverwendet**, nicht neu gebaut oder verändert. Marketing ist aktiver Menüpunkt (bereits vorhanden).

---

## 4. Bildquellen — automatischer Asset-Pool (B)

### 4.1 Quellen
1. **Auftragsfotos**: bereits im Auftrags-/Wareneingang-Modul erfasste Fotos (Vorher/Nachher, Endkontrolle).
2. **Kundenbilder**: über die Feedback-Mail (Abschnitt 5) hochgeladene Bilder.

### 4.2 Datenmodell-Erweiterung (Drizzle)
```ts
export const marketingAsset = pgTable('marketing_asset', {
  id: uuid('id').defaultRandom().primaryKey(),
  quelle: text('quelle').notNull(),          // auftragsfoto | kundenbild
  auftragId: uuid('auftrag_id'),             // Referenz Auftragsmodul (read-only join)
  kundeId: uuid('kunde_id'),
  segmentId: uuid('segment_id'),
  storagePfad: text('storage_pfad').notNull(),
  typ: text('typ'),                          // vorher | nachher | detail | kundenfoto
  freigabeMarketing: boolean('freigabe_marketing').default(false), // Einwilligung zur Nutzung
  qualitaetScore: numeric('qualitaet_score', { precision: 5, scale: 2 }), // KI-Bildbewertung optional
  erstelltAm: timestamp('erstellt_am').defaultNow().notNull(),
});
```

### 4.3 Automatik-Regeln
- Neue Auftragsfotos werden **automatisch** als `marketing_asset (quelle=auftragsfoto)` indexiert (Trigger/Job beim Foto-Upload im Auftragsmodul).
- Kundenbilder aus der Feedback-Mail landen als `quelle=kundenbild` mit `freigabe_marketing` gemäß Einwilligung im Upload-Formular.
- Der Composer (Abschnitt 3) zieht Vorschlagsbilder **nur** aus Assets mit `freigabe_marketing = true` (bei Kundenbildern Pflicht; Auftragsfotos gemäß betrieblicher Einwilligung/Default-Policy in Einstellungen).
- **STOPP**, falls ein Kundenbild ohne `freigabe_marketing` öffentlich gepostet werden soll.

### 4.4 Storage
Supabase Storage, EU-Region, geschützter Bucket, signierte URLs. Kein öffentlicher Direktlink ohne Freigabe.

---

## 5. Feedback-Mail nach Paketankunft (C) — Kernautomatik

### 5.1 Auslöser (beides)
- **Manuell**: Auftragsstatus wechselt auf `ausgeliefert` / `abgeholt` (durch Mitarbeiter).
- **Tracking**: Versanddienst meldet Zustellung (DHL/DPD o. ä.), falls Tracking-Nummer vorhanden → Status `zugestellt`.
- Es zählt das **früheste** belastbare Ankunftssignal. Tracking überschreibt „verschickt", manueller Status hat Vorrang vor unklarem Tracking.

### 5.2 Zeitpunkt (Lern-Loop)
- Nach erkannter Ankunft wird die Mail **nicht sofort** versandt, sondern für das **beste Öffnungs-Zeitfenster** des Kundensegments eingeplant (`lern_metrik`, Dimensionen `wochentag`/`stunde`/`segment`, Datei 21).
- **Fallback** ohne ausreichende Lern-Konfidenz: Default-Fenster (B2B Di–Do 09:00–11:00; B2C werktags 18:00–20:00) — konfigurierbar in Einstellungen.
- Versand frühestens nach Ankunft + minimaler Pietätsabstand (Default 1 Tag, konfigurierbar), damit der Kunde das Stück real in der Hand hatte.

### 5.3 Datenmodell
```ts
export const feedbackMail = pgTable('feedback_mail', {
  id: uuid('id').defaultRandom().primaryKey(),
  auftragId: uuid('auftrag_id').notNull(),
  kundeId: uuid('kunde_id').notNull(),
  segmentId: uuid('segment_id'),
  ankunftQuelle: text('ankunft_quelle'),     // manuell | tracking
  ankunftAm: timestamp('ankunft_am'),
  geplantFuer: timestamp('geplant_fuer'),    // aus Lern-Loop
  status: text('status').notNull().default('geplant'), // geplant|gesendet|geoeffnet|reagiert|storniert
  gesendetAm: timestamp('gesendet_am'),
  tokenUpload: text('token_upload'),         // signierter Link Foto-Upload
  tokenFeedback: text('token_feedback'),     // signierter Link 1-Klick-Zufriedenheit
  einwilligungOk: boolean('einwilligung_ok').default(false),
});

export const feedbackEingang = pgTable('feedback_eingang', {
  id: uuid('id').defaultRandom().primaryKey(),
  feedbackMailId: uuid('feedback_mail_id').references(() => feedbackMail.id),
  zufriedenheit: integer('zufriedenheit'),   // 1..5 (1-Klick)
  googleBewertungGeklickt: boolean('google_bewertung_geklickt').default(false),
  fotosHochgeladen: integer('fotos_hochgeladen').default(0),
  freitext: text('freitext'),
  eingegangenAm: timestamp('eingegangen_am').defaultNow(),
});
```

### 5.4 Mail-Inhalt (eine Mail, drei Bitten)
1. **Fotos hochladen** — signierter Upload-Link → Bilder landen als `marketing_asset (quelle=kundenbild)`; Checkbox „Diese Fotos dürft ihr für eure Außendarstellung verwenden" steuert `freigabe_marketing`.
2. **Google-Bewertung** — Button mit direktem Google-Bewertungslink (Place-ID aus Einstellungen); Klick wird als `googleBewertungGeklickt` getrackt (kein Inhalt der Bewertung gespeichert).
3. **1-Klick-Zufriedenheit** — 1–5 (z. B. Sterne/Smileys) als signierte Links, je Stufe ein Token → `feedbackEingang.zufriedenheit`.
- Ton: persönlich, kurz, dankbar. Betreff/Text als editierbare Vorlage in Einstellungen (Platzhalter: Kundenname, Auftrag, Stück).
- **Pflicht**: Abmeldelink, Absenderkennung, Einwilligungs-/Bestandskundenprüfung (Datei 24). Kein Versand ohne `einwilligungOk`.

### 5.5 Workflow
```
Ankunft erkannt (manuell|tracking) → feedback_mail (status=geplant, geplant_fuer aus Lern-Loop)
→ Scheduler (Supabase Cron/Edge Function) sendet im Zeitfenster (wenn einwilligungOk)
→ Kunde: Foto-Upload | Google-Klick | Zufriedenheit
→ feedback_eingang → speist Statistik (Abschnitt 6) + Asset-Pool (Abschnitt 4) + Lern-Loop
```

### 5.6 Technik
- Versand über E-Mail-Provider-Adapter (Brevo/Resend/Postmark — Wahl offen, EU + DSGVO; Adapter aus Datei 22 nutzen).
- Scheduler: Supabase Scheduled Function / Cron; idempotent (kein Doppelversand pro Auftrag).
- Upload-/Feedback-Links: signierte, ablaufende Tokens; keine PII in der URL.

---

## 6. Statistik-Erweiterung (D)

### 6.1 Neue Kennzahlen
| Kennzahl | Quelle | Anzeige |
|---|---|---|
| Kundenzufriedenheit (Ø + Verlauf) | `feedback_eingang.zufriedenheit` | Marketing → Wirkung; Performance-Kachel |
| Google-Bewertungen (Anzahl + Ø Sterne) | Google Business Profile API (Stufe 2) / manuell gepflegt (Stufe 1) | Marketing → Wirkung; Performance |
| Website-Aufrufe | Web-Analytics-Anbindung (Plausible/PostHog o. ä., UTM) | Marketing → Reichweite; Performance |
| Google-Treffer / Sichtbarkeit | Google Business Profile Insights (Stufe 2) / manuell (Stufe 1) | Marketing → Wirkung |
| Foto-Rücklauf je Kampagne | `feedback_eingang.fotosHochgeladen` | Marketing → Wirkung |
| Bewertungs-Klickrate | `feedback_eingang.googleBewertungGeklickt` / gesendet | Marketing → Wirkung |

### 6.2 Datenmodell
```ts
export const statistikKennzahl = pgTable('statistik_kennzahl', {
  id: uuid('id').defaultRandom().primaryKey(),
  metrik: text('metrik').notNull(),     // zufriedenheit|google_rating|google_count|web_visits|google_impressions
  periode: date('periode').notNull(),   // Tages-/Monatsbucket
  wert: numeric('wert', { precision: 14, scale: 2 }),
  quelle: text('quelle'),               // feedback|google_api|web_analytics|manuell
  aktualisiertAm: timestamp('aktualisiert_am').defaultNow(),
});
```

### 6.3 Stufen-Realität
- **Stufe 1 (sofort):** Zufriedenheit + Foto-Rücklauf + Bewertungs-Klickrate (aus eigenen Daten); Website-Aufrufe via UTM/Web-Analytics; Google-Rating/-Treffer **manuell pflegbar**.
- **Stufe 2:** Google Business Profile API (Rating, Anzahl, Impressions) automatisch — nach Freigabe/Quota; Adapter aus Datei 22.

### 6.4 Spiegelung in Performance (Pflicht, Vollintegration)
Neue Performance-Kacheln (ergänzt zu Datei 20 §10): **„Kundenzufriedenheit"**, **„Online-Sichtbarkeit"** (Google + Website). Gleiche Daten, kein zweiter Datentopf.

---

## 7. Home-Ergänzung (E) — integriert

### 7.1 Optisches Upgrade Schnellstart (gem. `kreile_home_v3.html`)
- Schnellstart-Kacheln mit **eigenem Farbverlauf je Icon-Tile**, Verlaufs-Rahmenlinie bei Hover (Framer Motion `whileHover`), leichtes Icon-Kippen, Badges (Kritische Aufträge, Marketing).
- „Im Umlauf"-Zahlen zählen beim Laden hoch (Framer Motion `useMotionValue`).
- Inhalte gestaffelt einblenden (`staggerChildren`).
- Serifen-Überschriften für Wertigkeit. **Rahmen unverändert.**

### 7.2 Neue Marketing-Signale auf der Startseite
- Schnellstart-Kachel **Marketing** zeigt Badge „1 Aktion empfohlen" (zieht `getBesteAktion()` aus `MarketingDataProvider`, Datei 21).
- Optionales Checklisten-Item, wenn Feedback-Mails reagiert wurden („3 neue Kundenfotos eingegangen — für Posts nutzen").
- Alles über Feature-Toggle `marketing_enabled`: bei Aus verschwinden Badge + Item rückstandslos.

---

## 8. Datenschutz (verbindlich, Datei 24 gilt zusätzlich)

- Feedback-Mail nur mit Einwilligung/Bestandskundenausnahme; Abmeldelink Pflicht; kein Versand ohne `einwilligungOk`.
- Kundenbilder nur mit `freigabe_marketing` öffentlich nutzbar; ohne Freigabe nur intern.
- Google-Bewertung: nur Klick tracken, **keine** Bewertungsinhalte/Identität ableiten.
- Web-Analytics datensparsam, Consent-konform; keine PII in URLs/Tokens.
- AVV mit Mail-Provider, Google, Web-Analytics, Supabase; EU-Region; Verarbeitungsverzeichnis ergänzen.
- RLS: `EMPLOYEE` sieht keine Kundenkontakte/Beträge; Assets nur rollenkonform.

---

## 9. Build-Reihenfolge (verbindlich, je Schritt 1 Commit `F-MK2-XX`)

1. **Snapshot & Bestandsabgleich** — `git status` sauber, Commit `F-MK2-00`; bestehende Marketing-/Home-Komponenten auflisten, gegen diese Datei abgleichen (erhalten/ergänzen/überführen). Rahmen als Tabu markieren.
2. **Migrationen** — `marketing_asset`, `feedback_mail`, `feedback_eingang`, `statistik_kennzahl` (+ Felder aus Datei 21, falls noch nicht vorhanden). Vorschau zeigen → anwenden → **auf Supabase verifizieren**.
3. **Provider erweitern** — `MarketingDataProvider` um Assets, Feedback, Statistik; `MockProvider` zuerst mit Demo-Daten.
4. **Studio-UI mit Framer Motion** — Sub-Nav + 6 Views gem. Mockup/Datei 26; Rahmen wiederverwenden.
5. **Asset-Pool-Automatik** — Auftragsfoto-Indexierung + Composer zieht freigegebene Assets.
6. **Feedback-Mail-Pipeline** — Auslöser (manuell+Tracking), Lern-Loop-Scheduling, Mailvorlage, Upload-/Feedback-Links, Eingang verarbeiten.
7. **Statistik** — Kennzahlen erfassen/aggregieren; Marketing-Wirkung + Performance-Kacheln.
8. **Vollintegration** — Kosten→Buchhaltung, Umsatz→Performance (Datei 22), Zufriedenheit/Sichtbarkeit→Performance.
9. **Home-Ergänzung** — Schnellstart-Upgrade + Marketing-Signale.
10. **ApiProvider scharf** (Mock→Api), Feature-Toggle `marketing_enabled` testen.
11. **Stufe-2-Adapter** (Instagram/Google-API) als Mock + Flag; App-Review parallel anstoßen.

---

## 10. Test-Plan

**Unit:** Lern-Loop-Zeitfenster-Berechnung; Ankunfts-Auslöser-Priorität (manuell vs. tracking); Einwilligungs-Gate; Token-Signatur/Ablauf; Zähler-Format de-DE.
**Integration:** Auftragsfoto → Asset-Pool; Statuswechsel/Tracking → `feedback_mail (geplant)`; Scheduler sendet nur im Fenster + mit Einwilligung; Foto-Upload → Asset mit Freigabe-Flag; Zufriedenheit/Bewertungsklick → Statistik; Kosten→Buchhaltung, Umsatz/Zufriedenheit→Performance.
**E2E:** Studio-Tabs wechseln (AnimatePresence kein Layout-Sprung); Story-Klick befüllt Composer; Funnel wächst; Home-Zähler zählen hoch; Feature-Toggle aus → Marketing + Home-Signale verschwinden rückstandslos.
**Datenschutz:** kein Versand ohne Einwilligung; Kundenbild ohne Freigabe nicht öffentlich; keine PII in URL; Abmeldelink wirkt.
**Reduced-Motion:** `prefers-reduced-motion` → Animationen aus, Funktion intakt.

## 11. Akzeptanzkriterien

- [ ] Rahmen (linke + obere Leiste) unverändert; nur Inhaltsfläche neu.
- [ ] Studio mit Framer Motion: Sub-Nav-Gleiter (`layoutId`), View-Wechsel, Composer, Story-Klick, hochzählende Zahlen, wachsender Funnel.
- [ ] Auftragsfotos automatisch im Asset-Pool; Composer nutzt nur freigegebene Assets.
- [ ] Feedback-Mail wird bei Ankunft (manuell **oder** Tracking) eingeplant und im Lern-Loop-Fenster gesendet (Fallback-Fenster vorhanden).
- [ ] Mail fragt Fotos + Google-Bewertung + 1-Klick-Zufriedenheit ab; Eingänge landen in Statistik + Asset-Pool.
- [ ] Statistik zeigt Zufriedenheit, Google-Bewertungen, Website-Aufrufe, Google-Treffer; in Performance gespiegelt.
- [ ] Home: Schnellstart-Upgrade + Marketing-Signal; per Toggle abschaltbar.
- [ ] Kein Versand ohne Einwilligung; Kundenbild ohne Freigabe nicht öffentlich.
- [ ] `prefers-reduced-motion` respektiert.
- [ ] Migrationen auf Supabase verifiziert (nicht nur lokal).
- [ ] Optischer Abgleich gegen `kreile_marketing_studio.html` und `kreile_home_v3.html` bestanden.

## 12. Pflicht-Workflow nach Supabase-Migration

```
npx supabase login
npx supabase link --project-ref <REF>
npx supabase db push
# bei CLI-Fehler: SQL im Dashboard, Buckets manuell, danach: NOTIFY pgrst, 'reload schema';
# IMMER auf Supabase verifizieren, nicht nur lokale SQL-Datei prüfen.
```

## 13. Sofort parallel (Vorlauf Stufe 2, blockiert Stufe 1 nicht)

- E-Mail-Provider wählen + AVV (kritischer Pfad für die Feedback-Mail).
- Meta-Business + Developer-App + App-Review (Instagram-Posten).
- Google-Unternehmensprofil-Zugang (Bewertungen/Insights automatisch).
- Web-Analytics (Plausible/PostHog) einbinden (Website-Aufrufe).

## 14. Annahmen (dokumentiert, nicht blockierend)

- Pietätsabstand nach Ankunft Default 1 Tag, in Einstellungen änderbar.
- Default-Versandfenster B2B Di–Do 09–11 Uhr, B2C werktags 18–20 Uhr, bis Lern-Konfidenz erreicht ist.
- Google-Place-ID, Mailvorlagen-Text, Web-Analytics-Property werden im Onboarding/Einstellungen gepflegt (Kundendaten = erlaubter Platzhalter).
- Stufe 1 nutzt manuelle Pflege für Google-Rating/-Treffer; Stufe 2 automatisiert via API.
