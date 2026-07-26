export type OrderMarketingTouchpointRow = {
  id: string;
  actionId: string | null;
  channelId: string | null;
  actionTruthStatus: string | null;
  actionIsDemo: boolean | null;
  channelTruthStatus: string | null;
  channelName: string | null;
  channelType: string | null;
  utmSource: string | null;
  title: string | null;
};

export type VerifiedOrderMarketingTouchpoint = {
  id: string;
  channel: string;
  title: string | null;
};

/**
 * Rejects the complete connection when an attached action or channel did not
 * survive the verified-source joins. Raw UTM evidence remains usable only for
 * touchpoints that do not claim an unverified canonical source record.
 */
export function projectVerifiedOrderMarketingTouchpoint(
  row: OrderMarketingTouchpointRow,
): VerifiedOrderMarketingTouchpoint | null {
  if (
    row.actionId !== null
    && (row.actionTruthStatus !== "verified" || row.actionIsDemo !== false)
  ) {
    return null;
  }
  if (row.channelId !== null && row.channelTruthStatus !== "verified") {
    return null;
  }

  return {
    id: row.id,
    channel: row.channelName ?? row.channelType ?? row.utmSource ?? "Unbekannter Kanal",
    title: row.title,
  };
}
