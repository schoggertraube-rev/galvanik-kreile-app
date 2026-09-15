"use client";

import Image from "next/image";
import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { Delete, LockKeyhole, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { usePageView } from "@/hooks/usePageView";
import { loginWithPin } from "@/app/actions/auth.actions";
import { notifyAdminPinReset } from "@/app/actions/start.actions";
import { EmailLoginDialog } from "@/components/start/EmailLoginDialog";
import type { StartUserDto } from "@/lib/auth/userDtos";
import styles from "./StartScreenClient.module.css";

const PRODUCT_PROFILES = {
  rolf: { name: "Rolf", responsibility: "Meister", initials: "R" },
  phillip: { name: "Phillip", responsibility: "Werkstatt", initials: "P" },
} as const;

function PinDialog({ user, onClose }: { user: StartUserDto; onClose: () => void }) {
  const profile = PRODUCT_PROFILES[user.identity];
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const enterDigit = async (digit: string) => {
    if (submitting || pin.length >= 4) return;
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    setMessage(null);
    if (nextPin.length !== 4) return;

    setSubmitting(true);
    try {
      const result = await loginWithPin(user.loginHandle, nextPin);
      if (result.ok) {
        window.location.assign("/");
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage("Anmeldung konnte nicht sicher abgeschlossen werden.");
    }
    setPin("");
    setSubmitting(false);
  };

  const onDigit = useEffectEvent((digit: string) => void enterDigit(digit));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) onDigit(event.key);
      if (event.key === "Backspace") setPin((value) => value.slice(0, -1));
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} data-testid="pin-login-dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.pinDialog} role="dialog" aria-modal="true" aria-labelledby="pin-dialog-title">
        <header>
          <span className={styles.avatar}>{profile.initials}</span>
          <div><p>{profile.name} · {profile.responsibility}</p><h2 id="pin-dialog-title">PIN eingeben</h2></div>
          <button type="button" aria-label="Schließen" onClick={onClose} disabled={submitting}>×</button>
        </header>
        <div className={styles.pinDots} aria-label={`${pin.length} von 4 Stellen eingegeben`}>
          {[0, 1, 2, 3].map((index) => <span key={index} data-filled={pin.length > index} />)}
        </div>
        {message ? <p className={styles.error} role="alert">{message}</p> : null}
        <div className={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" onClick={() => void enterDigit(String(digit))} disabled={submitting}>{digit}</button>)}
          <span />
          <button type="button" onClick={() => void enterDigit("0")} disabled={submitting}>0</button>
          <button type="button" aria-label="Letzte Stelle löschen" onClick={() => setPin((value) => value.slice(0, -1))} disabled={submitting}><Delete /></button>
        </div>
        {message ? <button type="button" className={styles.help} onClick={() => void notifyAdminPinReset(user.loginHandle)}>Systemadministrator informieren</button> : null}
      </section>
    </div>
  );
}

function StartContent({ users, loginUnavailable }: { users: StartUserDto[]; loginUnavailable: boolean }) {
  const [selected, setSelected] = useState<StartUserDto | null>(null);
  const [emailLogin, setEmailLogin] = useState(false);
  const searchParams = useSearchParams();
  const serverMessage = searchParams?.get("message");

  return (
    <main className={styles.screen}>
      <section className={styles.brandPanel} aria-label="Galvanik Kreile">
        <div className={styles.brandMark}>
          <Image src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={560} height={220} priority unoptimized />
        </div>
        <p className={styles.brandKicker}>WerkstattCockpit</p>
        <h1>Willkommen zurück.</h1>
        <p className={styles.brandLead}>Ein sicherer Einstieg. Danach sehen Sie genau die Arbeit, die zu Ihrem Produktprofil gehört.</p>
        <div className={styles.trust}><ShieldCheck aria-hidden="true" /><span>Tenantgebundene Sitzung · rollenbasierte Aktionen</span></div>
      </section>

      <section className={styles.loginPanel} aria-labelledby="login-title">
        <header><p>Anmelden</p><h2 id="login-title">Wer arbeitet gerade?</h2><span>Wählen Sie Ihr Produktprofil und geben Sie Ihre PIN ein.</span></header>
        {loginUnavailable ? <div className={styles.unavailable} role="alert">PIN-Anmeldung ist momentan nicht sicher verfügbar. Bitte den Systemadministrator kontaktieren.</div> : null}
        <div className={styles.users}>
          {(["rolf", "phillip"] as const).map((identity) => {
            const profile = PRODUCT_PROFILES[identity];
            const user = users.find((candidate) => candidate.identity === identity);
            return (
              <button
                key={identity}
                type="button"
                data-testid={user ? `pin-user-card-${user.loginHandle}` : `pin-profile-${identity}-unavailable`}
                onClick={() => user && setSelected(user)}
                disabled={!user || loginUnavailable}
              >
                <span className={styles.avatar}>{profile.initials}</span>
                <span><strong>{profile.name}</strong><small>{user ? `${profile.responsibility} · Mit PIN anmelden` : `${profile.responsibility} · Profil sicher nicht verfügbar`}</small></span>
                <LockKeyhole aria-hidden="true" />
              </button>
            );
          })}
          <button type="button" className={styles.adminLogin} onClick={() => setEmailLogin(true)}>
            <span className={styles.avatar}>G</span><span><strong>Gregor</strong><small>Systemadministrator · per E-Mail anmelden</small></span><LockKeyhole aria-hidden="true" />
          </button>
        </div>
        {serverMessage ? <p className={styles.error} role="alert">{serverMessage}</p> : null}
        <p className={styles.adminHint}>Der Systemzugang ist erhöht und steht nur über Gregors E-Mail-Einstieg bereit.</p>
      </section>

      {selected ? <PinDialog user={selected} onClose={() => setSelected(null)} /> : null}
      {emailLogin ? <EmailLoginDialog onClose={() => setEmailLogin(false)} /> : null}
    </main>
  );
}

export function StartScreenClient({ users, loginUnavailable = false }: { users: StartUserDto[]; loginUnavailable?: boolean }) {
  usePageView();
  return <Suspense fallback={<div className={styles.loading}>Anmeldung wird geladen …</div>}><StartContent users={users} loginUnavailable={loginUnavailable} /></Suspense>;
}
