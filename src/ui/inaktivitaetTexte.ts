export const INAKTIVITAET_TEXTE = {
  abgemeldet: (minuten: number, entwurfGesichert: boolean) =>
    `Abgemeldet nach ${minuten} Minuten ohne Eingabe${entwurfGesichert ? " · 1 Entwurf gesichert" : ""}`,
  weiter: (bezeichnung: string) => `Weiter mit ${bezeichnung}`,
  entwurfOffen: "Dein Entwurf ist noch offen, versuch es erneut.",
} as const;
