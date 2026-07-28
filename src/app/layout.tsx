import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
import { LicenseProvider } from "@/lib/license/LicenseContext";
import { DiagnosticsProvider } from "@/lib/diagnostics/DiagnosticsContext";
import { DiagnosticsWidget } from "@/components/diagnostics/DiagnosticsWidget";
import { TestpilotProvider } from "@/components/testpilot/TestpilotProvider";
import { TestpilotFloatingButton } from "@/components/testpilot/TestpilotFloatingButton";
import { PermissionsProvider } from "@/lib/auth/PermissionsContext";
import { AppShortcutProvider } from "@/components/ui/AppShortcutContext";
import { SyncProvider } from "@/lib/offline/SyncContext";
import { FeatureFlagProvider } from "@/lib/analytics/useFeatureFlag";
import { OrderModalProvider } from "@/components/orders/OrderModalProvider";
import { ErfassungProvider } from "@/components/erfassung/ErfassungProvider";

import { isAdminOrDeveloper } from "@/lib/auth/permissions";
import { getAuthBootstrapState } from "@/lib/server/authBootstrap";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminOrDeveloper();
  const authState = await getAuthBootstrapState();
  const showInternalTools = process.env.NODE_ENV !== "production";

  return (
    <html
      lang="de"
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <Suspense fallback={null}>
        <TestpilotProvider isAdmin={isAdmin}>
          <SyncProvider>
            <PermissionsProvider initialAuthState={authState}>
              <DiagnosticsProvider>
                <LicenseProvider>
                  <AppShortcutProvider>
                    <FeatureFlagProvider>
                      <OrderModalProvider>
                        <ErfassungProvider>
                          <KreileAppShell>
                            {children}
                          </KreileAppShell>
                        </ErfassungProvider>
                      </OrderModalProvider>
                    </FeatureFlagProvider>
                  </AppShortcutProvider>
                </LicenseProvider>
                {showInternalTools && <DiagnosticsWidget />}
                {showInternalTools && <TestpilotFloatingButton />}
              </DiagnosticsProvider>
            </PermissionsProvider>
          </SyncProvider>
        </TestpilotProvider>
        </Suspense>
      </body>
    </html>
  );
}
