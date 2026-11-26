export const TAKT_AUSFALL_COPY = {
  seit: (job: string, zeit: string) => `${job} ist seit ${zeit} nicht gelaufen`,
  neustart: (job: string) => `${job} jetzt neu starten`,
  gruende: {
    fehler: 'zuletzt mit Fehler abgebrochen',
    abgebrochen: 'zuletzt über die Zeitgrenze gelaufen',
    ohneLauf: 'noch nie gelaufen',
  },
  erfolg: (job: string) => `${job} läuft wieder.`,
  verboten: 'Neu starten darf nur, wer die Systemdiagnose hat.',
  jobs: {
    heute_neuaufbau: 'Aktualisierung von „Der Tag“',
    protokoll_aufbewahrung: 'Aufräumen des Protokolls',
  },
} as const;
