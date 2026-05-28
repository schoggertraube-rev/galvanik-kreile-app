# Spezifikation — Feature-Toggle- & Lizenz-System

**Projekt:** Kreile Werkstatt-OS
**Modul:** Lizenz- und Feature-Steuerung
**Version:** 1.0
**Datum:** 2026-05-27
**Status:** baubar
**Zielplattform:** Antigravity / Claude Code
**Sprache:** Deutsch

---

## 1. Zweck und Geltungsbereich

Steuerung sämtlicher auswertungs- und vorausschau-relevanter Funktionen über Lizenzpläne. Ein Feature kann gleichzeitig durch Lizenz und Datenreife gesperrt sein — beide Gründe müssen sauber kommuniziert werden. Plan-Wechsel sperren Sicht und Auswertung, niemals Daten.

**Wesentliche Entscheidungen (geklärt):**

| Punkt | Entscheidung |
|---|---|
| Schaltung von Plänen und Modulen | ausschließlich Anbieter über zentrale Admin-Konsole |
| Onboarding-Modell | Demo-Modus mit Galvanik-Beispielwerkstatt, kein automatischer Trial |
| Demo-Branche | Galvanik-spezifisch, Kreile-ähnlich |
| Kontingent-Überschreitung | Warnung, kein Block — Werkstatt arbeitet weiter |
| Plan-Sichtbarkeit | nur Inhaber-Rolle, nicht für Mitarbeiter |
| Pricing | später, nicht Teil dieser Spec |

---

## 2. Konzept-Kern

Jede auswertungsrelevante Funktion wird über einen **Feature Flag** geschaltet. Der Flag-Wert ergibt sich aus zwei Quellen:

1. **Lizenzplan** der Werkstatt (Basis / Pro / Premium / Enterprise) inklusive eventueller Feature-Overrides
2. **Datenreife** der jeweiligen Kennzahl (gemäß separater Spec Datenreife-Konzept)

Beide Ebenen werden durch eine zentrale Resolver-Funktion zu einem konkreten UI-Zustand verbunden. UI-Komponenten kennen weder Plan noch Datenreife direkt — sie fragen ausschließlich den Resolver.

---

## 3. Plan-Matrix

| Funktion | Basis | Pro | Premium | Enterprise |
|---|:-:|:-:|:-:|:-:|
| **Operatives Tagesgeschäft** | | | | |
| Auftragsverwaltung, Kundenkartei | ✓ | ✓ | ✓ | ✓ |
| Wareneingang mit OCR | ✓ | ✓ | ✓ | ✓ |
| Statusboard, Werkstattfluss | ✓ | ✓ | ✓ | ✓ |
| Lager + Bäder (Basisfunktionen) | ✓ | ✓ | ✓ | ✓ |
| KV / Rechnung als PDF | ✓ | ✓ | ✓ | ✓ |
| Reklamationen erfassen | ✓ | ✓ | ✓ | ✓ |
| Heute-Cockpit | ✓ | ✓ | ✓ | ✓ |
| **Steuerung & Reporting** | | | | |
| Performance-Score, KPI-Karten | — | ✓ | ✓ | ✓ |
| Engpass-Analyse, Heatmap | — | ✓ | ✓ | ✓ |
| Wochenziel, Streaks | — | ✓ | ✓ | ✓ |
| Finanzcontrolling, Deckungsbeitrag | — | ✓ | ✓ | ✓ |
| Vorperiode-Vergleich (W/M) | — | ✓ | ✓ | ✓ |
| Monatsbericht-PDF (manuell) | — | ✓ | ✓ | ✓ |
| DATEV/Lexware-CSV-Export | — | ✓ | ✓ | ✓ |
| Steuerberater-Paket (ZIP) | — | ✓ | ✓ | ✓ |
| Materialverbrauchs-Report | — | ✓ | ✓ | ✓ |
| Reklamations-Dossier | — | ✓ | ✓ | ✓ |
| **Vorausschau & Frühwarnung** | | | | |
| Umsatz-Forecast 4/8/12 Wo. | — | — | ✓ | ✓ |
| Reklamations-Frühwarnung | — | — | ✓ | ✓ |
| Reaktivierungsliste + CLV | — | — | ✓ | ✓ |
| Bad-Frühwarnung (Trend) | — | — | ✓ | ✓ |
| Saisonalitätswarnung | — | — | ✓ | ✓ |
| Profitabilitäts-Heatmap | — | — | ✓ | ✓ |
| YoY Day-by-Day | — | — | ✓ | ✓ |
| Auto-Monatsbericht (per Mail) | — | — | ✓ | ✓ |
| **Skalierung** | | | | |
| Mehrstandort / Mandanten | — | — | — | ✓ |
| KI-Insights (LLM-Auswertung) | — | — | — | ✓ |
| Custom-Reports / API-Zugang | — | — | — | ✓ |
| Vollexport aller Daten | — | — | — | ✓ |
| **Kontingente (Warnschwelle, kein Block)** | | | | |
| Foto-Speicher | 5 GB | 25 GB | 100 GB | unbegrenzt |
| Aufträge / Monat | 50 | 200 | unbegrenzt | unbegrenzt |
| Aktive Nutzer | 2 | 5 | 10 | unbegrenzt |

