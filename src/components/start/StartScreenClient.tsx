"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect, useEffectEvent } from "react";
import { Delete, Clock, Wrench, Sun } from "lucide-react";
import { getGreeting } from "@/lib/greeting";
import { EmailLoginDialog } from "@/components/start/EmailLoginDialog";
import { useSearchParams } from "next/navigation";
import { getTodayTopPriority, getFeierabendEvents, notifyAdminPinReset } from "@/app/actions/start.actions";
import { loginWithPin } from "@/app/actions/auth.actions";
import type { StartUserDto } from "@/lib/auth/userDtos";

// Asynchronous weather card fetching directly from Open-Meteo
function WeatherCard() {
  const [weatherText, setWeatherText] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weatherState, setWeatherState] = useState<"loading" | "ready" | "error">("loading");
  const [eventText, setEventText] = useState<string | null>(null);
  const timeStr = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Fetch Frankfurt am Main weather
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=50.1109&longitude=8.6821&current_weather=true"
        );
        if (!res.ok) throw new Error("WEATHER_HTTP_ERROR");
        const data = await res.json();
        const temp = data?.current_weather?.temperature;
        const code = data?.current_weather?.weathercode;
        if (!Number.isFinite(temp) || !Number.isFinite(code)) throw new Error("WEATHER_PAYLOAD_INVALID");
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

        // Fetch event if after 15:00
        const hour = new Date().getHours();
        if (hour >= 15) {
          try {
            const evRes = await getFeierabendEvents();
            if (evRes?.success && evRes.event) {
              setEventText(`Event-Tipp: ${evRes.event} 🎉`);
            }
          } catch (e) {
            console.error(e);
          }
        }

        setWeatherText(condition);
        setWeatherState("ready");
      } catch (error) {
        console.error("Weather unavailable", error);
        setTemperature(null);
        setWeatherText(null);
        setWeatherState("error");
      }
    };
    fetchWeather();
  }, []);

  if (weatherState === "loading") {
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
          {weatherState === "error" || temperature === null || weatherText === null
            ? "Wetterdaten sind derzeit nicht verfügbar."
            : <>Heute: <strong>{temperature}°C</strong> · {weatherText}</>}
          {eventText && (
            <div className="mt-2 text-xs text-accent-orange font-bold flex items-center gap-1">
              {eventText}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end items-center gap-1.5 mt-3">
        <span className="text-[11px] text-text-muted font-mono">{timeStr}</span>
        <svg viewBox="0 0 16 10" fill="none" className="w-4 h-3">
          <path d="M1 5l3 4L13 1" stroke="#B8923F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 5l3 4L16 1" stroke="#B8923F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

// PIN Dialog Component
function PinDialog({ user, onClose }: { user: StartUserDto; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInput = async (num: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      setIsInitializing(true);

      try {
        const res = await loginWithPin(user.selector, newPin);

        if (res.ok) {
          // UI state in localStorage (not auth relevant)
          try {
            localStorage.setItem("kreile_user_initials", user.initials);
          } catch (e) {
            console.warn("localStorage is blocked, skipping user info storage", e);
          }

          // Redirect to home
          window.location.href = "/";
        } else {
          setError(true);
          setTimeout(() => setPin(""), 600);
          setIsInitializing(false);
        }
      } catch (e) {
        console.error("Login failed:", e);
        setError(true);
        setTimeout(() => setPin(""), 600);
        setIsInitializing(false);
      }
    }
  };

  const handleKeypadInput = useEffectEvent((num: string) => {
    void handleInput(num);
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeypadInput(e.key);
      } else if (e.key === "Backspace") {
        setPin(p => p.slice(0, -1));
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
          <button onClick={onClose} className="text-text-muted hover:text-navy-900 text-2xl leading-none cursor-pointer" disabled={isInitializing}>×</button>
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
        {error && (
          <p className="text-center text-danger-red text-xs font-semibold -mt-4 mb-3">
            Falscher PIN. <button onClick={async () => {
              const res = await notifyAdminPinReset(user.selector);
              if (res.success) {
                alert("Der Administrator wurde benachrichtigt und wird sich bei Ihnen melden.");
              } else {
                alert("Fehler beim Benachrichtigen des Administrators. Bitte sprechen Sie ihn direkt an.");
              }
            }} className="underline hover:text-danger-red/80">Administrator kontaktieren</button>
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 px-5 pb-5">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button
              key={n}
              onClick={() => {
                void handleInput(String(n));
              }}
              className="h-14 rounded-2xl bg-bg-app-soft hover:bg-neutral-gray-100 text-2xl font-bold text-navy-900 transition-all active:scale-95 cursor-pointer"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => {
              void handleInput("0");
            }}
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

import { Suspense } from "react";

function StartScreenContent({ users, usersLoadError }: { users: StartUserDto[]; usersLoadError: string | null }) {
  const [selectedUser, setSelectedUser] = useState<StartUserDto | null>(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [greetingInfo, setGreetingInfo] = useState({ text: "Guten Morgen, Meister!", emoji: "👋" });
  const [priority, setPriority] = useState<{
    state: "loading" | "ready" | "empty" | "unauthorized" | "error";
    taskText: string | null;
    dueAt: string | null;
    dueKind: "customer_promise" | "internal_due" | null;
  }>({ state: "loading", taskText: null, dueAt: null, dueKind: null });

  const searchParams = useSearchParams();
  const errorMessage = searchParams?.get("message");

  useEffect(() => {
    const updateGreeting = () => {
      setGreetingInfo(getGreeting(new Date(), "Meister"));
    };
    updateGreeting();
    const id = setInterval(updateGreeting, 60000);

    // Fetch dynamic task priority
    const fetchTask = async () => {
      try {
        const res = await getTodayTopPriority();
        setPriority({
          state: res.kind,
          taskText: res.taskText,
          dueAt: res.dueAt,
          dueKind: res.dueKind,
        });
      } catch (e) {
        console.error("Failed to fetch priority task", e);
        setPriority({ state: "error", taskText: null, dueAt: null, dueKind: null });
      }
    };
    fetchTask();

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
                {priority.state === "loading" && "Priorität wird geladen …"}
                {priority.state === "ready" && <>Zuerst steht an: <span className="font-extrabold text-navy-900">{priority.taskText}</span></>}
                {priority.state === "empty" && "Keine laufende Auftragspriorität vorhanden."}
                {priority.state === "unauthorized" && "Nach der Anmeldung werden autorisierte Auftragsprioritäten geladen."}
                {priority.state === "error" && "Auftragspriorität ist derzeit nicht verfügbar."}
              </p>
              {priority.state === "ready" && (
                <p className="text-xs md:text-sm text-text-muted mt-1 leading-relaxed">
                  {priority.dueAt
                    ? `${priority.dueKind === "customer_promise" ? "Kundenzusage" : "Interner Termin"}: ${new Date(priority.dueAt).toLocaleString("de-DE")}`
                    : "Kein bestätigter Termin hinterlegt."}
                </p>
              )}
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#B8923F" strokeWidth="2" className="w-5 h-5 shrink-0 ml-2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* User Avatar Kacheln */}
      {usersLoadError && (
        <p role="alert" className="mb-4 rounded-xl border border-danger-red/30 bg-danger-red/10 px-4 py-3 text-sm font-bold text-danger-red">
          {usersLoadError}
        </p>
      )}
      {!usersLoadError && users.length === 0 && (
        <p className="mb-4 rounded-xl border border-neutral-gray-200 bg-white px-4 py-3 text-sm text-text-muted">
          Keine aktiven, PIN-berechtigten Benutzer für diesen Mandanten vorhanden. E-Mail-Login bleibt verfügbar.
        </p>
      )}
      <div className="flex gap-5 md:gap-7 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both overflow-x-auto pb-4 snap-x">
        {users.map((user) => {
          const Icon = Wrench;
          return (
            <button
              key={user.selector}
              onClick={() => setSelectedUser(user)}
              className="w-[220px] h-[260px] shrink-0 snap-center bg-bg-app-soft rounded-[28px] border border-neutral-gray-100 shadow-card hover:shadow-md hover:-translate-y-1 transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-6 p-6 group cursor-pointer"
            >
              <div className="w-24 h-24 rounded-full bg-gold-100 flex items-center justify-center shadow-inner">
                <span className="font-serif font-black text-3xl text-gold-600 tracking-tight">
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

      {/* Admin Login Trigger & Error Messages */}
      <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in duration-700 delay-500 fill-mode-both">
        {errorMessage && (
          <p className="text-sm text-danger-red font-bold bg-danger-red/10 px-4 py-2 rounded-xl mb-2">
            {errorMessage}
          </p>
        )}
        <button
          onClick={() => setShowEmailLogin(true)}
          className="text-xs text-text-muted hover:text-navy-900 font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Administrator / E-Mail Login
        </button>

      </div>

      {selectedUser && (
        <PinDialog user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {showEmailLogin && (
        <EmailLoginDialog onClose={() => setShowEmailLogin(false)} />
      )}
    </div>
  );
}

export function StartScreenClient({ users, usersLoadError = null }: { users: StartUserDto[]; usersLoadError?: string | null }) {
  usePageView();
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-app-soft flex items-center justify-center p-8">
        <div className="text-text-muted font-bold animate-pulse text-lg">Lade Startbildschirm...</div>
      </div>
    }>
      <StartScreenContent users={users} usersLoadError={usersLoadError} />
    </Suspense>
  );
}
