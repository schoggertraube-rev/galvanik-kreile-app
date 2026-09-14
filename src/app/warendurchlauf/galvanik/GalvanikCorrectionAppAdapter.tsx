"use client";

import { correctGalvanikToWareneingangAction } from "@/app/actions/orders.actions";
import {
  getGalvanikOrdersAction,
  getOrderStationCorrectionReceiptAction,
  getWareneingangOrdersAction,
} from "@/app/warendurchlauf/actions";
import {
  GalvanikCorrectionButton,
  type GalvanikCorrectionButtonProps,
  type GalvanikCorrectionPorts,
} from "@/modules/orders/public";

const ports: GalvanikCorrectionPorts = {
  correct: correctGalvanikToWareneingangAction,
  readSource: getWareneingangOrdersAction,
  readTarget: getGalvanikOrdersAction,
  readReceipt: getOrderStationCorrectionReceiptAction,
};

type Props = Omit<GalvanikCorrectionButtonProps, "ports">;

export function GalvanikCorrectionAppAdapter(props: Props) {
  return <GalvanikCorrectionButton {...props} ports={ports} />;
}
