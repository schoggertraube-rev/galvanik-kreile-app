import { Suspense } from "react";
import { TelefonnotizDesktop } from "@/components/telefonnotiz/TelefonnotizDesktop";

export const metadata = {
  title: "Telefonnotiz · WerkstattCockpit",
  description: "Telefonat aufnehmen, automatisch Kunde, Auftrag und Termin erkennen, verteilen.",
};

export default function TelefonnotizPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#FAF6EE", display: "grid", placeItems: "center", fontFamily: "'Manrope', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 34, height: 34, background: "#C2410C", borderRadius: 8, display: "grid", placeItems: "center", color: "white", margin: "0 auto 12px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1B1B1B" }}>Telefonnotiz wird geladen…</div>
        </div>
      </div>
    }>
      <TelefonnotizDesktop />
    </Suspense>
  );
}
