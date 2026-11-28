type Spalte = 'buchungstag' | 'valuta' | 'betrag' | 'waehrung' | 'referenz'
  | 'verwendung' | 'gegenpartei' | 'iban' | 'satzart' | 'settlementId';

export type ImportProfil = {
  trenner: string;
  dezimal: '.' | ',';
  datumsformat: string;
  kodierung: string;
  waehrung?: string;
  spalten: Record<'buchungstag' | 'betrag', string> & Partial<Record<Spalte, string>>;
};

type Bewegungsart = 'umsatz' | 'kartenverkauf' | 'anbietergebuehr' | 'anbieterauszahlung' | 'anbietereinbehalt';
type Satzart = 'anfang' | 'ende' | Bewegungsart;
export type RohBewegung = {
  zeile: number;
  art: Bewegungsart;
  buchungstag: string;
  valuta?: string;
  betragCents: number;
  waehrung: string;
  transaktionsRef?: string;
  verwendungszweck?: string;
  gegenpartei?: string;
  iban?: string;
};
type Zeilenfehler = {
  zeile: number;
  feld: Spalte | 'format';
  code: 'FORMAT_UNBEKANNT' | 'SPALTE_FEHLT' | 'WERT_UNGUELTIG';
};
type Auszug<Zeile extends RohBewegung> = {
  kopf: { anfangCents?: number; endeCents?: number; von?: string; bis?: string; auszugId?: string };
  zeilen: Zeile[];
  fehler: Zeilenfehler[];
};
type CsvZeile = { zeile: number; werte: string[] };

function csvZeilen(text: string, trenner: string): { zeilen: CsvZeile[]; abbruch?: number } {
  const zeilen: CsvZeile[] = [];
  let werte: string[] = [];
  let wert = '';
  let zeile = 1;
  let beginn = 1;
  let zustand: 'feld' | 'zitat' | 'zitat_ende' = 'feld';

  const feldAbschliessen = () => {
    werte.push(wert);
    wert = '';
    zustand = 'feld';
  };
  const zeileAbschliessen = () => {
    if (werte.length || wert || zustand === 'zitat_ende') {
      feldAbschliessen();
      zeilen.push({ zeile: beginn, werte });
    }
    werte = [];
    beginn = ++zeile;
  };

  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i];
    if (zustand === 'zitat') {
      if (zeichen === '"' && text[i + 1] === '"') { wert += '"'; i++; }
      else if (zeichen === '"') zustand = 'zitat_ende';
      else {
        wert += zeichen;
        if (zeichen === '\n' || (zeichen === '\r' && text[i + 1] !== '\n')) zeile++;
      }
    } else if (zeichen === trenner) feldAbschliessen();
    else if (zeichen === '\n' || zeichen === '\r') {
      if (zeichen === '\r' && text[i + 1] === '\n') i++;
      zeileAbschliessen();
    } else if (zustand === 'zitat_ende' || (zeichen === '"' && wert)) return { zeilen, abbruch: beginn };
    else if (zeichen === '"') zustand = 'zitat';
    else wert += zeichen;
  }
  if (zustand === 'zitat') return { zeilen, abbruch: beginn };
  zeileAbschliessen();
  return { zeilen };
}

