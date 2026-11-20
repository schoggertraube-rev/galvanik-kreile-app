import type { Metadata, Viewport } from "next";
import { Suspense, type CSSProperties } from "react";
import { fraunces, geistMono, inter } from "./fonts/localFonts";
import "./globals.css";
import {readRootStyle} from '@/ui/vorfinalStyle';

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
import {OfflineLogoutNotice} from '@/components/OfflineLogoutNotice';
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ClientActionErrorBanner } from "@/components/layout/ClientActionErrorBanner";
import {ProtocolClickCapture} from '@/components/ProtocolClickCapture';

import { getAuthBootstrapAction } from "@/app/actions/auth.actions";
import { GlobalCreateAppAdapter } from "./GlobalCreateAppAdapter";
import {withPageReadBudget} from '@/db/readBudget';
import {DEFAULT_PAGE_READ_SETTINGS} from '@/db/readBudget';
import {PAGE_READ_COPY} from '@/ui/situationCatalog';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authState = await withPageReadBudget(getAuthBootstrapAction,DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
  const rootStyle=readRootStyle(authState.status,authState.status==='authenticated'?authState.user.packageSwitches:undefined);
  const isAdmin =
    authState.status === "authenticated" &&
    authState.user.permissions.includes("perm_sys_diag");

  return (
    <html
      lang="de"
      data-ui={rootStyle.dataUi}
      data-auth-status={authState.status}
      data-offline-scope={authState.status==='authenticated'?authState.user.offlineScope:undefined}
      data-offline-login-scope={authState.status==='authenticated'?authState.user.offlineLoginScope:undefined}
      data-offline-24h={authState.status==='authenticated'&&authState.user.offline24h===true?'enabled':'disabled'}
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
      style={{ "--sans": inter.style.fontFamily, "--serif": fraunces.style.fontFamily } as CSSProperties}
    >
      <head><style data-kreile-style={rootStyle.enabled?'vorfinal-v10':'legacy'} dangerouslySetInnerHTML={{__html:rootStyle.css}} /></head>
      <body className="h-full">
        <ServiceWorkerRegister />
        <OfflineLogoutNotice />
        <ClientActionErrorBanner />
        <Suspense fallback={null}>
          <PermissionsProvider initialAuthState={authState}>
            <SyncProvider>
              <ProtocolClickCapture />
              <DiagnosticsProvider>
                <FeatureFlagProvider offline24hEnabled={authState.status === 'authenticated' && authState.user.offline24h === true}>
                  <KreileAppShell vorfinalStyle={rootStyle.enabled} loginHandle={authState.status==='authenticated'?authState.user.loginHandle:undefined} globalCreate={<GlobalCreateAppAdapter />}>
                    <Suspense fallback={<p role="status">{PAGE_READ_COPY.loading}</p>}>{children}</Suspense>
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