---

## 4. Doppelsperre — Lizenz × Datenreife

Vier mögliche Zustände pro Feature. Die UI muss alle vier sauber abbilden.

| Lizenz | Datenreife | UI-Zustand | Card-Verhalten |
|---|---|---|---|
| ✓ enthalten | ✓ ausreichend | **Aktiv** | Live-Werte, normale Card 🟢 |
| ✓ enthalten | ✗ zu dünn | **Wartend** | Card sichtbar, Wert ersetzt durch Konfidenz-Hinweis 🟡/⚪, kein Schloss |
| ✗ nicht enthalten | ✓ ausreichend | **Plan-gesperrt** | Schloss-Overlay, Demo-Werte dahinter, Plan-Hinweis sichtbar |
| ✗ nicht enthalten | ✗ zu dünn | **Doppelt gesperrt** | Schloss-Overlay + Hinweis „Auch nach Freischaltung erst ab X Aufträgen aussagekräftig" |

**Anzeige-Reihenfolge:** Plan-Sperre dominiert. Wenn ein Feature im Plan nicht enthalten ist, wird Datenreife sekundär kommuniziert (im Tooltip), nicht als Hauptzustand.

---

## 5. Rollen und Sichtbarkeit

| Rolle | Plan-Info sichtbar | Locked-Cards sichtbar | Admin-Konsole |
|---|:-:|:-:|:-:|
| `anbieter_admin` | ✓ alle Werkstätten | ✓ | ✓ |
| `inhaber` | ✓ eigener Plan (Footer + Settings) | ✓ | — |
| `meister` | — | ✓ ohne Plan-Hinweis | — |
| `office` | — | ✓ ohne Plan-Hinweis | — |
| `workshop` | — | ✓ ohne Plan-Hinweis | — |
| `quality` | — | ✓ ohne Plan-Hinweis | — |
| `viewer` | — | ✓ ohne Plan-Hinweis | — |

**Regel:** Mitarbeiter sehen Locked-Cards ohne Plan-Hinweis oder Upgrade-Anregung. Sie erfahren nur „Funktion zurzeit nicht verfügbar". Inhaber sieht zusätzlich den aktiven Plan und welcher Plan die Funktion freischalten würde.

---

## 6. Kontingent-Verhalten

**Grundsatz:** Werkstatt-Betrieb darf nie hart blockiert werden. Kontingente sind Vertriebs-Signale, keine technischen Sperren.

