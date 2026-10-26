/** Kreile-Designsystem V1.1 · gemeinsame Typen */
export type DatenZustand = 'daten' | 'laedt' | 'leer' | 'fehler' | 'gesperrt' | 'klaerung' | 'aufbau';
export type Geraet = 'desktop' | 'tablet' | 'handy';
export type Ton = 'ok' | 'warn' | 'rot' | 'info' | 'marke' | 'teil' | 'dunkel';
export type HandlungsArt = 'konflikt' | 'warnung' | 'entscheidung';
export type Terminart = 'Wunsch' | 'bestätigt' | 'verschoben' | 'Abholung' | 'Versand' | 'Betrieb';
/** Nächster Schritt für leer/Fehler: genau einer (§6.7) */
export interface Schritt { text: string; icon?: import('./Icon').IconName; onClick: () => void; }
/** Texte für Nicht-Daten-Zustände einer datentragenden Komponente */
export interface ZustandTexte { titel?: string; leerText?: string; leerAktion?: Schritt; fehlerText?: string; fehlerAktion?: Schritt; gesperrtText?: string; laedtText?: string; }
export const cx = (...c: Array<string | false | null | undefined>): string => c.filter(Boolean).join(' ');
