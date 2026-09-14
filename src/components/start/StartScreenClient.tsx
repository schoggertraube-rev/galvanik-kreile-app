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

function PinDialog({ user, onClose }: { user: StartUserDto; onClose: () => void }) {
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
          <span className={styles.avatar}>{user.initials}</span>
          <div><p>Persönlicher Zugang</p><h2 id="pin-dialog-title">PIN eingeben</h2></div>
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
        {message ? <button type="button" className={styles.help} onClick={() => void notifyAdminPinReset(user.loginHandle)}>Administrator informieren</button> : null}
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
        <p className={styles.brandLead}>Ein sicherer Einstieg. Danach sehen Sie genau die Arbeit, die zu Ihrer Rolle gehört.</p>
        <div className={styles.trust}><ShieldCheck aria-hidden="true" /><span>Tenantgebundene Sitzung · rollenbasierte Aktionen</span></div>
      </section>

      <section className={styles.loginPanel} aria-labelledby="login-title">
        <header><p>Anmelden</p><h2 id="login-title">Wer arbeitet gerade?</h2><span>Persönliche Kachel wählen und vierstellige PIN eingeben.</span></header>
        {loginUnavailable ? <div className={styles.unavailable} role="alert">PIN-Anmeldung ist momentan nicht verfügbar. Bitte Administrator kontaktieren.</div> : null}
        <div className={styles.users}>
          {users.map((user) => (
            <button key={user.loginHandle} type="button" data-testid={`pin-user-card-${user.loginHandle}`} onClick={() => setSelected(user)}>
              <span className={styles.avatar}>{user.initials}</span>
              <span><strong>{user.tileKind === "office" ? "Büro" : "Werkstatt"}</strong><small>Mit PIN anmelden</small></span>
              <LockKeyhole aria-hidden="true" />
            </button>
          ))}
        </div>
        {serverMessage ? <p className={styles.error} role="alert">{serverMessage}</p> : null}
        <button type="button" className={styles.adminLogin} onClick={() => setEmailLogin(true)}>Administration per E-Mail</button>
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
