import { getKraftstoffTankungenAction } from "@/app/buchhaltung/actions";
import { BelegDetail } from "@/lib/buchhaltung/types";
import { KraftstoffClient } from "./KraftstoffClient";

export const dynamic = "force-dynamic";

export default async function KraftstoffPage() {
  const tankungen = await getKraftstoffTankungenAction() as BelegDetail[];

  const missingDetailCount = tankungen.filter((entry) => !entry.kraftstoffDetail).length;
  const missingLiterCount = tankungen.filter((entry) => entry.kraftstoffDetail?.liter === undefined).length;
  const missingAmountCount = tankungen.filter((entry) => entry.brutto === undefined).length;
  const unresolvedCount = tankungen.filter((entry) => (
    !entry.kraftstoffDetail
    || entry.kraftstoffDetail.liter === undefined
    || entry.brutto === undefined
  )).length;
  const gesamtLiter = tankungen.reduce((sum, entry) => (
    entry.kraftstoffDetail?.liter === undefined ? sum : sum + entry.kraftstoffDetail.liter
  ), 0);
  const gesamtKosten = tankungen.reduce((sum, entry) => (
    entry.brutto === undefined ? sum : sum + entry.brutto
  ), 0);

  return (
    <KraftstoffClient
      initialTankungen={tankungen}
      gesamtLiter={gesamtLiter}
      gesamtKosten={gesamtKosten}
      missingDetailCount={missingDetailCount}
      missingLiterCount={missingLiterCount}
      missingAmountCount={missingAmountCount}
      unresolvedCount={unresolvedCount}
    />
  );
}