| Schwelle | Aktion |
|---|---|
| 80 % erreicht | dezente Info-Card im Inhaber-Dashboard |
| 100 % erreicht | gelber Banner im Inhaber-Bereich, Mail an Anbieter-Admin |
| 120 % erreicht | roter Banner, automatische Notiz im Anbieter-CRM |
| > 150 % erreicht | Anbieter kontaktiert Werkstatt aktiv, Tarif-Upgrade-Gespräch |

**Mitarbeiter sehen keine Kontingent-Banner.** Auftragsanlage, Foto-Upload, Nutzer-Anlage funktionieren weiter wie gewohnt.

---

## 7. Datenmodell

```ts
// src/lib/license/types.ts

export type LicenseTier = "basic" | "pro" | "premium" | "enterprise";

export type LicenseStatus = "active" | "suspended" | "demo";

export type LicensePlan = {
  id: string;
  workshopId: string;
  tier: LicenseTier;
  status: LicenseStatus;
  validFrom: string;          // ISO-Datum
  validUntil?: string;
  managedBy: "anbieter_admin";
  overrides: FeatureOverride[];
  quotas: PlanQuotas;
  changedAt: string;
  changedBy: string;
  changeReason?: string;
};

export type PlanQuotas = {
  photoStorageGb: number;
  ordersPerMonth: number;     // 0 = unbegrenzt
  activeUsers: number;        // 0 = unbegrenzt
  currentMonthOrders: number; // läuft mit
  currentStorageGb: number;
  currentActiveUsers: number;
};

export type FeatureKey =
  | "performance_score"
  | "performance_engpass"
  | "performance_weekly_goal"
  | "analytics_compare_period"
  | "finance_db_calculation"
  | "export_monthly_pdf"
  | "export_datev"
  | "export_tax_bundle"
  | "export_material_report"
  | "export_complaint_dossier"
  | "forecast_revenue"
  | "forecast_capacity"
  | "warning_complaint"
  | "warning_bath"
  | "warning_reactivation"
  | "warning_seasonality"
  | "analytics_yoy"
  | "analytics_profitability_heatmap"
  | "analytics_clv"
  | "auto_monthly_report"
  | "enterprise_multi_tenant"
  | "enterprise_ai_insights"
  | "enterprise_custom_reports"
  | "enterprise_api";

export type FeatureOverride = {
  featureKey: FeatureKey;
  forced: "enabled" | "disabled";
  reason: string;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
};

export type DataReadinessState = "reliable" | "limited" | "thin";

export type FeatureFlag = {
  key: FeatureKey;
  enabled: boolean;
  source:
    | "plan_included"
    | "override_enabled"
    | "override_disabled"
    | "plan_excluded";
  unlockTier?: LicenseTier;
  dataReadinessState: DataReadinessState;
  hintShort: string;
  hintLong: string;
};

export type LicenseAuditEntry = {
  id: string;
  workshopId: string;
  changedAt: string;
  changedBy: string;
  changeType:
    | "tier_change"
    | "override_set"
    | "override_removed"
    | "status_change"
    | "quota_adjusted";
  before: Partial<LicensePlan>;
  after: Partial<LicensePlan>;
  reason: string;
};
```

---

## 8. Resolver-Logik

Zentrale Funktion, einzige Stelle der Wahrheit für Feature-Verfügbarkeit.

