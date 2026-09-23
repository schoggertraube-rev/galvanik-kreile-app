"use client";

import Image from "next/image";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
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
  const [supportReference, setSupportReference] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const enterDigit = async (digit: string) => {
    if (submittingRef.current || pin.length >= 4) return;
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    setMessage(null);
    setSupportReference(undefined);
    if (nextPin.length !== 4) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await loginWithPin(user.loginHandle, nextPin);
      if (result.ok) {
        window.location.assign("/");
        return;
      }
      setMessage(result.message);
      setSupportReference(result.supportReference);
    } catch {
      setMessage("Anmeldung konnte nicht sicher abgeschlossen werden.");
    }
    setPin("");
    submittingRef.current = false;
    setSubmitting(false);
  };

  const onDigit = useEffectEvent((digit: string) => void enterDigit(digit));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const numpadDigit = /^Numpad([0-9])$/.exec(event.code)?.[1];
      const digit = /^[0-9]$/.test(event.key) ? event.key : numpadDigit;
      if (digit) {
        event.preventDefault();
        onDigit(digit);
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setPin((value) => value.slice(0, -1));
      }
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
          <div><p>{profile.name} · {profile.responsibility}</p><h2 id="pin-dialog-title">Persönlichen Code eingeben</h2></div>
          <button type="button" aria-label="Schließen" onClick={onClose} disabled={submitting}>×</button>
        </header>
        <div className={styles.pinDots} aria-label={`${pin.length} von 4 Stellen eingegeben`}>
          {[0, 1, 2, 3].map((index) => <span key={index} data-filled={pin.length > index} />)}
        </div>
        {message ? (
          <div className={styles.error} role="alert">
            <p>{message}</p>
            {supportReference ? (
              <details>
                <summary>Supportdetails</summary>
                <p>Referenz: <code>{supportReference}</code></p>
              </details>
            ) : null}
          </div>
        ) : null}
        <div className={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" onClick={() => void enterDigit(String(digit))} disabled={submitting}>{digit}</button>)}
          <button type="button" onClick={() => setPin((value) => value.slice(0, -1))} disabled={submitting}>Löschen</button>
          <button type="button" onClick={() => void enterDigit("0")} disabled={submitting}>0</button>
          <button type="button" onClick={() => { setPin(""); setMessage(null); setSupportReference(undefined); }} disabled={submitting}>Neu</button>
        </div>
        {message ? <button type="button" className={styles.help} onClick={() => void notifyAdminPinReset(user.loginHandle)}>Systemadministrator informieren</button> : null}
      </section>
    </div>
  );
}

function StartContent({
  users,
  loginUnavailable,
  supportReference,
}: {
  users: StartUserDto[];
  loginUnavailable: boolean;
  supportReference?: string;
}) {
  const [selected, setSelected] = useState<StartUserDto | null>(null);
  const [emailLogin, setEmailLogin] = useState(false);
  const searchParams = useSearchParams();
  const serverMessage = searchParams?.get("message");
  const serverSupportReference = searchParams?.get("support");
  const safeServerSupportReference =
    serverSupportReference &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serverSupportReference)
      ? serverSupportReference
      : undefined;

  return (
    <main className={styles.screen}>
      <section className={styles.brandPanel} aria-label="Galvanik Kreile">
        <div className={styles.brandMark}>
          <Image src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={560} height={220} priority unoptimized />
        </div>
        <p className={styles.brandKicker}>WerkstattCockpit</p>
      </section>

      <section className={styles.loginPanel} aria-labelledby="login-title">
        <header><h1 id="login-title">Persönlichen Code eingeben</h1></header>
        {loginUnavailable ? (
          <div className={styles.unavailable} role="alert">
            <p>Anmeldung ist momentan nicht verfügbar. Bitte den Systemadministrator kontaktieren.</p>
            {supportReference ? (
              <details>
                <summary>Supportdetails</summary>
                <p>Referenz: <code>{supportReference}</code></p>
              </details>
            ) : null}
          </div>
        ) : null}
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
                <span><strong>{profile.name}</strong><small>{user ? profile.responsibility : `${profile.responsibility} · Anmeldung nicht verfügbar`}</small></span>
                <LockKeyhole aria-hidden="true" />
              </button>
            );
          })}
          <button type="button" className={styles.adminLogin} onClick={() => setEmailLogin(true)} disabled={loginUnavailable}>
            <span className={styles.avatar}>G</span><span><strong>Gregor</strong><small>Systemadministrator</small></span><LockKeyhole aria-hidden="true" />
          </button>
        </div>
        {serverMessage ? (
          <div className={styles.error} role="alert">
            <p>{serverMessage}</p>
            {safeServerSupportReference ? (
              <details>
                <summary>Supportdetails</summary>
                <p>Referenz: <code>{safeServerSupportReference}</code></p>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      {selected ? <PinDialog user={selected} onClose={() => setSelected(null)} /> : null}
      {emailLogin ? <EmailLoginDialog onClose={() => setEmailLogin(false)} /> : null}
    </main>
  );
}

export function StartScreenClient({
  users,
  loginUnavailable = false,
  supportReference,
}: {
  users: StartUserDto[];
  loginUnavailable?: boolean;
  supportReference?: string;
}) {
  usePageView();
  return (
    <Suspense fallback={<div className={styles.loading}>Anmeldung wird geladen …</div>}>
      <StartContent users={users} loginUnavailable={loginUnavailable} supportReference={supportReference} />
    </Suspense>
  );
}
