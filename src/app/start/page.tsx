"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Delete, Clock, Wrench, Calculator, Sun, CloudRain, Cloud, ShieldAlert } from "lucide-react";
import { getGreeting } from "@/lib/greeting";

const DEMO_USERS = [
  {
    id: "1",
    initials: "MK",
    role: "Meister",
    pin: "1234",
    icon: Wrench,
  },
  {
    id: "2",
    initials: "CD",
    role: "Werkstatt",
    pin: "1234",
    icon: Wrench,
  },
  {
    id: "3",
    initials: "RS",
    role: "Büro",
    pin: "1234",
    icon: Calculator,
  },
];

// Asynchronous weather card fetching directly from Open-Meteo
function WeatherCard() {
  const [weatherText, setWeatherText] = useState("");
  const [temperature, setTemperature] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const timeStr = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Fetch Frankfurt am Main weather
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=50.1109&longitude=8.6821&current_weather=true"
        );
        const data = await res.json();
        const temp = data?.current_weather?.temperature;
        const code = data?.current_weather?.weathercode;
        setTemperature(Math.round(temp));

        // Formulate a beautiful greeting string based on weather codes
        let condition = "perfekte Bedingungen, um nach Feierabend noch kurz an den Main zu gehen. 🍺";
        if (code >= 51 && code <= 67) {
          condition = "Draußen Schmuddel – guter Tag, drinnen ein paar liegengebliebene Aufträge abzuhaken. ☕";
        } else if (code >= 71 && code <= 86) {
          condition = "Es schneit über Mainhattan! Perfekt eingepackt geht es ans Werk. ❄️";
        } else if (temp < 12) {
          condition = "Etwas frisch heute – die Galvanikbäder wärmen uns auf! ☕";
        }
        
        // Simulating the 600ms skeleton requirement
        setTimeout(() => {
          setWeatherText(condition);
          setLoading(false);
        }, 600);
      } catch (err) {
        setTimeout(() => {
          setWeatherText("Heute mal kein Wetter — aber bestimmt was zu tun. 💪");
          setLoading(false);
        }, 600);
      }
    };
    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className="absolute top-6 right-6 w-[320px] bg-white rounded-2xl border border-neutral-gray-100 p-5 shadow-card animate-pulse">
        <div className="flex gap-4">
          <div className="w-8 h-8 bg-neutral-gray-100 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-neutral-gray-100 rounded w-3/4" />
            <div className="h-4 bg-neutral-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-6 right-6 w-[320px] bg-white rounded-2xl border border-neutral-gray-100 p-5 shadow-card animate-in fade-in duration-300">
      <div className="flex gap-3.5 items-start">
        <div className="shrink-0 mt-0.5">
          <Sun className="w-7 h-7 text-accent-orange" strokeWidth={1.5} />
        </div>
        <div className="text-sm leading-relaxed text-navy-900 font-medium">
          Heute: <strong>{temperature !== null ? `${temperature}°C` : "20°C"}</strong> und noch {weatherText}
        </div>
      </div>
      <div className="flex justify-end items-center gap-1.5 mt-3">
        <span className="text-[11px] text-text-muted font-mono">{timeStr}</span>
        <svg viewBox="0 0 16 10" fill="none" className="w-4 h-3">
          <path d="M1 5l3 4L13 1" stroke="#5A8F4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 5l3 4L16 1" stroke="#5A8F4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

