"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { SessionWarningBanner } from "./SessionWarningBanner";
import { TargetHeader } from "./TargetHeader";
import { TargetNavigation } from "./TargetNavigation";
import { MobileBottomNav } from "./MobileBottomNav";
import { EntityOverlayStack } from "./EntityOverlayStack";
import styles from "./TargetShell.module.css";

export function KreileAppShell({ children, globalCreate }: { children: React.ReactNode; globalCreate?: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const loginOnly = pathname === "/start" || pathname === "/login";
  const workshop = role === "werkstatt";

  useEffect(() => {
    if (loginOnly) return;
    let active = true;
    void getAuthorizationSnapshotAction()
      .then((result) => { if (active) setSessionInvalid(!result.ok); })
      .catch(() => { if (active) setSessionInvalid(true); });
    return () => { active = false; };
  }, [loginOnly, pathname]);

  if (loginOnly) return <div className={styles.loginRoot}>{children}</div>;

  return (
    <div className={`${styles.shell} ${workshop ? styles.workshop : ""}`}>
      <SessionWarningBanner show={sessionInvalid} />
      <TargetHeader compact={workshop} />
      <div className={styles.body}>
        {!workshop ? <TargetNavigation /> : null}
        <main className={styles.content}><div className={styles.page}>{children}</div></main>
      </div>
      {!workshop ? <MobileBottomNav /> : null}
      <EntityOverlayStack />
      {globalCreate}
    </div>
  );
}
