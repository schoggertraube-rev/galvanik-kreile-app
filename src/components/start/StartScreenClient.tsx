"use client";

import { usePageView } from "@/hooks/usePageView";
import Image from "next/image";
import { useState, useEffect, useEffectEvent } from "react";
import { Delete, Clock, Wrench, Calculator, Sun } from "lucide-react";
import { getGreeting } from "@/lib/greeting";
import { EmailLoginDialog } from "@/components/start/EmailLoginDialog";
import { useSearchParams } from "next/navigation";
import { notifyAdminPinReset } from "@/app/actions/start.actions";
import { loginWithPin } from "@/app/actions/auth.actions";
import type { StartUserDto } from "@/lib/auth/userDtos";

// Provider-dependent weather and event hints remain unavailable until contracted safely.
function WeatherCard() {
  return (
    <div className="absolute top-6 right-6 w-[320px] bg-white rounded-2xl border border-neutral-gray-100 p-5 shadow-card animate-in fade-in duration-300">
      <div className="flex gap-3.5 items-start">
        <div className="shrink-0 mt-0.5">
          <Sun className="w-7 h-7 text-accent-orange" strokeWidth={1.5} />
        </div>
        <div className="text-sm leading-relaxed text-navy-900 font-medium">
          NOT_AVAILABLE: Wetter- und Eventhinweise sind bis zu einem sicheren Provider-Vertrag nicht verfügbar.
        </div>
      </div>
      <div className="flex justify-end items-center gap-1.5 mt-3">
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
        const res = await loginWithPin(user.loginHandle, newPin);

        if (res.ok) {
          // Redirect to home — PermissionsContext picks up identity atomically via server action
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
              const res = await notifyAdminPinReset(user.loginHandle);
              if (res.success) {
                alert("Anfrage wurde verarbeitet. Falls das Konto vorhanden ist, wird sie intern weitergeleitet.");
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

function StartScreenContent({
  users,
  loginUnavailable,
}: {
  users: StartUserDto[];
  loginUnavailable: boolean;
}) {
  const [selectedUser, setSelectedUser] = useState<StartUserDto | null>(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [greetingInfo, setGreetingInfo] = useState({ text: "Guten Morgen, Meister!", emoji: "👋" });

  const searchParams = useSearchParams();
  const errorMessage = searchParams?.get("message");

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
        <Image
          src="/assets/logo/kreile-wordmark-skyline.svg"
          alt="Kreile Wortmarke Skyline"
          width={560}
          height={220}
          unoptimized
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
                Zuerst steht an: <span className="font-extrabold text-navy-900">Tagesplan nach dem Einloggen prüfen.</span>
              </p>
              <p className="text-xs md:text-sm text-text-muted mt-1 leading-relaxed">
                Nach dem Login sehen Sie Ihre aktuellen Aufgaben und Fristen.
              </p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#B8923F" strokeWidth="2" className="w-5 h-5 shrink-0 ml-2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* User Avatar Kacheln */}
      <div className="flex gap-5 md:gap-7 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both overflow-x-auto pb-4 snap-x">
        {users.map((user) => {
          const Icon = user.tileKind === "office" ? Calculator : Wrench;
          return (
            <button
              key={user.loginHandle}
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
        {loginUnavailable && (
          <div className="rounded-2xl border border-danger-red/20 bg-danger-red/10 px-6 py-5 text-center text-sm font-semibold text-danger-red">
            PIN-Anmeldung ist momentan nicht verfügbar. Bitte Administrator kontaktieren.
          </div>
        )}
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

export function StartScreenClient({
  users,
  loginUnavailable = false,
}: {
  users: StartUserDto[];
  loginUnavailable?: boolean;
}) {
  usePageView();
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-app-soft flex items-center justify-center p-8">
        <div className="text-text-muted font-bold animate-pulse text-lg">Lade Startbildschirm...</div>
      </div>
    }>
      <StartScreenContent
        users={users}
        loginUnavailable={loginUnavailable}
      />
    </Suspense>
  );
}
