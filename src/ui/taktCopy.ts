export const TAKT_AUSFALL_COPY = {
  seit: (job: string, zeit: string) => `${job} ist seit ${zeit} nicht gelaufen`,
  neustart: (job: string) => `${job} jetzt neu starten`,
  gruende: {
    ok: 'Letzter erfolgreicher Lauf liegt zu lange zurück',
    fehler: 'zuletzt mit Fehler abgebrochen',
    abgebrochen: 'zuletzt über die Zeitgrenze gelaufen',
    ohneLauf: 'noch nie gelaufen',
  },
  erfolg: (job: string) => `${job} läuft wieder.`,
  verboten: 'Neu starten darf nur, wer die Systemdiagnose hat.',
  nurSystemdiagnose: 'Nur mit Systemdiagnose',
  neustartFehler: {
    CONFLICT: 'Für diesen Dienst steht gerade kein Neustart an.',
    SOURCE_INCOMPLETE: 'Der Dienststatus ist gerade nicht verfügbar. Versuch es erneut.',
    VALIDATION_ERROR: 'Wähle einen hinterlegten Dienst.',
  },
  jobs: {
    heute_neuaufbau: 'Aktualisierung von „Der Tag“',
    protokoll_aufbewahrung: 'Aufräumen des Protokolls',
  },
} as const;
