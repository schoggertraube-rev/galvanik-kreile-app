import type { Metadata, Viewport } from "next";
import { Suspense, type CSSProperties } from "react";
import { fraunces, geistMono, inter } from "./fonts/localFonts";
import "./globals.css";
import "../../docs/project/endversion/ui/endversion_design.css";

export const viewport: Viewport = {
  themeColor: "#091223",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "KREILE WerkstattCockpit",
  description: "Mobiles PWA-Betriebssystem für die Galvanik Kreile Werkstatt",
  applicationName: "Kreile Cockpit",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Kreile Cockpit",
    statusBarStyle: "black-translucent"
  }
};

import { KreileAppShell } from "@/components/layout/KreileAppShell";
import { DiagnosticsProvider } from "@/lib/diagnostics/DiagnosticsContext";
import { DiagnosticsWidget } from "@/components/diagnostics/DiagnosticsWidget";
import { PermissionsProvider } from "@/lib/auth/PermissionsContext";
import { SyncProvider } from "@/lib/offline/SyncContext";
import { FeatureFlagProvider } from "@/lib/analytics/useFeatureFlag";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ClientActionErrorBanner } from "@/components/layout/ClientActionErrorBanner";

import { getAuthBootstrapState } from "@/lib/server/authBootstrap";
import { GlobalCreateAppAdapter } from "./GlobalCreateAppAdapter";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authState = await getAuthBootstrapState();
  const isAdmin =
    authState.status === "authenticated" &&
    authState.user.permissions.includes("perm_sys_diag");

  return (
    <html
      lang="de"
      data-auth-status={authState.status}
      data-offline-scope={authState.status==='authenticated'?authState.user.offlineScope:undefined}
      data-offline-login-scope={authState.status==='authenticated'?authState.user.offlineLoginScope:undefined}
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
      style={{ "--sans": inter.style.fontFamily, "--serif": fraunces.style.fontFamily } as CSSProperties}
    >
      <body className="h-full">
        <ServiceWorkerRegister />
        <ClientActionErrorBanner />
        <Suspense fallback={null}>
          <PermissionsProvider initialAuthState={authState}>
            <SyncProvider>
              <DiagnosticsProvider>
                <FeatureFlagProvider>
                  <KreileAppShell loginHandle={authState.status==='authenticated'?authState.user.loginHandle:undefined} globalCreate={<GlobalCreateAppAdapter />}>
                    {children}
                  </KreileAppShell>
                </FeatureFlagProvider>
                {isAdmin && <DiagnosticsWidget />}
              </DiagnosticsProvider>
            </SyncProvider>
          </PermissionsProvider>
        </Suspense>
      </body>
    </html>
  );
}
