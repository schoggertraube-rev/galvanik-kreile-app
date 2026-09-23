"use client";

import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { SessionWarningBanner } from "./SessionWarningBanner";
import { TargetHeader } from "./TargetHeader";
import { TargetNavigation } from "./TargetNavigation";
import { MobileBottomNav } from "./MobileBottomNav";
import { EntityOverlayStack } from "./EntityOverlayStack";
import styles from "./TargetShell.module.css";

export function KreileAppShell({ children, globalCreate }: { children: React.ReactNode; globalCreate?: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, role, status } = usePermissions();
  const loginOnly = pathname === "/start" || pathname === "/login";
  const workshop = role === "werkstatt";
  const sessionInvalid = !loading && status !== "authenticated";

  if (loginOnly) return <div className={styles.loginRoot}>{children}</div>;

  return (
    <div className={`${styles.shell} ${workshop ? styles.workshop : ""}`}>
      <SessionWarningBanner show={sessionInvalid} />
      <TargetHeader compact={workshop} />
      <div className={styles.body}>
        <TargetNavigation />
        <main className={styles.content}><div className={styles.page}>{children}</div></main>
      </div>
      <MobileBottomNav />
      <EntityOverlayStack />
      {globalCreate}
    </div>
  );
}
