"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";
import type {
  AktionVorschlag,
  FunnelDaten,
  Kampagne as MarketingKampagne,
  LernInsight,
  Segment as MarketingSegment,
  SortMode,
  StoryIdee,
  WirkungMini,
} from "@/lib/marketing/marketingTypes";

/**
 * The former implementation seeded browser-visible marketing demos. Public
 * signatures stay available for future contract work, but no marketing data
 * or mutation is executable before consent, ownership and evidence are
 * proven.
 */
export async function getBesteAktionAction(): Promise<AktionVorschlag | null> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}

export async function listVorschlaegeAction(sort: SortMode = "output"): Promise<AktionVorschlag[]> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  void sort;
  return foundationUnavailableAction("Marketing");
}

export async function getKampagnenAction(): Promise<MarketingKampagne[]> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}

export async function getSegmenteAction(): Promise<MarketingSegment[]> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}

export async function getLernInsightsAction(): Promise<LernInsight[]> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}

export async function getWirkungMiniAction(): Promise<WirkungMini[]> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}

export async function getFunnelAction(): Promise<FunnelDaten> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}

export async function getStoryIdeenAction(): Promise<StoryIdee[]> {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return foundationUnavailableAction("Marketing");
}
