export type HeuteZeile = Readonly<{
  key: string;
  quelleId: string;
  gegenstand: string;
  handlung: string;
  grund: string;
  faellig: string | null;
  rang: number | null;
  betrag?: number | null;
  ziel: string | null;
  befehl: string | null;
  sperrt?: boolean;
  bestand?: unknown;
}>;

export type TagQuelle = Readonly<{
  id: `${string}.${string}`;
  modul: string;
  bereich: string | null;
  rang: number | null;
  bestand?: Readonly<{leser: string; umfang: 'mandant' | 'auftrag'}>;
}>;

export function fuegeTagQuellenZusammen(
  gruppen: readonly Readonly<{modul: string; quellen: readonly TagQuelle[]}>[],
): readonly TagQuelle[] {
  const quellen = new Map<string, TagQuelle>();
  for (const gruppe of gruppen) {
    for (const quelle of gruppe.quellen) {
      if (quelle.modul !== gruppe.modul || !quelle.id.startsWith(gruppe.modul + '.') ||
          !/^[a-z]+\.[a-z]+$/.test(quelle.id) || quellen.has(quelle.id)) {
        throw Error('TAG_QUELLE_DOPPELT_ODER_FALSCH');
      }
      quellen.set(quelle.id, quelle);
    }
  }
  return Object.freeze([...quellen.values()]);
}
