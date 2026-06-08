import { SupabaseClient } from '@supabase/supabase-js';

export async function getKostensatz(
  supabase: SupabaseClient,
  employeeId: string,
  stationKuerzel: string,
  tenantId: string
): Promise<{ kostensatz: number | null; quelle: 'mitarbeiter' | 'station_default' | null }> {
  // Query app_users
  const { data: userData, error: userError } = await supabase
    .from('app_users')
    .select('kostensatz_eur_pro_stunde')
    .eq('id', employeeId)
    .single();

  if (!userError && userData?.kostensatz_eur_pro_stunde != null) {
    return { kostensatz: Number(userData.kostensatz_eur_pro_stunde), quelle: 'mitarbeiter' };
  }

  // Query kostensatz_default
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: defaultData, error: defaultError } = await supabase
    .from('kostensatz_default')
    .select('eur_pro_stunde')
    .eq('tenant_id', tenantId)
    .eq('station_kuerzel', stationKuerzel)
    .lte('gilt_ab', todayStr)
    .order('gilt_ab', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!defaultError && defaultData?.eur_pro_stunde != null) {
    return { kostensatz: Number(defaultData.eur_pro_stunde), quelle: 'station_default' };
  }

  return { kostensatz: null, quelle: null };
}

export async function getEinkaufspreis(
  supabase: SupabaseClient,
  inventoryItemId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('einkaufspreis_eur')
    .eq('id', inventoryItemId)
    .single();

  if (!error && data?.einkaufspreis_eur != null) {
    return Number(data.einkaufspreis_eur);
  }

  return null;
}
