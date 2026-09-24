"use client";

import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { SessionWarningBanner } from "./SessionWarningBanner";
import { MockAppFrame } from "./MockAppFrame";
import { EntityOverlayStack } from "./EntityOverlayStack";
import styles from "./TargetShell.module.css";

export function KreileAppShell({ children, globalCreate }: { children: React.ReactNode; globalCreate?: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, status } = usePermissions();
  const loginOnly = pathname === "/start" || pathname === "/login";
  const sessionInvalid = !loading && status !== "authenticated";

  if (loginOnly) return <div className={styles.loginRoot}>{children}</div>;

  return (
    <>
      <SessionWarningBanner show={sessionInvalid} />
      <MockAppFrame>{children}</MockAppFrame>
      <EntityOverlayStack />
      {globalCreate}
    </>
  );
}
