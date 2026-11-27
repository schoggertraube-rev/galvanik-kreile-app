import { sql } from 'drizzle-orm';
import { foldSearchText } from '@/lib/domain/searchText';
import type { PrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import { normaliseCustomerPhone } from '@/modules/customers/public';
import { findRecognizedCustomers } from '../customerRecognition';

export type KundenTrefferregel = 'ustid' | 'adresse' | 'domain' | 'name' | 'telefon';

export type KundenTreffer = Readonly<{
  kundenId: string;
  regel: KundenTrefferregel;
  grundWert: string;
}>;

type Zuordnung = 'offen' | 'automatisch' | 'bestaetigt' | 'hand';

type BewerteterKundenTreffer = KundenTreffer & { sicherheitWert: number };

type KandidatenEinstellungen = Readonly<{
  eingang_vorschlaege_max: number;
  eingang_kandidat_stufen: Readonly<Record<KundenTrefferregel, number>>;
  ki_sicherheitsschwelle: number | null;
}>;

/** Bewertet belegte Treffer der Kundenleser, bevor der Erkennungslauf sie speichert. */
export function waehleKundenKandidaten(input: {
  treffer: readonly KundenTreffer[];
  zuordnung: Zuordnung;
  quellenVollstaendig: boolean;
  einstellungen: KandidatenEinstellungen;
}) {
  if (input.zuordnung !== 'offen') return { vorschlaege: [], automatischKundenId: null };
  const { eingang_vorschlaege_max: maximum, eingang_kandidat_stufen: stufen, ki_sicherheitsschwelle: schwelle } =
    input.einstellungen;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 3 ||
      (schwelle !== null && (!Number.isFinite(schwelle) || schwelle < 0 || schwelle > 1))) {
    throw Error('I2_KANDIDAT_EINSTELLUNGEN_UNGUELTIG');
  }

  const proKunde = new Map<string, BewerteterKundenTreffer>();
  for (const treffer of input.treffer) {
    const sicherheitWert = stufen[treffer.regel];
    if (!Number.isFinite(sicherheitWert) || sicherheitWert < 0 || sicherheitWert > 1) {
      throw Error('I2_KANDIDAT_STUFE_UNGUELTIG');
    }
    const bisher = proKunde.get(treffer.kundenId);
    if (!bisher || sicherheitWert > bisher.sicherheitWert) {
      proKunde.set(treffer.kundenId, { ...treffer, sicherheitWert });
    }
  }

  const geordnet = [...proKunde.values()].sort((links, rechts) => rechts.sicherheitWert - links.sicherheitWert);
  // Auch ausgeblendete Treffer zählen für die eindeutige automatische Zuordnung.
  const sichere = schwelle === null ? [] : geordnet.filter(treffer => treffer.sicherheitWert >= schwelle);
  return {
    vorschlaege: geordnet.slice(0, maximum),
    automatischKundenId: input.quellenVollstaendig && sichere.length === 1 ? sichere[0].kundenId : null,
  };
}

type Kundenquelle = {
  kunden: { id: string; name: string; companyName?: string | null; contactPerson?: string | null; email?: string | null; phone?: string | null }[];
  vollstaendig: boolean;
};

type Kundenleser = (query: string, options?: { exactSupplier: 'vat' }) => Promise<Kundenquelle>;
type Eingangsadresse = {
  absenderAdresse: string | null;
  absenderName: string | null;
  absenderTelefon: string | null;
  lieferantenUstId: string | null;
  lieferantenName: string | null;
};

type LieferantenFeld = 'lieferant.ustid' | 'lieferant.name';
type Eingangsquelle = Pick<Eingangsadresse, 'absenderAdresse' | 'absenderName' | 'absenderTelefon'> & {
  version: number;
  zuordnung: Zuordnung;
  feld: LieferantenFeld | null;
  wert: string | null;
};

export async function leseKandidatenQuellenInTransaction(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  itemId: string,
) {
  const zeilen = await tx.execute<Eingangsquelle>(sql`
    SELECT eingang.version, eingang.zuordnung, eingang.absender_adresse AS "absenderAdresse",
      eingang.absender_name AS "absenderName", eingang.absender_telefon AS "absenderTelefon",
      vorschlag.feld, CASE WHEN jsonb_typeof(vorschlag.wert)='string' THEN vorschlag.wert #>> '{}' END AS wert
    FROM public.intake_item eingang
    LEFT JOIN public.intake_suggestion vorschlag
      ON vorschlag.tenant_id=eingang.tenant_id AND vorschlag.item_id=eingang.id
      AND vorschlag.feld IN ('lieferant.ustid','lieferant.name') AND vorschlag.status IN ('offen','uebernommen')
    WHERE eingang.tenant_id=${tenantId} AND eingang.id=${itemId}::uuid
  `);
  const erste = zeilen[0];
  if (!erste) return null;
  if (!Number.isSafeInteger(erste.version) || erste.version < 1) throw Error('I2_EINGANG_VERSION_UNGUELTIG');

  function lieferantenHinweis(feld: LieferantenFeld) {
    const werte = new Set(zeilen.filter(zeile => zeile.feld === feld).map(zeile => zeile.wert?.trim() || null));
    const wert = werte.size === 1 ? [...werte][0] ?? null : null;
    return { wert, lesbar: werte.size === 0 || wert !== null };
  }

  const ustId = lieferantenHinweis('lieferant.ustid');
  const name = lieferantenHinweis('lieferant.name');
  return {
    version: erste.version,
    zuordnung: erste.zuordnung,
    hinweiseVollstaendig: ustId.lesbar && name.lesbar,
    eingang: {
      absenderAdresse: erste.absenderAdresse,
      absenderName: erste.absenderName,
      absenderTelefon: erste.absenderTelefon,
      lieferantenUstId: ustId.wert,
      lieferantenName: name.wert,
    },
  };
}

