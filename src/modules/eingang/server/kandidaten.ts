import { sql } from 'drizzle-orm';
import { foldSearchText } from '@/lib/domain/searchText';
import { withTenantSavepoint, type PrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import { normaliseCustomerPhone } from '@/modules/customers/public';
import { eingangCopy } from '@/ui/eingangCopy';
import { findRecognizedCustomers } from '../customerRecognition';
import { saveIntakeCandidatesInTransaction, type IntakeCandidate } from './intakeAssignment';

export type KundenTrefferregel = 'ustid' | 'adresse' | 'domain' | 'name' | 'telefon';
type VorgangsTrefferregel = 'mailfaden' | 'teil' | 'ware_erwartet';
type Trefferregel = KundenTrefferregel | VorgangsTrefferregel;

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

export type EingangKandidatenEinstellungen = KandidatenEinstellungen & Readonly<{
  eingang_kandidat_stufen: Readonly<Record<VorgangsTrefferregel, number>>;
}>;

type Vorgangsbezug = { id: string; art: 'auftrag' | 'kv'; erstelltAm: number };
export type VorgangsTreffer = Vorgangsbezug & { regel: VorgangsTrefferregel };

function stufenwert(stufe: number) {
  if (!Number.isFinite(stufe) || stufe < 0 || stufe > 1) throw Error('I2_KANDIDAT_STUFE_UNGUELTIG');
  return stufe;
}

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
    const sicherheitWert = stufenwert(stufen[treffer.regel]);
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

export function waehleVorgangsKandidaten(treffer: readonly VorgangsTreffer[], einstellungen: EingangKandidatenEinstellungen) {
  const beste = new Map<string, VorgangsTreffer & { sicherheitWert: number }>();
  for (const kandidat of treffer) {
    const key = kandidat.art + ':' + kandidat.id;
    const sicherheitWert = stufenwert(einstellungen.eingang_kandidat_stufen[kandidat.regel]);
    const bisher = beste.get(key);
    if (!bisher || sicherheitWert > bisher.sicherheitWert) {
      beste.set(key, { ...kandidat, sicherheitWert });
    }
  }
  return [...beste.values()].sort((a, b) => b.sicherheitWert - a.sicherheitWert || b.erstelltAm - a.erstelltAm
    || a.art.localeCompare(b.art) || a.id.localeCompare(b.id)).slice(0, einstellungen.eingang_vorschlaege_max);
}

type Kundenquelle = {
  kunden: { id: string; name: string; companyName?: string | null; contactPerson?: string | null; email?: string | null; phone?: string | null }[];
  vollstaendig: boolean;
};

type KundenSuchoptionen = { exactSupplier?: 'vat'; mailIdentity?: { address: string; domain: string } };
type Kundenleser = (query: string, options?: KundenSuchoptionen) => Promise<Kundenquelle>;
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
  kundeId: string | null;
  kanal: string;
  ware: boolean;
  feld: LieferantenFeld | 'position' | null;
  wert: string | null;
};