```ts
// src/lib/license/resolveFeatures.ts

import { LicensePlan, FeatureFlag, FeatureKey } from "./types";
import { KpiReadinessMap } from "../dataReadiness/types";
import { PLAN_FEATURES } from "../config/planFeatures";

export function resolveFeatures(
  plan: LicensePlan,
  readiness: KpiReadinessMap
): FeatureFlag[] {
  const allKeys: FeatureKey[] = Object.keys(PLAN_FEATURES) as FeatureKey[];

  return allKeys.map((key) => {
    const includedInTier = PLAN_FEATURES[key].includes(plan.tier);
    const override = plan.overrides.find((o) => o.featureKey === key);
    const readinessState = readiness[key]?.state ?? "thin";

    let enabled = includedInTier;
    let source: FeatureFlag["source"] = includedInTier
      ? "plan_included"
      : "plan_excluded";

    if (override) {
      enabled = override.forced === "enabled";
      source =
        override.forced === "enabled" ? "override_enabled" : "override_disabled";
    }

    return {
      key,
      enabled,
      source,
      unlockTier: includedInTier ? undefined : firstTierWithFeature(key),
      dataReadinessState: readinessState,
      hintShort: buildHintShort(enabled, source, readinessState),
      hintLong: buildHintLong(
        enabled,
        source,
        readinessState,
        plan.tier,
        firstTierWithFeature(key)
      ),
    };
  });
}
```

**Caching:** Resolver-Resultat wird pro Session in einem React-Context gehalten. Re-Resolve nur bei Plan-Wechsel (via Polling oder Token-Refresh, max. 5 Min. Latenz).

**Server-Side-Spiegelung:** Backend-Endpunkte prüfen Plan-Berechtigung serverseitig. Client-Resolver ist Komfort, nicht Sicherheit.

---

## 9. UI / UX — Locked Cards

### Komponente

Eine zentrale `<LockedCard>`-Komponente. Keine eigenen Locked-Implementierungen je Feature.

```ts
// src/components/license/LockedCard.tsx
<LockedCard
  featureKey="forecast_revenue"
  flag={flag}
  visibility={role === "inhaber" ? "full" : "minimal"}
>
  <DemoContent />
</LockedCard>
```

### Visuelle Elemente

| Element | Position | Beschreibung |
|---|---|---|
| Schloss-Icon | oben rechts | dezent, neutrale Farbe, kein Rot |
| Plan-Badge | unter Titel, nur Inhaber-Rolle | „Verfügbar im Premium-Plan" |
| Demo-Inhalt | Hintergrund | 60 % Opazität, leichter Blur |
| Doppelsperre-Hinweis | Tooltip | nur wenn Lizenz UND Datenreife sperren |

### Verhaltensregeln

- Card bleibt immer sichtbar — niemals ausgeblendet.
- Hover/Tap auf Schloss → Tooltip.
- Kein direkter Buchungs-Button in V1. Stattdessen Kontakt-Hinweis im Tooltip.
- Maximal ein dezenter Upgrade-Hinweis pro Sitzung im Header — nicht pro Card.
- Keine roten Schloss-Icons, keine aggressiven Upsell-Banner.
- Mitarbeiter sehen keine Plan-Hinweise, nur „Funktion zurzeit nicht verfügbar".

### Tooltip-Texte (standardisiert)

Alle Tooltip-Texte zentral in `src/config/lockHints.ts`. Vier Vorlagen:

```ts
export const LOCK_HINTS = {
  plan_only: (unlockTier: LicenseTier) =>
    `Verfügbar im ${tierLabel(unlockTier)}-Plan. Sprechen Sie uns an.`,
  data_only: (kpi: string, reason: string) =>
    `${kpi} wird verlässlich, sobald ${reason}.`,
  plan_and_data: (unlockTier: LicenseTier, reason: string) =>
    `Verfügbar im ${tierLabel(unlockTier)}-Plan. Auch dann erst aussagekräftig, sobald ${reason}.`,
  override_disabled: (reason: string) =>
    `Vom Anbieter deaktiviert. Grund: ${reason}.`,
};
```

---

## 10. Demo-Modus

Vor dem Kauf zugänglich, ersetzt klassischen Trial.

