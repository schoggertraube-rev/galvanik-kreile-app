import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Playfair_Display, Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
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

import { isAdminOrDeveloper } from "@/lib/auth/permissions";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminOrDeveloper();

  return (
    <html
      lang="de"
      className={`${playfair.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <Suspense fallback={null}>
        <TestpilotProvider isAdmin={isAdmin}>
          <SyncProvider>
            <PermissionsProvider>
              <DiagnosticsProvider>
                <LicenseProvider>
                  <AppShortcutProvider>
                    <KreileAppShell>
                      {children}
                    </KreileAppShell>
                  </AppShortcutProvider>
                </LicenseProvider>
                <DiagnosticsWidget />
                <TestpilotFloatingButton />
              </DiagnosticsProvider>
            </PermissionsProvider>
          </SyncProvider>
        </TestpilotProvider>
        </Suspense>
      </body>
    </html>
  );
}
