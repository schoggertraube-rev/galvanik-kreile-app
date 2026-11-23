import { canonicalJson } from "@/lib/domain/canonicalJson";
import type { IntakeDraftPorts } from "@/modules/eingang/public";
type DraftWriteInput = Parameters<IntakeDraftPorts["saveDraft"]>[0];

type Entwurf = Readonly<{
  id: string;
  art: DraftWriteInput["art"] | null;
  payload: DraftWriteInput["payload"];
  zuletzt_feld: string | null;
  version: number;
}>;

type EntwurfAntwort = Readonly<{ code: string; drafts?: readonly Entwurf[] }>;

type Anschluesse = Readonly<{
  saveIntakeDraft: (original: DraftWriteInput) => Promise<EntwurfAntwort>;
  logoutWithReadCleanup: (anlass: Readonly<{minuten:number;entwurfGesichert:boolean}>) => Promise<Readonly<{ok:boolean}>>;
}>;

function bestaetigterEntwurf(original: DraftWriteInput, antwort: EntwurfAntwort) {
  if (antwort.code !== "OK") return null;
  const belege = antwort.drafts?.filter(beleg => beleg.id === original.id);
  if (belege?.length !== 1) return null;
  const [beleg] = belege;
  const gespeicherteVersion = original.expectedVersion === null ? 0 : original.expectedVersion + 1;
  if (beleg.art !== original.art || beleg.zuletzt_feld !== original.lastField
    || beleg.version !== gespeicherteVersion
    || canonicalJson(beleg.payload) !== canonicalJson(original.payload)) return null;
  return beleg.id;
}

/** Der vorhandene Formularrahmen übergibt die gesicherte Kopie des letzten Eingabestands. */
export async function pruefeInaktivitaetsAbmeldung(
  eingabe: Readonly<{ minuten: number | null; inaktivMs: number; entwurf: DraftWriteInput | null }>,
  ports: Anschluesse,
) {
  const { minuten, inaktivMs, entwurf } = eingabe;
  if (minuten===null || !Number.isSafeInteger(minuten) || minuten<=0
    || !Number.isFinite(inaktivMs) || inaktivMs < minuten*60_000) return { code:"BLEIBT_ANGEMELDET" } as const;

  let entwurfId: string | null = null;
  if (entwurf) {
    try {
      entwurfId = bestaetigterEntwurf(entwurf, await ports.saveIntakeDraft(entwurf));
    } catch {
      return {code:"ENTWURF_OFFEN"} as const;
    }
    if (entwurfId===null) return {code:"ENTWURF_OFFEN"} as const;
  }

  try {
    if ((await ports.logoutWithReadCleanup({minuten,entwurfGesichert:entwurfId!==null})).ok!==true) {
      return {code:"ABMELDUNG_UNKLAR",entwurfId} as const;
    }
  } catch {
    return {code:"ABMELDUNG_UNKLAR",entwurfId} as const;
  }
  return {code:"ABGEMELDET",minuten,entwurfId} as const;
}