| Aspekt | Konzept |
|---|---|
| Zugang | öffentliche Subdomain `demo.werkstatt-os.de` oder Pfad `/demo` |
| Auth | keine — Demo läuft ohne Account |
| Branche | Galvanik (Kreile-ähnlich), 12 Monate Historie |
| Mock-Daten | ~280 Aufträge, ~80 Kunden, 6 Stationen, 4 Bäder, vollständige Reklamations- und Bad-Historie |
| Sichtbare Pläne | alle Features als Premium aktiv und reif |
| Editierbar | nein, read-only — Schreibversuche zeigen Hinweis „Demo-Modus" |
| Banner | dauerhaft sichtbar: „Demo-Werkstatt — Beispiel-Daten, keine echten Werte" |
| Reset | täglich automatisch via Cronjob auf Ausgangszustand zurück |
| CTA | unaufdringlich im Header: „Eigene Werkstatt einrichten" → Kontaktformular |
| Wirkung auf Pricing | nicht in Demo sichtbar |

**Architektur-Hinweis:** Demo läuft mit identischer Codebasis wie Produktion, gesteuert durch `DEMO_MODE`-Flag und alternativen Daten-Provider (`MockDataProvider` statt `ApiDataProvider`).

**Generierte Demo-Kunden (Auszug):**

- Museum Lenzburg (Institution, Stammkunde)
- Oldtimer Klassik Frankfurt (Sammler)
- Antikladen Wagner
- Restauration Becker
- Schreinerei Hartmann
- Motorradtechnik Kessler

Keine echten Personen, keine realen Kontaktdaten.

---

## 11. Anbieter-Admin-Konsole

Eigene App-Sektion, separat von der Werkstatt-App-Navigation. Route: `/admin/workshops`. Zugang nur für Rolle `anbieter_admin`, serverseitig geschützt, 2FA verpflichtend.

### Funktionen

| Funktion | Zweck |
|---|---|
| Werkstatt-Liste | Übersicht aller Kunden mit Plan, Status, letzte Aktivität, Kontingent-Auslastung |
| Werkstatt-Detail | aktiver Plan, Override-Liste, Audit-Log, Nutzungsstatistik |
| Plan ändern | Dropdown Basic/Pro/Premium/Enterprise + Wirkungstermin (sofort / Monatsbeginn) |
| Feature-Override setzen | einzelnes Feature zwingend ein/aus, mit Grund und optionalem Ablauf |
| Demo aktivieren | Werkstatt temporär in Demo-Modus für Vertriebstermin |
| Kontingent anpassen | individuelle Kontingente überschreiben (z.B. Sondervereinbarung) |
| Nutzungsdaten | Aufträge/Monat, Speicher-GB, aktive Nutzer |
| Sperrung | Account suspendieren (Daten bleiben erhalten, Login deaktiviert) |
| Audit-Log | wer hat wann was geändert |

### Audit-Pflicht

Jede Änderung wird in `LicenseAuditEntry` protokolliert. Audit-Log ist append-only, keine Löschung möglich.

---

## 12. Downgrade- und Suspend-Verhalten

| Wechsel | Was passiert | Was bleibt |
|---|---|---|
| Premium → Pro | Forecast, Frühwarnungen, YoY werden Plan-gesperrt | bisher erzeugte PDF-Berichte bleiben downloadbar |
| Pro → Basis | Performance-Cockpit, Finanzcontrolling, Exporte werden Plan-gesperrt | Auftrags-, Kunden-, Lager- und Bad-Daten bleiben unverändert sichtbar |
| Jeder Downgrade | gesperrte Module zeigen Locked-Cards mit Demo-Werten | keine Datenlöschung, kein operativer Funktionsverlust |
| Suspendiert | Login deaktiviert, kein API-Zugriff | Daten bleiben mindestens 90 Tage erhalten, danach Anbieter-Entscheidung |
| Vertragsende | Werkstatt erhält Vollexport ihrer Daten | nach 90 Tagen Löschung gemäß AGB |

**Regel:** Daten gehören der Werkstatt. Pläne sperren Sicht und Auswertung — nie die Daten selbst.

---

