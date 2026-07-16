import { getFinanceSettingsAction } from "@/app/buchhaltung/einstellungen/actions";
import { EinstellungenClient } from "@/app/buchhaltung/einstellungen/EinstellungenClient";

export default async function EinstellungenPage() {
  const settings = await getFinanceSettingsAction();
  return <EinstellungenClient initialSettings={settings} />;
}
