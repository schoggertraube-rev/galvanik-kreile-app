"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { getGreeting } from "@/lib/greeting";

const DEMO_USERS = [
  {
    id: "1",
    initials: "MK",
    pin: "1234",
    iconPath: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    id: "2",
    initials: "CD",
    pin: "1234",
    iconPath: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    id: "3",
    initials: "RS",
    pin: "1234",
    iconPath: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
];

// Frankfurt Skyline SVG — goldener Linienzeichenstil wie im Referenzbild
function FrankfurtSkyline() {
  return (
    <svg
      viewBox="0 0 560 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-[360px] md:w-[480px] opacity-90"
    >
      <g stroke="#A87922" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Skyline Silhouette */}
        <polyline points="
          0,120 0,90 15,90 15,80 25,80 25,70 30,70 30,75 35,75 35,65 40,65 40,75 45,75 45,60 50,60 50,75 55,75 55,68 60,68 60,75 65,75 65,40 67,40 67,10 69,10 69,40 71,40 71,75 75,75 75,65 80,65 80,58 85,58 85,65 90,65 90,55 95,55 95,65 100,65 100,60 105,60 105,65 110,65 110,45 112,45 112,5 114,5 114,45 116,45 116,65 120,65 120,55 125,55 125,65 130,65 130,58 135,58 135,65 140,65 140,70 150,70 150,65 155,65 155,75 160,75 160,62 165,62 165,75 170,75 170,68 175,68 175,75 180,75 180,55 185,55 185,75 190,75 190,70 200,70 200,75 210,75 210,65 215,65 215,75 220,75 220,68 230,68 230,75 240,75 240,60 245,60 245,75 255,75 255,68 260,68 260,75 270,75 270,55 272,55 272,25 274,25 274,55 276,55 276,75 280,75 280,65 290,65 290,75 300,75 300,70 310,70 310,75 320,75 320,65 325,65 325,75 335,75 335,60 340,60 340,75 350,75 350,68 360,68 360,75 370,75 370,80 380,80 380,75 390,75 390,70 400,70 400,75 410,75 410,80 420,80 420,90 430,90 430,85 440,85 440,90 450,90 450,85 460,85 460,90 470,90 470,95 480,95 480,90 490,90 490,95 500,95 500,90 510,90 510,95 520,95 520,100 540,100 540,105 560,105 560,120
        "/>
        {/* Fenster/Details an markanten Gebäuden */}
        <rect x="65.5" y="15" width="2" height="3" />
        <rect x="65.5" y="20" width="2" height="3" />
        <rect x="110.5" y="10" width="2" height="3" />
        <rect x="110.5" y="16" width="2" height="3" />
        <rect x="271.5" y="30" width="2" height="3" />
        <rect x="271.5" y="36" width="2" height="3" />
        {/* Fernsehturm-Spitze */}
        <line x1="67" y1="5" x2="67" y2="0" />
        <line x1="112" y1="5" x2="112" y2="1" />
        <line x1="272" y1="20" x2="272" y2="15" />
        <circle cx="272" cy="14" r="2" fill="#A87922" stroke="none" />
        {/* Brücken-Bogenlinie unten */}
        <path d="M0,112 Q140,95 280,112 Q420,128 560,112" strokeDasharray="4,4" opacity="0.4" />
      </g>
    </svg>
  );
}

// Wetterkarte wie im Bild — weißes Panel oben rechts
function WeatherCard() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="absolute top-6 right-6 w-[260px] bg-white rounded-2xl shadow-lg border border-kreile-border p-4 animate-in fade-in slide-in-from-top-3 duration-500 delay-500 fill-mode-both">
      <div className="flex gap-3 items-start">
        {/* Sonne Icon */}
        <div className="shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#F28A0C" strokeWidth="2" strokeLinecap="round" className="w-7 h-7">
            <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
            <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
            <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
            <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
          </svg>
        </div>
        <p className="text-sm leading-relaxed text-kreile-navy">
          Heute: <strong>20°C</strong> und noch{" "}
          <strong className="text-kreile-accent">4 Stunden hell</strong> – perfekte Bedingungen, um nach Feierabend noch kurz an den Main zu gehen. 🍺
        </p>
      </div>
      <div className="flex justify-end items-center gap-1.5 mt-2">
        <span className="text-[11px] text-kreile-muted font-mono">{timeStr}</span>
        {/* Double-Check Icon */}
        <svg viewBox="0 0 16 10" fill="none" className="w-4 h-3">
          <path d="M1 5l3 4L13 1" stroke="#4F8A2D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 5l3 4L16 1" stroke="#4F8A2D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

