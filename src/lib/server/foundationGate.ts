/**
 * Each capability has to be enabled by its own reviewed contract change.
 * An unknown value and every listed value default to deny; there is no global
 * switch that can revive the quarantined product surface in one edit.
 */
export const FOUNDATION_CAPABILITIES = [
  "Analyse",
  "Anfragen und Angebotserfassung",
  "Anfrage-Extraktion",
  "Auftragsdetail",
  "Auftragsprozess",
  "Bäder",
  "Bäder und Messwerte",
  "Belegsuche",
  "Benutzer-API",
  "Buchhaltungsanalyse",
  "Buchhaltung",
  "Benutzer- und Rechteverwaltung",
  "Cockpit",
  "Demo-Initialisierung",
  "E-Mail-Versand",
  "Entwickler-Analyse",
  "Entwickler-Telemetrie",
  "Etikettendruck",
  "Feedback-Versand",
  "Freitext-Extraktion",
  "Globale KI-Suche",
  "Globale Suche",
  "KI-Anreicherung",
  "KI-Telefonnotizanalyse",
  "Kundenerkennung",
  "Kundendetails",
  "Kundensuche in der Erfassung",
  "Legacy-Artikelverwaltung",
  "Legacy-Auftragserfassung",
  "Legacy-Auftragsfoto",
  "Legacy-Kundenkarte",
  "Legacy-Performance-Kennzahlen",
  "Legacy-Preispositionen",
  "Legacy-Start der Stationsbearbeitung",
  "Legacy-Statusereignisse",
  "Legacy-Statuswechsel",
  "Lieferschein",
  "Marketing",
  "Marketinganalyse",
  "Morgenhinweise",
  "Notiz-Extraktion",
  "OCR",
  "OCR-Verarbeitung",
  "Periodenabschluss",
  "Reklamationen",
  "Risikoauswertung",
  "Scan-Status",
  "Scan-Upload",
  "Systemdiagnose und Schreibtest",
  "Tageschronik",
  "Tagesfristen",
  "Tagesprioritäten",
  "Tagesstatus",
  "Teilefoto-Upload",
  "Telefonnotizen",
  "Timeline",
  "Top-Kunden",
  "Unternehmenseinstellungen",
  "Auftragskosten und Verbrauchsbuchung",
  "Vorlagen",
  "Versand und Versandkommunikation",
  "Warendurchlauf",
  "Zahlungserinnerungen und Mahnungen",
  "Zahlungsanforderung",
  "Zeit-, Material- und Vorlagenerfassung",
] as const;

export type FoundationCapability = (typeof FOUNDATION_CAPABILITIES)[number];

const FOUNDATION_CAPABILITY_ALLOWLIST: Readonly<Record<FoundationCapability, boolean>> = Object.freeze(
  Object.fromEntries(FOUNDATION_CAPABILITIES.map((capability) => [capability, false])) as Record<FoundationCapability, boolean>,
);

export function foundationUnavailableResponse(capability: FoundationCapability): Response {
  return Response.json(
    {
      error: "NOT_CONFIGURED",
      message: `${capability} ist bis zum geprüften Fundamentvertrag nicht verfügbar.`,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function isFoundationAreaEnabled(capability: FoundationCapability): boolean {
  return FOUNDATION_CAPABILITY_ALLOWLIST[capability] === true;
}

export function foundationUnavailableAction(capability: FoundationCapability): never {
  throw new Error(`NOT_CONFIGURED: ${capability} ist bis zum geprüften Fundamentvertrag nicht verfügbar.`);
}