## 13. Sicherheit und Datenschutz

- Feature-Flag-Check niemals nur clientseitig. Backend-Endpunkte prüfen Plan-Berechtigung serverseitig.
- Admin-Konsole separat geschützt: 2FA für `anbieter_admin` verpflichtend.
- Audit-Log append-only, keine Löschung durch Admin selbst.
- DSGVO-Auskunft funktioniert plan-unabhängig — auch im Basis-Plan kann jeder Kunde alle eigenen Daten exportieren.
- Demo-Modus enthält keine echten Personendaten — Mock-Werkstatt verwendet generierte Kunden.
- Suspendierter Account behält Daten 90 Tage, danach Entscheidung gemäß AGB.
- Mitarbeiter-Rolle sieht keinen Plan, keinen Tarif, keine Upgrade-Ansprache — Schutz vor verkaufsorientierter Manipulation am Arbeitsplatz.
- Kontingent-Überschreitung erzeugt nie automatische Sperrung, sondern manuelle Anbieter-Entscheidung.

---

## 14. Akzeptanzkriterien

### Feature-Flag-System

- [ ] Zentrale Resolver-Funktion `resolveFeatures(plan, readiness)` ist die einzige Quelle der Wahrheit.
- [ ] UI-Komponenten fragen ausschließlich `useFeatureFlag(key)` ab — kein `if (tier === "premium")` im JSX.
- [ ] Feature-Flag-Resultate werden pro Session gecacht, Re-Resolve nur bei Plan-Wechsel.
- [ ] Plan-Wechsel im Admin propagiert in laufende Sessions innerhalb von maximal 5 Minuten.
- [ ] Backend-Endpunkte prüfen Plan-Berechtigung serverseitig, unabhängig vom Client.

### UI für gesperrte Features

- [ ] Plan-gesperrte Cards sind sichtbar, niemals ausgeblendet.
- [ ] Schloss-Icon, Plan-Badge und Demo-Hintergrund stammen aus einer einzigen `<LockedCard>`-Komponente.
- [ ] Tooltip erklärt Lizenz- und Datenreife-Sperre getrennt.
- [ ] Maximal ein dezenter Upgrade-Hinweis pro Session im Header.
- [ ] Keine Kauf-Buttons in V1 — nur Kontakt-Hint.
- [ ] Mitarbeiter sehen keine Plan- oder Tarif-Hinweise.

### Rollen-Sichtbarkeit

- [ ] Inhaber sieht aktiven Plan im Footer/Settings.
- [ ] Mitarbeiter-Rollen sehen keinen Plan, keine Tarif-Bezeichnung, keine Upgrade-Ansprache.
- [ ] Plan-Anzeige für Inhaber zeigt: Tier, gültig bis, Kontingent-Stand.

### Kontingent-Verhalten

- [ ] Auftragsanlage, Foto-Upload, Nutzer-Anlage funktionieren auch bei 100 %+ Kontingent.
- [ ] Inhaber sieht Banner ab 80 % (info), 100 % (gelb), 120 % (rot).
- [ ] Anbieter erhält Mail-Benachrichtigung ab 100 % Überschreitung.
- [ ] Mitarbeiter sehen keine Kontingent-Banner.

### Anbieter-Admin

- [ ] Admin-Konsole über separate Route `/admin/workshops`.
- [ ] Zugang nur für Rolle `anbieter_admin`, serverseitig geschützt.
- [ ] 2FA verpflichtend.
- [ ] Jede Änderung wird in `LicenseAuditEntry` protokolliert.
- [ ] Plan-Wechsel und Overrides können mit Wirkungstermin in der Zukunft gesetzt werden.

### Demo-Modus

- [ ] Demo-Werkstatt zeigt alle Premium-Features aktiv.
- [ ] Banner „Demo-Werkstatt — Beispiel-Daten" dauerhaft sichtbar.
- [ ] Schreibversuche werden abgefangen, Hinweis erscheint.
- [ ] Tägliches Reset auf Ausgangszustand läuft via Cronjob.
- [ ] Demo nutzt identische Codebasis wie Produktion.

