"use client";

import { OrderIntakePanel } from "@/components/erfassung/OrderIntakePanel";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";

export function ManualWizard() {
  const { closeErfassung, setIsDirty } = useErfassung();
  return <OrderIntakePanel onClose={closeErfassung} setCloseBlocked={setIsDirty} />;
}
