import React from "react";
import MarketingStudioClient from "./MarketingStudioClient";

import {
  getBesteAktionAction,
  listVorschlaegeAction,
  getKampagnenAction,
  getFunnelAction,
  getSegmenteAction,
  getLernInsightsAction,
  getWirkungMiniAction,
  getStoryIdeenAction
} from "@/app/marketing/marketing.actions";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [
    besteAktion,
    vorschlaege,
    kampagnen,
    funnel,
    segmente,
    insights,
    wirkungMini,
    storyIdeen
  ] = await Promise.all([
    getBesteAktionAction(),
    listVorschlaegeAction(),
    getKampagnenAction(),
    getFunnelAction(),
    getSegmenteAction(),
    getLernInsightsAction(),
    getWirkungMiniAction(),
    getStoryIdeenAction(),
  ]);

  return (
    <MarketingStudioClient
      initialBesteAktion={besteAktion}
      initialVorschlaege={vorschlaege}
      initialKampagnen={kampagnen}
      initialFunnel={funnel}
      initialSegmente={segmente}
      initialInsights={insights}
      initialWirkungMini={wirkungMini}
      initialStoryIdeen={storyIdeen}
    />
  );
}