### Datenintegrität

- [ ] Downgrade löscht keine Daten.
- [ ] Suspendierter Account behält Daten mindestens 90 Tage.
- [ ] DSGVO-Auskunft funktioniert in jedem Plan, auch bei Suspendierung.
- [ ] Vollexport bei Vertragsende ist möglich.

---

## 15. Test-Plan

### Unit-Tests

- `resolveFeatures` für alle vier Plan-Tiers × alle Datenreife-Zustände (mindestens 16 Permutationen).
- `FeatureOverride` mit Ablaufdatum — vor und nach Ablauf.
- Doppelsperre: Plan ✗ + Datenreife ✗ → `source = plan_excluded`, nicht `data_thin`.
- Rollen-Filter für Plan-Anzeige.

### Integrations-Tests

- Plan-Wechsel im Admin → Werkstatt-Session erkennt Wechsel innerhalb 5 Minuten.
- Suspension → Login blockiert, API-Zugriff liefert 401.
- Demo-Modus → Schreibversuch wird abgefangen, Datenbank unverändert.
- Kontingent-Überschreitung → Banner sichtbar, Funktion bleibt aktiv.

### End-to-End-Tests

- Klick auf gesperrte Card → Tooltip korrekt, kein Crash.
- Downgrade Premium → Pro → Forecast-Card wird zu Locked-Card, vorherige PDFs bleiben downloadbar.
- Demo-URL ohne Auth aufrufbar, alle Premium-Features sichtbar.
- Mitarbeiter-Login zeigt keine Plan-Info, kein Tarif-Hinweis.
- Inhaber-Login zeigt Plan im Footer, Kontingent-Stand sichtbar.

---

## 16. Komponenten- und Datei-Struktur

```text
src/
├── lib/
│   ├── license/
│   │   ├── types.ts
│   │   ├── resolveFeatures.ts
│   │   ├── auditLog.ts
│   │   └── quotaTracker.ts
│   ├── dataReadiness/        (separate Spec, hier nur referenziert)
│   └── config/
│       ├── planFeatures.ts   (FeatureKey → LicenseTier[])
│       └── lockHints.ts      (Tooltip-Texte)
├── components/
│   ├── license/
│   │   ├── LockedCard.tsx
│   │   ├── PlanFooter.tsx           (Inhaber-Sicht)
│   │   ├── QuotaBanner.tsx          (Inhaber-Sicht)
│   │   └── UpgradeHint.tsx          (Header-Hint, max. 1x pro Session)
│   └── admin/
│       ├── WorkshopList.tsx
│       ├── WorkshopDetail.tsx
│       ├── PlanChangeDrawer.tsx
│       ├── OverrideDrawer.tsx
│       ├── QuotaAdjustDrawer.tsx
│       └── AuditLogPanel.tsx
├── hooks/
│   ├── useFeatureFlag.ts
│   ├── useLicensePlan.ts
│   └── useUserRole.ts
└── pages/
    ├── admin/
    │   └── workshops/
    │       ├── index.tsx
    │       └── [workshopId].tsx
    └── demo/
        └── index.tsx
```

---

## 17. Annahmen

- Pricing-Konkretisierung erfolgt später; Tier-Struktur ist davon unabhängig baubar.
- Genau ein aktiver Plan pro Werkstatt zur Zeit.
- Feature-Override ist Ausnahme, nicht Regel — z.B. Pilot-Sondervereinbarung oder temporäre Promo.
- Demo-Modus läuft auf gleicher Codebasis wie Produktion.
- Self-Service-Buchung kommt frühestens in V2 — keine Stripe-/Mollie-Integration in V1.
- Nutzungsdaten werden in der Admin-Konsole lesend dargestellt — keine automatische Sperrung bei Überschreitung.
- Datenreife-Konzept ist separater Strang; diese Spec referenziert es nur.
- Mitarbeiter-Rollen kennen keine Plan-Information, auch nicht zufällig (z.B. in API-Responses).
- Demo-Werkstatt verwendet ausschließlich Galvanik-Daten. Spätere Demo-Varianten (Hotel, Lerntherapie) wären separate Demo-Instanzen mit eigener Subdomain.

