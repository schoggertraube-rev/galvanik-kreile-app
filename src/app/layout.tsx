import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "KREILE WerkstattCockpit",
  description: "Mobiles PWA-Betriebssystem für die Galvanik Kreile Werkstatt",
  appleWebApp: {
    capable: true,
    title: "Kreile Cockpit",
    statusBarStyle: "black-translucent"
  }
};

import { KreileAppShell } from "@/components/layout/KreileAppShell";
import { LicenseProvider } from "@/lib/license/LicenseContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${playfair.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        {/* DEBUG SCRIPT ZUR FEHLERSUCHE AUF DEM TABLET */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.onerror = function(msg, url, line, col, error) {
            alert("JS Error: " + msg + " (Line: " + line + ")");
            return false;
          };
          window.addEventListener('unhandledrejection', function(event) {
            alert("Promise Error: " + (event.reason && event.reason.message ? event.reason.message : event.reason));
          });
        ` }} />
        <LicenseProvider>
          <KreileAppShell>
            {children}
          </KreileAppShell>
        </LicenseProvider>
      </body>
    </html>
  );
}
