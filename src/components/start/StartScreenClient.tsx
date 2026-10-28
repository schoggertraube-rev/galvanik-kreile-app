"use client";

import Image from "next/image";
import { Suspense, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { Delete } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions/auth";
import { loginWithPin } from "@/app/actions/auth.actions";
import { usePageView } from "@/hooks/usePageView";
import type { StartUserDto } from "@/lib/auth/userDtos";
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
  const searchParams = useSearchParams();
  const [selectedHandle, setSelectedHandle] = useState(users[0]?.loginHandle ?? "");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [mode, setMode] = useState<"pin" | "email">(() => searchParams?.get("mode") === "email" ? "email" : "pin");
  const [showServerMessage, setShowServerMessage] = useState(true);
  const [pinPending, setPinPending] = useState(false);
  const [emailPending, startEmailTransition] = useTransition();
  const submittingRef = useRef(false);
  const codeRef = useRef<HTMLDivElement>(null);
  const selected = users.find((user) => user.loginHandle === selectedHandle) ?? users[0];
  const serverMessage = showServerMessage ? searchParams?.get("message") : null;
  const safeSupportReference = (searchParams?.get("support") ?? supportReference)?.match(/^[0-9a-f-]{36}$/i)?.[0];

  useEffect(() => {
    const remembered = window.localStorage.getItem(LAST_LOGIN_KEY);
    if (!remembered || !users.some((user) => user.loginHandle === remembered)) return;
    const frame = window.requestAnimationFrame(() => setSelectedHandle(remembered));
    return () => window.cancelAnimationFrame(frame);
  }, [users]);

  useEffect(() => {
    if (mode !== "pin") return;
    const frame = window.requestAnimationFrame(() => codeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  async function enterDigit(digit: string) {
    if (!selected || loginUnavailable || submittingRef.current || pin.length >= 4) return;
    setShowServerMessage(false);
    if (message) setMessage(null);
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    if (nextPin.length !== 4) return;
    submittingRef.current = true;
    setPinPending(true);
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
    setPinPending(false);
  }

  const onDigit = useEffectEvent((digit: string) => void enterDigit(digit));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== "pin") return;
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
  }, [mode]);

  function selectUser(loginHandle: string) {
    setSelectedHandle(loginHandle);
    setPin("");
    setMessage(null);
    setShowServerMessage(false);
    setMode("pin");
    window.requestAnimationFrame(() => codeRef.current?.focus());
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startEmailTransition(async () => {
      await login(formData);
    });
  }

  return <main className={styles.screen}>
    <div className={styles.stripe} aria-hidden="true" />
    <section className={styles.loginPanel} aria-labelledby="login-title">
      <Image className={styles.logo} src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={260} height={102} priority unoptimized />
      <h1 id="login-title">{greeting(new Date().getHours())}</h1>
      {mode === "pin" ? <>
        {loginUnavailable ? <div className={styles.error} role="alert"><p>Anmeldung ist momentan nicht verfügbar.</p>{safeSupportReference ? <small>Referenz: {safeSupportReference}</small> : null}</div> : null}
        <div className={styles.users} aria-label="Person auswählen">
          {users.map((user) => <button
            key={user.loginHandle}
            type="button"
            data-testid={`pin-user-card-${user.loginHandle}`}
            aria-pressed={selected?.loginHandle === user.loginHandle}
            onClick={() => selectUser(user.loginHandle)}
            disabled={loginUnavailable || pinPending}
          ><span>{user.shortCode}</span><small>{user.fullName.split(/\s+/)[0]}</small></button>)}
        </div>
        <div
          ref={codeRef}
          className={`${styles.pinDots} ${shaking ? styles.shake : ""}`}
          data-error={Boolean(message || serverMessage)}
          data-spec-id="login.pin"
          aria-label={`${pin.length} von 4 Stellen eingegeben`}
          aria-describedby="login-message"
          role="group"
          tabIndex={0}
        >
          {[0, 1, 2, 3].map((index) => <span key={index} data-filled={pin.length > index} />)}
        </div>
        <p id="login-message" className={message || serverMessage ? styles.errorText : styles.errorSpace} role={message || serverMessage ? "alert" : undefined} aria-live="polite">
          {message ?? serverMessage ?? ""}
        </p>
        <div className={styles.keypad} data-spec-id="login.anmelden" aria-label="Ziffernblock">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" disabled={loginUnavailable || pinPending} onClick={() => void enterDigit(String(digit))}>{digit}</button>)}
          <span aria-hidden="true" />
          <button type="button" disabled={loginUnavailable || pinPending} onClick={() => void enterDigit("0")}>0</button>
          <button type="button" disabled={loginUnavailable || pinPending} aria-label="Löschen" onClick={() => { setPin((value) => value.slice(0, -1)); setMessage(null); }}><Delete aria-hidden="true" /></button>
        </div>
        {selected?.role === "developer" ? <button className={styles.emailLink} data-spec-id="login.email" type="button" onClick={() => setMode("email")}>Mit E-Mail anmelden</button> : null}
      </> : <form className={styles.emailForm} onSubmit={submitEmail}>
        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus onChange={() => setShowServerMessage(false)} />
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {serverMessage ? <p className={styles.errorText} role="alert" aria-live="polite">{serverMessage}</p> : null}
        <button className={styles.emailSubmit} data-spec-id="login.email-anmelden" type="submit" disabled={emailPending}>{emailPending ? "Anmeldung läuft …" : "Anmelden"}</button>
        <button className={styles.emailLink} type="button" onClick={() => setMode("pin")}>Mit Code anmelden</button>
      </form>}
    </section>
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
