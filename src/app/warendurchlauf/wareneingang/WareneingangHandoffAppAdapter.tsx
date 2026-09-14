"use client";

import { transitionWareneingangToGalvanikAction } from "@/app/actions/orders.actions";
import {
  getGalvanikOrdersAction,
  getOrderStationReceiptAction,
  getWareneingangOrdersAction,
} from "@/app/warendurchlauf/actions";
import {
  WareneingangHandoffButton,
  type WareneingangHandoffButtonProps,
  type WareneingangHandoffPorts,
} from "@/modules/orders/public";

const ports: WareneingangHandoffPorts = {
  transition: transitionWareneingangToGalvanikAction,
  readSource: getWareneingangOrdersAction,
  readTarget: getGalvanikOrdersAction,
  readReceipt: getOrderStationReceiptAction,
};

type Props = Omit<WareneingangHandoffButtonProps, "ports">;

export function WareneingangHandoffAppAdapter(props: Props) {
  return <WareneingangHandoffButton {...props} ports={ports} />;
}