// PIN Dialog
function PinDialog({ initials, onClose }: { initials: string; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleInput = (num: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    setError(false);
    if (newPin.length === 4) {
      if (newPin === "1234") {
        router.push("/");
      } else {
        setError(true);
        setTimeout(() => setPin(""), 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl border border-kreile-border w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-kreile-bg px-6 py-5 border-b border-kreile-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-kreile-sand flex items-center justify-center font-black text-kreile-gold-muted text-lg">
              {initials}
            </div>
            <div>
              <p className="font-bold text-kreile-navy text-sm">Entsperren</p>
              <p className="text-[10px] text-kreile-muted uppercase tracking-wider">PIN eingeben</p>
            </div>
          </div>
          <button onClick={onClose} className="text-kreile-muted hover:text-kreile-navy text-xl leading-none">×</button>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-4 py-7">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              pin.length > i ? (error ? "bg-status-red scale-110" : "bg-kreile-navy scale-110") : "bg-kreile-border"
            }`} />
          ))}
        </div>
        {error && <p className="text-center text-status-red text-xs font-semibold -mt-4 mb-3">Falscher PIN</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 px-5 pb-5">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleInput(String(n))}
              className="h-14 rounded-2xl bg-kreile-bg hover:bg-kreile-sand text-2xl font-bold text-kreile-navy transition-all active:scale-95">
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => handleInput("0")}
            className="h-14 rounded-2xl bg-kreile-bg hover:bg-kreile-sand text-2xl font-bold text-kreile-navy transition-all active:scale-95">
            0
          </button>
          <button onClick={() => setPin(p => p.slice(0, -1))}
            className="h-14 rounded-2xl flex items-center justify-center text-kreile-muted hover:text-kreile-navy transition-colors active:scale-95">
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StartScreen() {
  const [greeting, setGreeting] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; initials: string } | null>(null);

  useEffect(() => {
    setGreeting(getGreeting());
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen bg-kreile-bg flex flex-col items-center justify-center p-6 overflow-hidden">

      {/* Wetterkarte oben rechts */}
      <WeatherCard />

      {/* Logo Block */}
      <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both">
        {/* Skyline Grafik */}
        <div className="mb-3">
          <FrankfurtSkyline />
        </div>

        {/* Großer Serifenschriftzug */}
        <h1 className="font-serif text-[72px] md:text-[88px] font-black tracking-[0.04em] text-kreile-navy leading-none mb-2">
          KREILE
        </h1>

        {/* Galvanik · Veredlung — mit Goldfarbe und Interpunkten */}
        <p className="text-[15px] font-semibold tracking-[0.25em] text-kreile-navy uppercase mb-2">
          Galvanik · Veredlung
        </p>

        {/* Dekorative Linie + Meisterbetrieb */}
        <div className="flex items-center gap-3 text-kreile-gold-muted">
          <div className="h-px w-10 bg-kreile-gold-muted/50" />
          <span className="text-[11px] font-bold tracking-[0.3em] uppercase">Meisterbetrieb seit 1962</span>
          <div className="h-px w-10 bg-kreile-gold-muted/50" />
        </div>
      </div>

      {/* Begrüßung */}
      <div className="flex items-center gap-3.5 mb-7 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
        <span className="text-3xl">👋</span>
        <h2 className="text-3xl md:text-4xl font-serif font-black text-kreile-navy tracking-tight">{greeting}</h2>
      </div>

      {/* Prioritätskarte / Nächste Aufgabe - Premium beiger Look mit Uhr */}
      <div className="w-full max-w-xl mb-9 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-both">
        <div className="bg-[#FFFDFB] rounded-[24px] border border-[#F5EAD9] shadow-sm px-6 py-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#A87922]/40 flex items-center justify-center shrink-0 bg-[#FFF6EA]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#A87922" strokeWidth="2.2" strokeLinecap="round" className="w-6 h-6">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <p className="font-extrabold text-kreile-navy text-sm md:text-base leading-snug">
                Zuerst steht an: 3 Teile in den Versand bringen.
              </p>
              <p className="text-xs md:text-sm text-kreile-muted mt-1 leading-relaxed">
                Wenn das bis <span className="text-kreile-accent font-black">11:30 Uhr</span> erledigt ist, bleibt der Nachmittag entspannt.
              </p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#A87922" strokeWidth="2.5" strokeLinecap="round" className="w-5 h-5 shrink-0 ml-2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* User-Kacheln - Premium Abmessungen und Radien */}
      <div className="flex gap-5 md:gap-7 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both">
        {DEMO_USERS.map((user) => (
          <button
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="w-[160px] md:w-[190px] aspect-square bg-white rounded-[32px] border border-kreile-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-5 p-6 group cursor-pointer"
          >
            {/* Großer runder beiger Avatar */}
            <div className="w-20 h-20 rounded-full bg-kreile-sand flex items-center justify-center shadow-inner">
              <span className="font-serif font-black text-2xl text-kreile-gold-muted tracking-tight">
                {user.initials}
              </span>
            </div>
            {/* Icon darunter in Gold */}
            <div className="text-kreile-gold-muted group-hover:text-kreile-accent transition-colors duration-200">
              {user.iconPath}
            </div>
          </button>
        ))}
      </div>

      {selectedUser && (
        <PinDialog initials={selectedUser.initials} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
