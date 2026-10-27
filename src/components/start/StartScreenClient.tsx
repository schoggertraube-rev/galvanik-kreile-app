"use client";

import Image from "next/image";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { loginWithPin } from "@/app/actions/auth.actions";
import { usePageView } from "@/hooks/usePageView";
import type { StartUserDto } from "@/lib/auth/userDtos";
import { EmailLoginDialog } from "./EmailLoginDialog";
import styles from "./StartScreenClient.module.css";

const LAST_LOGIN_KEY = "kreile:last-login-handle";

function greeting(hour: number) {
  if (hour <= 10) return "Guten Morgen";
  if (hour <= 17) return "Guten Tag";
  return "Guten Abend";
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
  const [selectedHandle, setSelectedHandle] = useState(users[0]?.loginHandle ?? "");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const submittingRef = useRef(false);
  const searchParams = useSearchParams();
  const selected = users.find((user) => user.loginHandle === selectedHandle) ?? users[0];
  const serverMessage = searchParams?.get("message");
  const safeSupportReference = (searchParams?.get("support") ?? supportReference)?.match(/^[0-9a-f-]{36}$/i)?.[0];

  useEffect(() => {
    const remembered = window.localStorage.getItem(LAST_LOGIN_KEY);
    if (!remembered || !users.some((user) => user.loginHandle === remembered)) return;
    const frame = window.requestAnimationFrame(() => setSelectedHandle(remembered));
    return () => window.cancelAnimationFrame(frame);
  }, [users]);

  async function enterDigit(digit: string) {
    if (!selected || loginUnavailable || submittingRef.current || pin.length >= 4) return;
    if (message) setMessage(null);
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    if (nextPin.length !== 4) return;
    submittingRef.current = true;
    try {
      const result = await loginWithPin(selected.loginHandle, nextPin);
      if (result.ok) {
        window.localStorage.setItem(LAST_LOGIN_KEY, selected.loginHandle);
        window.location.assign("/");
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage("Anmeldung konnte nicht sicher abgeschlossen werden.");
    }
    setPin("");
    setShaking(true);
    window.setTimeout(() => setShaking(false), 420);
    submittingRef.current = false;
  }

  const onDigit = useEffectEvent((digit: string) => void enterDigit(digit));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const digit = /^[0-9]$/.test(event.key) ? event.key : /^Numpad([0-9])$/.exec(event.code)?.[1];
      if (digit) {
        event.preventDefault();
        onDigit(digit);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setPin((value) => value.slice(0, -1));
        setMessage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectUser(loginHandle: string) {
    setSelectedHandle(loginHandle);
    setPin("");
    setMessage(null);
  }

  return <main className={styles.screen}>
    <div className={styles.stripe} aria-hidden="true" />
    <section className={styles.loginPanel} aria-labelledby="login-title">
      <Image className={styles.logo} src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={260} height={102} priority unoptimized />
      <h1 id="login-title">{greeting(new Date().getHours())}</h1>
      {loginUnavailable ? <div className={styles.error} role="alert"><p>Anmeldung ist momentan nicht verfügbar.</p>{safeSupportReference ? <small>Referenz: {safeSupportReference}</small> : null}</div> : null}
      <div className={styles.users} aria-label="Person auswählen">
        {users.map((user) => <button
          key={user.loginHandle}
          type="button"
          data-testid={`pin-user-card-${user.loginHandle}`}
          aria-pressed={selected?.loginHandle === user.loginHandle}
          onClick={() => selectUser(user.loginHandle)}
          disabled={loginUnavailable}
        ><span>{user.shortCode}</span><small>{user.fullName.split(/\s+/)[0]}</small></button>)}
      </div>
      <div className={`${styles.pinDots} ${shaking ? styles.shake : ""}`} data-error={Boolean(message)} data-spec-id="login.pin" aria-label={`${pin.length} von 4 Stellen eingegeben`}>
        {[0, 1, 2, 3].map((index) => <span key={index} data-filled={pin.length > index} />)}
      </div>
      {message || serverMessage ? <p className={styles.errorText} role="alert">{message ?? serverMessage}</p> : <span className={styles.errorSpace} aria-hidden="true" />}
      <div className={styles.keypad} data-spec-id="login.anmelden">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" disabled={loginUnavailable} onClick={() => void enterDigit(String(digit))}>{digit}</button>)}
        <span aria-hidden="true" />
        <button type="button" disabled={loginUnavailable} onClick={() => void enterDigit("0")}>0</button>
        <button type="button" disabled={loginUnavailable} aria-label="Löschen" onClick={() => { setPin((value) => value.slice(0, -1)); setMessage(null); }}><Delete aria-hidden="true" /></button>
      </div>
      {selected?.role === "developer" ? <button className={styles.emailLink} data-spec-id="login.email" type="button" onClick={() => setEmailOpen(true)}>Mit E-Mail anmelden</button> : null}
    </section>
    {emailOpen ? <EmailLoginDialog onClose={() => setEmailOpen(false)} /> : null}
  </main>;
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
  return <Suspense fallback={<div className={styles.loading}>Anmeldung wird geladen …</div>}><StartContent users={users} loginUnavailable={loginUnavailable} supportReference={supportReference} /></Suspense>;
}