// PIN Dialog Component
function PinDialog({ user, onClose }: { user: typeof DEMO_USERS[0]; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleInput = (num: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    setError(false);
    
    if (newPin.length === 4) {
      if (newPin === user.pin) {
        // Store current user in localStorage for application state
        localStorage.setItem("kreile_user_role", user.role);
        localStorage.setItem("kreile_user_initials", user.initials);
        router.push("/");
      } else {
        setError(true);
        setTimeout(() => setPin(""), 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-elevated border border-neutral-gray-100 w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-bg-app-soft px-6 py-5 border-b border-neutral-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center font-bold text-gold-600 text-lg">
              {user.initials}
            </div>
            <div>
              <p className="font-bold text-navy-900 text-sm">Entsperren</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">PIN eingeben</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-navy-900 text-2xl leading-none cursor-pointer">×</button>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-4 py-7">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                pin.length > i ? (error ? "bg-danger-red scale-110" : "bg-navy-900 scale-110") : "bg-neutral-gray-100"
              }`}
            />
          ))}
        </div>
        {error && <p className="text-center text-danger-red text-xs font-semibold -mt-4 mb-3">Falscher PIN</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 px-5 pb-5">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button
              key={n}
              onClick={() => handleInput(String(n))}
              className="h-14 rounded-2xl bg-bg-app-soft hover:bg-neutral-gray-100 text-2xl font-bold text-navy-900 transition-all active:scale-95 cursor-pointer"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleInput("0")}
            className="h-14 rounded-2xl bg-bg-app-soft hover:bg-neutral-gray-100 text-2xl font-bold text-navy-900 transition-all active:scale-95 cursor-pointer"
          >
            0
          </button>
          <button
            onClick={() => setPin(p => p.slice(0, -1))}
            className="h-14 rounded-2xl flex items-center justify-center text-text-muted hover:text-navy-900 transition-colors active:scale-95 cursor-pointer"
          >
            <Delete className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StartScreen() {
  const [selectedUser, setSelectedUser] = useState<typeof DEMO_USERS[0] | null>(null);
  const [greetingInfo, setGreetingInfo] = useState({ text: "Guten Morgen, Meister!", emoji: "👋" });

  useEffect(() => {
    const updateGreeting = () => {
      setGreetingInfo(getGreeting(new Date(), "Meister"));
    };
    updateGreeting();
    const id = setInterval(updateGreeting, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen bg-bg-app flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Wetterkarte oben rechts */}
      <WeatherCard />

      {/* Skyline Logo wordmark block */}
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both">
        <img
          src="/assets/logo/kreile-wordmark-skyline.svg"
          alt="Kreile Wortmarke Skyline"
          className="w-[360px] md:w-[480px] h-auto object-contain"
        />
      </div>

      {/* Begrüßung */}
      <div className="flex items-center gap-3.5 mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
        <span className="text-3xl">{greetingInfo.emoji}</span>
        <h2 className="text-3xl md:text-4xl font-serif font-black text-navy-900 tracking-tight">
          {greetingInfo.text}
        </h2>
      </div>

      {/* Clock notice card / Priority job */}
      <div className="w-full max-w-xl mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-both">
        <div className="bg-white rounded-[24px] border border-neutral-gray-100 shadow-card px-6 py-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-gold-600/30 flex items-center justify-center shrink-0 bg-gold-100/50">
              <Clock className="w-6 h-6 text-gold-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-bold text-navy-900 text-sm md:text-base leading-snug">
                Zuerst steht an: <span className="font-extrabold text-navy-900">3 Teile in den Versand bringen.</span>
              </p>
              <p className="text-xs md:text-sm text-text-muted mt-1 leading-relaxed">
                Wenn das bis <span className="text-accent-orange font-bold">11:30 Uhr</span> erledigt ist, bleibt der Nachmittag entspannt.
              </p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#B8923F" strokeWidth="2" className="w-5 h-5 shrink-0 ml-2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* User Avatar Kacheln */}
      <div className="flex gap-5 md:gap-7 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both">
        {DEMO_USERS.map((user) => {
          const Icon = user.icon;
          return (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="w-[160px] md:w-[190px] aspect-square bg-white rounded-[28px] border border-neutral-gray-100 shadow-card hover:shadow-md hover:-translate-y-1 transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-5 p-6 group cursor-pointer"
            >
              <div className="w-20 h-20 rounded-full bg-gold-100 flex items-center justify-center shadow-inner">
                <span className="font-serif font-black text-2xl text-gold-600 tracking-tight">
                  {user.initials}
                </span>
              </div>
              <div className="text-gold-600 group-hover:text-accent-orange transition-colors duration-200">
                <Icon className="w-7 h-7" strokeWidth={1.5} />
              </div>
            </button>
          );
        })}
      </div>

      {selectedUser && (
        <PinDialog user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