export async function leseKandidatenQuellenInTransaction(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  itemId: string,
) {
  const zeilen = await tx.execute<Eingangsquelle>(sql`
    SELECT eingang.version, eingang.zuordnung, eingang.kunde_id AS "kundeId", eingang.kanal,
      ('ware'=ANY(eingang.anliegen) OR EXISTS(SELECT 1 FROM public.intake_file etikett
        WHERE etikett.tenant_id=eingang.tenant_id AND etikett.item_id=eingang.id AND etikett.foto_art='etikett')) AS ware,
      eingang.absender_adresse AS "absenderAdresse",
      eingang.absender_name AS "absenderName", eingang.absender_telefon AS "absenderTelefon",
      vorschlag.feld, CASE WHEN vorschlag.feld='position' THEN vorschlag.wert->>'bezeichnung'
        WHEN jsonb_typeof(vorschlag.wert)='string' THEN vorschlag.wert #>> '{}' END AS wert
    FROM public.intake_item eingang
    LEFT JOIN public.intake_suggestion vorschlag
      ON vorschlag.tenant_id=eingang.tenant_id AND vorschlag.item_id=eingang.id
      AND vorschlag.feld IN ('lieferant.ustid','lieferant.name','position') AND vorschlag.status IN ('offen','uebernommen')
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
    kundeId: erste.kundeId,
    kanal: erste.kanal,
    ware: erste.ware,
    teile: [...new Set(zeilen.flatMap(zeile => zeile.feld === 'position' && zeile.wert?.trim() ? [zeile.wert.trim()] : []))],
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
    const option = regel === 'ustid' ? { exactSupplier: 'vat' as const }
      : regel === 'adresse' && domain ? { mailIdentity: { address: adresse.toLowerCase(), domain } } : undefined;
    const quelle = await leseKundenquelle(() => leseKunden(query, option));
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

type VorgangsSuche = NonNullable<Awaited<ReturnType<typeof leseKandidatenQuellenInTransaction>>>;

async function leseVorgangsTreffer(tx: PrivilegedTenantTransaction, tenantId: string, itemId: string,
  quelle: VorgangsSuche, kandidaten: readonly string[]) {
  const kunden = sql.join(kandidaten.map(id => sql`${id}`), sql`,`);
  const treffer: VorgangsTreffer[] = [];
  let gelesen = false;
  let vollstaendig = true;
  const erfasse = async (regel: VorgangsTrefferregel, lesen: (nested: PrivilegedTenantTransaction) => Promise<readonly Vorgangsbezug[]>) => {
    try {
      const zeilen = await withTenantSavepoint(tx, lesen);
      for (const zeile of zeilen) treffer.push({ ...zeile, regel });
      gelesen = true;
    } catch {
      vollstaendig = false;
    }
  };

  if (kandidaten.length && quelle.teile.length) {
    const teile = new Set(quelle.teile.map(foldSearchText).filter(Boolean));
    await erfasse('teil', async nested => {
      const offen = await nested.execute<Vorgangsbezug & { teile: string[] }>(sql`
        SELECT art,id,extract(epoch FROM erstellt_am)::float8 AS "erstelltAm",teile
        FROM public.v_eingang_vorgaenge_v1 WHERE customer_id IN (${kunden})`);
      return offen.filter(vorgang => vorgang.teile.some(name => typeof name === 'string' && teile.has(foldSearchText(name))));
    });
  }
  if (quelle.kanal === 'mail') await erfasse('mailfaden', nested => nested.execute<Vorgangsbezug>(sql`
    SELECT DISTINCT vorgang.art,vorgang.id,extract(epoch FROM vorgang.erstellt_am)::float8 AS "erstelltAm"
    FROM public.intake_item aktuell
    JOIN public.intake_item vorher ON vorher.tenant_id=aktuell.tenant_id AND vorher.id<>aktuell.id AND vorher.kanal='mail'
    JOIN public.v_eingang_vorgaenge_v1 vorgang ON vorgang.art=vorher.vorgang_art AND vorgang.id=vorher.vorgang_id
    WHERE aktuell.tenant_id=${tenantId} AND aktuell.id=${itemId}::uuid
      AND (aktuell.conversation_id IS NOT NULL AND aktuell.conversation_id=vorher.conversation_id
        OR EXISTS (SELECT 1 FROM public.intake_event original
          WHERE original.tenant_id=aktuell.tenant_id AND original.item_id=aktuell.id
            AND original.art='angelegt' AND original.nachher->'replyChain'->>'source'='original_mime'
            AND original.nachher->'replyChain'->>'status'='present'
            AND (original.nachher->'replyChain'->'inReplyTo' ? vorher.internet_message_id
              OR original.nachher->'replyChain'->'references' ? vorher.internet_message_id)
            AND EXISTS (SELECT 1 FROM public.intake_file datei
              JOIN public.intake_event belegt ON belegt.tenant_id=datei.tenant_id AND belegt.item_id=datei.item_id
                AND belegt.art='original_gespeichert' AND belegt.nachher->>'fileId'=datei.id::text
                AND belegt.nachher->>'sha256'=datei.sha256
              WHERE datei.tenant_id=aktuell.tenant_id AND datei.item_id=aktuell.id AND datei.mime='message/rfc822'
                AND datei.sha256=original.nachher->'replyChain'->>'originalSha256')))`));
  if (kandidaten.length && quelle.ware) await erfasse('ware_erwartet', nested => nested.execute<Vorgangsbezug>(sql`
    SELECT vorgang.art,vorgang.id,extract(epoch FROM vorgang.erstellt_am)::float8 AS "erstelltAm"
    FROM public.v_intake_expected_goods_v1 ware
    JOIN public.v_eingang_vorgaenge_v1 vorgang ON vorgang.art='auftrag' AND vorgang.id=ware.id::text
    WHERE ware.tenant_id=${tenantId} AND ware.customer_id IN (${kunden}) AND NOT ware.storniert`));
  return { treffer, gelesen, vollstaendig };
}

type Firmenhinweis = { name: string | null; ustId: string | null };
export type KandidatenPorts = {
  firma: (tenantId: string) => Promise<Firmenhinweis | null>;
  leseKunden: (tx: PrivilegedTenantTransaction, tenantId: string, query: string, option?: KundenSuchoptionen) => Promise<Kundenquelle>;
};

export async function sucheKandidatenInTransaction(tx: PrivilegedTenantTransaction,
  kontext: { tenantId: string; akteur: string }, itemId: string, befehlId: string,
  einstellungen: EingangKandidatenEinstellungen, ports: KandidatenPorts) {
  await tx.execute(sql`SET LOCAL statement_timeout='2000ms'`);
  const quelle = await leseKandidatenQuellenInTransaction(tx, kontext.tenantId, itemId);
  if (!quelle) return 'keine';
  const arten: IntakeCandidate['feld'][] = [];
  const vorschlaege: IntakeCandidate[] = [];
  let automatischKundenId: string | null = null;
  let kundenVollstaendig = true;
  const kundenIds = new Set(quelle.kundeId ? [quelle.kundeId] : []);
  const einfuegen = (feld: IntakeCandidate['feld'], wert: IntakeCandidate['wert'], regel: Trefferregel, stufe: number) => {
    const schwelle = einstellungen.ki_sicherheitsschwelle;
    vorschlaege.push({ feld, wert, regel, stufe, grund: eingangCopy.kandidatGrund[regel],
      sicherheit: schwelle === null ? 'vorschlag' : stufe >= schwelle ? 'sicher' : 'unsicher' });
  };

  if (quelle.zuordnung === 'offen') {
    let firma: Firmenhinweis | null = null;
    try { firma = await ports.firma(kontext.tenantId); } catch { kundenVollstaendig = false; }
    const erkannt = await leseBelegteKundenTreffer(quelle.eingang, firma ?? { name: null, ustId: null },
      (query, option) => withTenantSavepoint(tx, nested => ports.leseKunden(nested, kontext.tenantId, query, option)));
    kundenVollstaendig &&= erkannt.quellenVollstaendig && quelle.hinweiseVollstaendig && firma !== null;
    if (erkannt.kandidaten !== 'keine') {
      arten.push('kunde');
      const auswahl = waehleKundenKandidaten({ zuordnung: quelle.zuordnung, quellenVollstaendig: kundenVollstaendig,
        treffer: erkannt.treffer, einstellungen });
      automatischKundenId = auswahl.automatischKundenId;
      for (const kunde of auswahl.vorschlaege) {
        kundenIds.add(kunde.kundenId);
        einfuegen('kunde', kunde.kundenId, kunde.regel, kunde.sicherheitWert);
      }
    }
  }
  const vorgaenge = await leseVorgangsTreffer(tx, kontext.tenantId, itemId, quelle, [...kundenIds]);
  if (vorgaenge.gelesen) {
    arten.push('vorgang');
    for (const vorgang of waehleVorgangsKandidaten(vorgaenge.treffer, einstellungen)) {
      einfuegen('vorgang', { art: vorgang.art, id: vorgang.id }, vorgang.regel, vorgang.sicherheitWert);
    }
  }
  if (!arten.length) return 'keine';
  const gespeichert = await saveIntakeCandidatesInTransaction(tx, kontext, {
    itemId, befehlId, version: quelle.version, arten, vorschlaege, kundeId: automatischKundenId,
  });
  return !gespeichert ? 'keine' : kundenVollstaendig && vorgaenge.vollstaendig ? 'ok' : 'teilweise';
}