---

## 18. Offene Fragen (für V2)

| Frage | Kontext |
|---|---|
| Welche Features dürfen per Override aktiviert werden — alle oder Whitelist? | Missbrauchsrisiko bei Promo-Freischaltungen |
| Wer ist Eigentümer der Daten nach Vertragsende — Werkstatt oder Anbieter? | AGB-Frage |
| Soll der Datenreife-Banner im Basis-Plan sichtbar sein? | Basis hat keine Auswertung — möglicherweise unnötig |
| Welche Stripe-/Mollie-Integration für Self-Service-Buchung in V2? | Pricing-Konkretisierung Voraussetzung |
| Mehrsprachigkeit der Lock-Hints? | aktuell nur DE |

---

## 19. Antigravity-Bauprompt

```text
Implementiere ein Feature-Toggle- und Lizenz-System für die Werkstatt-OS App
gemäß SPEC_LICENSE_FEATURE_TOGGLES_v1.md.

Wesentliche Punkte:
1. Datenmodell für LicensePlan, FeatureFlag, FeatureOverride, LicenseAuditEntry
   in src/lib/license/types.ts.
2. Zentrale Resolver-Funktion resolveFeatures(plan, readiness) in
   src/lib/license/resolveFeatures.ts. Einzige Stelle der Feature-Entscheidung.
3. React-Hook useFeatureFlag(key) als einziger Zugriffspunkt für UI-Komponenten.
4. Wiederverwendbare LockedCard-Komponente mit drei Sichtbarkeitsmodi
   (Inhaber-full / Mitarbeiter-minimal / Demo).
5. PlanFooter und QuotaBanner ausschließlich für Inhaber-Rolle.
6. Admin-Konsole unter /admin/workshops mit Plan-Wechsel, Override-Drawer,
   Audit-Log. Zugang nur für anbieter_admin, serverseitig geschützt.
7. Demo-Modus unter /demo mit Galvanik-Mock-Werkstatt (280 Aufträge, 80 Kunden,
   12 Monate Historie). Read-only, täglicher Reset.
8. Kontingent-Tracker: warnt, blockiert nicht.
9. Backend-API-Endpunkte prüfen Plan-Berechtigung serverseitig.

Stack: bestehend (Next.js + TypeScript + Tailwind + shadcn/ui).

Wichtig:
- Kein Tier-Check in JSX-Komponenten — ausschließlich über useFeatureFlag.
- Locked-Cards niemals ausblenden, immer sichtbar mit Demo-Werten.
- Mitarbeiter dürfen keine Plan- oder Tarif-Information sehen.
- Daten gehen bei Downgrade niemals verloren.
- Audit-Log append-only.
- DSGVO-Auskunft plan-unabhängig.
```

---

## 20. Nächster Schritt

Drei aufeinanderfolgende Lieferungen, in dieser Reihenfolge:

1. **Feature-Key-Mapping finalisieren** — `src/config/planFeatures.ts` mit allen Mappings FeatureKey → LicenseTier-Array.
2. **`<LockedCard>`-Komponente spezifizieren** — exakte Layout-Maße, Tooltip-Verhalten, Animationen.
3. **Anbieter-Admin-Wireframe** — Werkstatt-Liste, Detail-View, Override-Drawer als low-fi Skizze.

Sobald diese drei Bausteine vorliegen, ist die Spec vollständig baubar.

---

*Ende der Spezifikation.*