function betragInCent(text: string, dezimal: ImportProfil['dezimal']): number | undefined {
  const muster = dezimal === ','
    ? /^([+-]?)(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/
    : /^([+-]?)(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;
  const wert = muster.exec(text);
  if (!wert) return undefined;
  const cent = Number(wert[2].replace(/[.,]/g, '')) * 100 + Number((wert[3] ?? '').padEnd(2, '0'));
  if (Number.isSafeInteger(cent)) return wert[1] === '-' ? -cent : cent;
}

function datum(text: string, format: string): string | undefined {
  const muster = /^(YYYY|MM|DD)([./-])(YYYY|MM|DD)\2(YYYY|MM|DD)$/.exec(format.toUpperCase());
  if (!muster) return undefined;
  const felder = [muster[1], muster[3], muster[4]];
  const teile = text.split(muster[2]);
  if (teile.length !== 3 || new Set(felder).size !== 3) return undefined;
  const iso = ['YYYY', 'MM', 'DD'].map(feld => teile[felder.indexOf(feld)]).join('-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000-')) return undefined;
  const tag = new Date(iso + 'T00:00:00Z');
  if (Number.isFinite(tag.getTime()) && tag.toISOString().slice(0, 10) === iso) return iso;
}

export function leseProfilAuszug<Zeile extends RohBewegung>(
  bytes: Uint8Array,
  profil: ImportProfil,
  satzart: (wert: string | undefined) => Satzart | undefined,
  projiziere: (bewegung: RohBewegung, roherWert: (feld: Spalte) => string | undefined) => Zeile,
): Auszug<Zeile> {
  const result: Auszug<Zeile> = { kopf: {}, zeilen: [], fehler: [] };
  const formatFehlt = (zeile: number): Auszug<Zeile> => ({
    ...result, fehler: [{ zeile, feld: 'format', code: 'FORMAT_UNBEKANNT' }],
  });
  if (!profil.spalten.buchungstag || !profil.spalten.betrag
    || profil.trenner.length !== 1 || /["\r\n]/.test(profil.trenner)
    || (profil.dezimal !== '.' && profil.dezimal !== ',')) return formatFehlt(1);
  let text: string;
  try { text = new TextDecoder(profil.kodierung, { fatal: true }).decode(bytes); }
  catch { return formatFehlt(1); }
  const { zeilen, abbruch } = csvZeilen(text, profil.trenner);
  const [kopfzeile, ...saetze] = zeilen;
  if (!kopfzeile) return formatFehlt(abbruch ?? 1);
  const spalten = kopfzeile.werte.map(wert => wert.trim());
  if (spalten.includes('') || new Set(spalten).size !== spalten.length) return formatFehlt(kopfzeile.zeile);
  const index = new Map(spalten.map((wert, position) => [wert, position]));
  const fehlendeFelder = (Object.keys(profil.spalten) as Spalte[]).filter(feld => {
    const spaltenname = profil.spalten[feld];
    return spaltenname !== undefined && !index.has(spaltenname);
  });
  if (fehlendeFelder.length) {
    result.fehler = fehlendeFelder.map(feld => ({ zeile: kopfzeile.zeile, feld, code: 'SPALTE_FEHLT' }));
    return result;
  }

  for (const { zeile, werte } of saetze) {
    const roherWert = (feld: Spalte) => werte[index.get(profil.spalten[feld] ?? '') ?? -1];
    const wert = (feld: Spalte) => roherWert(feld)?.trim() || undefined;
    const melde = (feld: Zeilenfehler['feld']) => {
      result.fehler.push({ zeile, feld, code: 'WERT_UNGUELTIG' });
    };
    if (werte.length !== spalten.length) { melde('format'); continue; }
    const art = satzart(wert('satzart'));
    if (!art) { melde('satzart'); continue; }
    const buchungstag = datum(wert('buchungstag') ?? '', profil.datumsformat);
    if (!buchungstag) { melde('buchungstag'); continue; }
    const betragCents = betragInCent(wert('betrag') ?? '', profil.dezimal);
    if (betragCents === undefined) { melde('betrag'); continue; }
    if (art === 'anfang' || art === 'ende') {
      const betrag = art === 'anfang' ? 'anfangCents' : 'endeCents';
      if (result.kopf[betrag] !== undefined) { melde('satzart'); continue; }
      result.kopf[betrag] = betragCents;
      result.kopf[art === 'anfang' ? 'von' : 'bis'] = buchungstag;
      continue;
    }
    if (betragCents === 0) { melde('betrag'); continue; }
    const waehrung = profil.spalten.waehrung ? wert('waehrung') : profil.waehrung;
    if (!waehrung || !/^[A-Z]{3}$/.test(waehrung)) { melde('waehrung'); continue; }
    const valutaText = wert('valuta');
    const valuta = valutaText === undefined ? undefined : datum(valutaText, profil.datumsformat);
    if (valutaText && !valuta) { melde('valuta'); continue; }
    result.zeilen.push(projiziere({
      zeile, art, buchungstag, valuta, betragCents, waehrung,
      transaktionsRef: wert('referenz'), verwendungszweck: wert('verwendung'),
      gegenpartei: wert('gegenpartei'), iban: wert('iban'),
    }, roherWert));
  }
  if (abbruch !== undefined) result.fehler.push({ zeile: abbruch, feld: 'format', code: 'WERT_UNGUELTIG' });
  return result;
}

export function leseCsvAuszug(bytes: Uint8Array, profil: ImportProfil) {
  return leseProfilAuszug(bytes, profil, satz => {
    if (satz === 'Anfang') return 'anfang';
    if (satz === 'Ende') return 'ende';
    if (satz === 'Umsatz' || (satz === undefined && !profil.spalten.satzart)) return 'umsatz';
  }, zeile => zeile);
}