function mailDomain(adresse: string | null | undefined): string | null {
  const match = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/u.exec(adresse?.trim() ?? '');
  return match ? match[1].toLowerCase() : null;
}

async function leseKundenquelle(lesen: () => Promise<Kundenquelle>): Promise<Kundenquelle | null> {
  let frist: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lesen(),
      new Promise<null>(resolve => { frist = setTimeout(() => resolve(null), 2000); }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(frist);
  }
}

/** Four possible reads. All identity matching uses rows returned by the existing customer reader. */
export async function leseBelegteKundenTreffer(
  eingang: Eingangsadresse,
  firma: { name: string | null; ustId: string | null },
  leseKunden: Kundenleser,
) {
  const normUstId = (text: string | null) => text?.replace(/\s+/gu, '').toUpperCase() ?? '';
  const eigeneUstId = normUstId(firma.ustId);
  const lieferantenUstId = normUstId(eingang.lieferantenUstId);
  const eigeneFirma = firma.name ? foldSearchText(firma.name) : '';
  const istEigenesUnternehmen = (name: string | null | undefined) =>
    Boolean(name && eigeneFirma && foldSearchText(name) === eigeneFirma);
  const lieferant = eingang.lieferantenName?.trim();
  const sender = eingang.absenderName?.trim();
  const name = sender || (eigeneFirma && lieferant) || '';
  const adresse = eingang.absenderAdresse?.trim() ?? '';
  const domain = mailDomain(adresse);
  const telefon = eingang.absenderTelefon?.trim() ?? '';
  const auftraege: { regel: KundenTrefferregel; query: string }[] = [];
  if (lieferantenUstId && eigeneUstId && lieferantenUstId !== eigeneUstId) auftraege.push({ regel: 'ustid', query: lieferantenUstId });
  if (domain) auftraege.push({ regel: 'adresse', query: domain });
  if (name && !istEigenesUnternehmen(name)) auftraege.push({ regel: 'name', query: name });
  if (normaliseCustomerPhone(telefon).length >= 6) auftraege.push({ regel: 'telefon', query: telefon });

  const treffer: KundenTreffer[] = [];
  let geleseneQuellen = 0;
  let vollstaendig = !(lieferantenUstId && !eigeneUstId) && !(lieferant && !sender && !eigeneFirma);
  for (const { regel, query } of auftraege) {
    const quelle = await leseKundenquelle(() => leseKunden(query, regel === 'ustid' ? { exactSupplier: 'vat' } : undefined));
    if (!quelle) {
      vollstaendig = false;
      continue;
    }
    geleseneQuellen += 1;
    vollstaendig &&= quelle.vollstaendig;
    const kunden = quelle.kunden.filter(kunde => !istEigenesUnternehmen(kunde.companyName ?? kunde.name));
    const aufnehmen = (kundenId: string, art: KundenTrefferregel, grundWert: string) => {
      treffer.push({ kundenId, regel: art, grundWert });
    };
    if (regel === 'ustid') {
      for (const kunde of kunden) aufnehmen(kunde.id, regel, query);
      continue;
    }

    const identitaet = regel === 'adresse' ? { email: adresse } : regel === 'telefon' ? { phone: telefon } : undefined;
    const erkannt = await findRecognizedCustomers(regel === 'name' ? query : '', async () => ({ code: 'OK', customers: kunden }), identitaet);
    if (erkannt.code !== 'OK') {
      vollstaendig = false;
      continue;
    }
    for (const kunde of erkannt.customers) aufnehmen(kunde.id, regel, regel === 'adresse' ? adresse : query);
    if (regel === 'adresse') {
      const exakt = new Set(erkannt.customers.map(kunde => kunde.id));
      for (const kunde of kunden) {
        if (!exakt.has(kunde.id) && mailDomain(kunde.email) === domain) aufnehmen(kunde.id, 'domain', query);
      }
    }
  }

  return {
    treffer,
    quellenVollstaendig: geleseneQuellen > 0 && vollstaendig,
    kandidaten: geleseneQuellen === 0 ? 'keine' as const : vollstaendig ? 'ok' as const : 'teilweise' as const,
  };
}
