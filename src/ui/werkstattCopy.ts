export const WORKSHOP_QUOTE_COPY={title:'KV-Ware',filters:{all:'Alle',expected:'Ware erwartet',blocked:'Gesperrt',here:'Ware im Haus'},empty:'Keine KV-Ware in dieser Auswahl.',limited:'Anzeige auf die 100 zuletzt geänderten offenen KVs beschränkt.',open:'KV öffnen',state:(kind:'expected'|'blocked'|'here',locations:string[],reason:string|null)=>kind==='expected'?'Ware erwartet':(kind==='blocked'?'gesperrt':'Ware im Haus')+(locations.length?' · '+locations.join(' / '):'')+(reason?' · '+reason:'')};

export const WORK_TIME_COPY = {
  invalidInput: "Gib die Arbeitszeit erneut ein. Die Eingabe ist ungültig.",
  itemUnavailable: "Die gewählte Position fehlt in diesem Auftrag. Wähle eine Position daraus.",
  backdateReasonRequired: "Gib einen Grund an, um Arbeitszeit für einen früheren Tag zu buchen.",
  stationMissing: "Wähle eine hinterlegte Station, damit die Arbeitszeit zugeordnet werden kann.",
  invalidDuration: "Gib ganze Minuten ungleich null ein. Minuswerte brauchen eine Korrekturbuchung.",
  costRateMissing: (person: string) => `Kostensatz für ${person} fehlt`,
  buendelLaufMindestdauer: (minuten: string) =>
    `Gib für den Bündel-Lauf mindestens ${minuten} Minuten ein, damit jeder Auftrag einen Zeitanteil erhält.`,
  scrapQuantityInvalid: (menge: string) => `Gib 0 bis ${menge} Teile als Ausschuss ein.`,
  scrapReasonRequired: "Gib einen Grund für den Ausschuss an.",
  scrapTotalPiecesRequired: (einheit: string) => `Gib die Gesamtzahl der Teile an. Diese Position wird in ${einheit} abgerechnet.`,
  scrapAfterInvoice: (nummer: string) => `Ausschuss ist nicht mehr änderbar. Rechnung ${nummer} ist erstellt.`,
  scrapHistory: (menge: number, gesamt: string, grund: string) => `${menge} von ${gesamt} Teilen Ausschuss: ${grund}`,
} as const;
