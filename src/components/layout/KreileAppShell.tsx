"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderOverlay } from "@/components/orders/OrderOverlay";
import { CustomerOverlay } from "@/components/customers/CustomerOverlay";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import { SessionWarningBanner } from "./SessionWarningBanner";
import { KreileHeader } from "./KreileHeader";
import { TargetNavigation } from "./TargetNavigation";
import { MobileBottomNav } from "./MobileBottomNav";
import { usePermissions } from "@/lib/auth/PermissionsContext";

export function KreileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const isStartScreen = pathname === "/start" || pathname === "/login";
  const isWorkshop = role === "werkstatt";

  useEffect(() => {
    if (isStartScreen) return;
    getAuthorizationSnapshotAction()
      .then((result) => setIsSessionExpired(!result.ok))
      .catch(() => setIsSessionExpired(true));
  }, [isStartScreen, pathname]);

  if (isStartScreen) {
    return <div className="min-h-screen bg-bg-app text-navy-900 antialiased">{children}</div>;
  }

  return (
    <div className={`target-shell ${isWorkshop ? "target-shell--workshop" : ""}`}>
      <SessionWarningBanner show={isSessionExpired} />
      <KreileHeader />
      <div className="target-shell__body">
        {!isWorkshop && <TargetNavigation />}
        <main className="target-shell__content">
          <div className="target-shell__page">{children}</div>
        </main>
      </div>
      {!isWorkshop && <MobileBottomNav className="target-mobile-dock" />}
      <OrderOverlay />
      <CustomerOverlay />
    </div>
  );
}
