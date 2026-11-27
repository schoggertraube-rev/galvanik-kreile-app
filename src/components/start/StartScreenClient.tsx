"use client";

import Image from "next/image";
import { Suspense, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, useTransition, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions/auth";
import { loginWithPin } from "@/app/actions/auth.actions";
import { reportTabletInput } from '@/lib/auth/sessionInactivity';
import { usePageView } from "@/hooks/usePageView";
import { useHydrated } from "@/hooks/useHydrated";
import {clearPrivateReadStateBeforeLogin} from '@/lib/offline/privateReadCache';
import {PIN_LOGIN_COPY,OFFLINE_DEVICE_STATUS_COPY} from '@/ui/situationCatalog';
import type { StartUserDto } from "@/lib/auth/userDtos";
import { PinEingabe } from "@/ui/kr/PinEingabe";
import { Glasknopf } from "@/ui/kr/design-final/Glasknopf";
import styles from "./StartScreenClient.module.css";

const LAST_LOGIN_KEY = "kreile:last-login-handle";
const MOBILE_LOGIN_QUERY = "(max-width: 600px) and (pointer: coarse), (max-width: 1023px) and (max-height: 519px) and (orientation: landscape) and (pointer: coarse)";

function subscribeMobileLogin(onChange: () => void) {
  const media = window.matchMedia?.(MOBILE_LOGIN_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function mobileLoginSnapshot() {
  return window.matchMedia?.(MOBILE_LOGIN_QUERY).matches ?? false;
}

const firstName = (user: StartUserDto) => user.fullName.split(/\s+/)[0];

function greeting(hour: number) {
  if (hour <= 10) return "Guten Morgen";
  if (hour <= 17) return "Guten Tag";
  return "Guten Abend";
}

function StartContent({
  users,
  loginUnavailable,
  supportReference,
  skippedLogins = 0,
}: {
  users: StartUserDto[];
  loginUnavailable: boolean;
  supportReference?: string;
  skippedLogins?: number;
}) {
  const searchParams = useSearchParams();
  const interactive = useHydrated();
  const mobile = useSyncExternalStore(subscribeMobileLogin, mobileLoginSnapshot, () => false);
  const [selectedHandle, setSelectedHandle] = useState(users[0]?.loginHandle ?? "");
  const [rememberedHandle, setRememberedHandle] = useState<string | null>(null);
  const [groupCapacity, setGroupCapacity] = useState(4);
  const [groupAnchor, setGroupAnchor] = useState(0);
  const [enterShortCode, setEnterShortCode] = useState(false);
  const [shortCode, setShortCode] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [mode, setMode] = useState<"pin" | "email">(() => searchParams?.get("mode") === "email" ? "email" : "pin");
  const [showServerMessage, setShowServerMessage] = useState(true);
  const [pinPending, setPinPending] = useState(false);
  const [emailPending, startEmailTransition] = useTransition();
  const submittingRef = useRef(false);
  const codeRef = useRef<HTMLDivElement>(null);
  const peopleRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ pointerId: number; x: number } | null>(null);
  const ignoreClickUntil = useRef(0);
  const lastWheel = useRef(-Infinity);
  const typedShortcut = useRef({ text: "", at: 0 });
  const shortCodeRef = useRef<HTMLInputElement>(null);
  const remembered = users.find((user) => user.loginHandle === rememberedHandle);
  const shortCodeRequired = mobile && (enterShortCode || !remembered);
  const lookupCode = shortCode.trim();
  const shortCodeMatches = shortCodeRequired && lookupCode
    ? users.filter((user) => user.shortCode.trim().toUpperCase() === lookupCode)
    : [];
  const selected = mobile
    ? (shortCodeRequired ? (shortCodeMatches.length === 1 ? shortCodeMatches[0] : undefined) : remembered)
    : users.find((user) => user.loginHandle === selectedHandle) ?? users[0];
  const selectedIndex = users.findIndex((user) => user.loginHandle === selected?.loginHandle);
  const groupStart = Math.floor(Math.min(groupAnchor, Math.max(0, users.length - 1)) / groupCapacity) * groupCapacity;
  const activeGroup = users.slice(groupStart, groupStart + groupCapacity);
  const rovingIndex = selectedIndex >= groupStart && selectedIndex < groupStart + groupCapacity ? selectedIndex : groupStart;
  const pinDisabled = !interactive || loginUnavailable || pinPending || users.length === 0;
  const serverMessage = showServerMessage ? searchParams?.get("message") : null;
  const safeSupportReference = (searchParams?.get("support") ?? supportReference)?.match(/^[0-9a-f-]{36}$/i)?.[0];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(LAST_LOGIN_KEY);
        const savedIndex = saved ? users.findIndex((user) => user.loginHandle === saved) : -1;
        if (saved && savedIndex >= 0) {
          setRememberedHandle(saved);
          setSelectedHandle(saved);
          setGroupAnchor(savedIndex);
        } else if (!loginUnavailable) {
          setRememberedHandle(null);
          if (saved) window.localStorage.removeItem(LAST_LOGIN_KEY);
        }
      } catch {
        console.error('[START_LAST_LOGIN_READ_FAILED]');
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [users, loginUnavailable]);

  useEffect(() => {
    const list = peopleRef.current;
    if (!list || mobile || mode !== "pin") return;
    const measure = () => {
      const button = list.querySelector("button");
      const size = button?.getBoundingClientRect().width;
      if (!size || !list.clientWidth) return;
      const style = window.getComputedStyle(list);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
      const columns = Math.max(1, Math.floor((list.clientWidth - padding + gap) / (size + gap)));
      setGroupCapacity(columns * 2);
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(list);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mobile, mode, users.length]);

  async function enterDigit(digit: string) {
    if (pinDisabled || submittingRef.current || pin.length >= 4) return;
    setShowServerMessage(false);
    if (message) setMessage(null);
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    if (nextPin.length !== 4) return;
    if (!selected) {
      setMessage(PIN_LOGIN_COPY.kuerzelOderCodeFalsch);
      setPin("");
      shortCodeRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    setPinPending(true);
    try {
      const cleanup=await clearPrivateReadStateBeforeLogin();
      if(cleanup?.code==='UNAVAILABLE')setMessage(OFFLINE_DEVICE_STATUS_COPY.unavailable);
      const tablet = reportTabletInput();
      const result = tablet
        ? await loginWithPin(selected.loginHandle, nextPin, tablet)
        : await loginWithPin(selected.loginHandle, nextPin);
      if (result.ok) {
        try {
          window.localStorage.setItem(LAST_LOGIN_KEY, selected.loginHandle);
        } catch {
          console.error('[START_LAST_LOGIN_WRITE_FAILED]');
        }
        window.location.assign("/");
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage(PIN_LOGIN_COPY.incomplete);
    }
    setPin("");
    setShaking(true);
    window.setTimeout(() => setShaking(false), 420);
    submittingRef.current = false;
    setPinPending(false);
  }

  function removeDigit() {
    if (submittingRef.current) return;
    setPin((value) => value.slice(0, -1));
    setMessage(null);
  }

  const onDigit = useEffectEvent((digit: string) => void enterDigit(digit));
  const clearLastDigit = useEffectEvent(removeDigit);
  const resetPinFocus = useEffectEvent(() => {
    if (submittingRef.current) return;
    setPin("");
    setMessage(null);
    setShowServerMessage(false);
    if (!mobile && selectedIndex >= 0) {
      setGroupAnchor(selectedIndex);
      focusPerson(selectedIndex);
    } else {
      (shortCodeRef.current ?? codeRef.current)?.focus();
    }
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== "pin" || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        resetPinFocus();
        return;
      }
      if (event.target instanceof HTMLInputElement) return;
      const digit = /^[0-9]$/.test(event.key) ? event.key : /^Numpad([0-9])$/.exec(event.code)?.[1];
      if (digit) {
        event.preventDefault();
        onDigit(digit);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        clearLastDigit();
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
  }

  function focusPerson(index: number) {
    const find = () => peopleRef.current?.querySelector<HTMLButtonElement>(`button[data-login-index="${index}"]`);
    const current = find();
    if (current) current.focus();
    else window.requestAnimationFrame(() => find()?.focus());
  }

  function navigatePeople(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (pinDisabled || event.ctrlKey || event.metaKey || event.altKey || /^Numpad[0-9]$/.test(event.code)) return;
    const current = event.target instanceof HTMLElement
      ? Number(event.target.closest("button")?.dataset.loginIndex ?? rovingIndex)
      : rovingIndex;
    const columns = Math.min(groupCapacity / 2, users.length);
    let next: number;
    switch (event.key) {
      case "ArrowLeft": next = (current + users.length - 1) % users.length; break;
      case "ArrowRight": next = (current + 1) % users.length; break;
      case "ArrowUp": next = (current - columns + users.length) % users.length; break;
      case "ArrowDown": next = (current + columns) % users.length; break;
      case "Home": next = 0; break;
      case "End": next = users.length - 1; break;
      default:
        if (!/^\p{L}$/u.test(event.key)) return;
        const letter = event.key.toLocaleUpperCase("de-DE");
        const time = performance.now();
        const previous = typedShortcut.current;
        const prefix = time - previous.at < 700 ? previous.text + letter : letter;
        next = users.findIndex((user) => user.shortCode.toLocaleUpperCase("de-DE").startsWith(prefix));
        if (next < 0 && prefix !== letter) {
          next = users.findIndex((user) => user.shortCode.toLocaleUpperCase("de-DE").startsWith(letter));
          typedShortcut.current = { text: letter, at: time };
        } else {
          typedShortcut.current = { text: prefix, at: time };
        }
        if (next < 0) return;
    }
    event.preventDefault();
    setGroupAnchor(next);
    selectUser(users[next].loginHandle);
    focusPerson(next);
  }

  function moveGroup(direction: number) {
    if (pinDisabled) return;
    const next = groupStart + direction * groupCapacity;
    if (next < 0 || next >= users.length) return;
    const restoreFocus = peopleRef.current?.contains(document.activeElement);
    setGroupAnchor(next);
    selectUser(users[next].loginHandle);
    if (restoreFocus) focusPerson(next);
  }

  function scrollPeople(event: ReactWheelEvent<HTMLDivElement>) {
    const time = performance.now();
    if (time - lastWheel.current < 220) return;
    const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!amount) return;
    lastWheel.current = time;
    moveGroup(Math.sign(amount));
  }

  function finishSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const moved = start.x - event.clientX;
    if (Math.abs(moved) < 36) return;
    ignoreClickUntil.current = performance.now() + 400;
    moveGroup(Math.sign(moved));
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const tablet = reportTabletInput();
    if (tablet) formData.set('tabletInput', tablet);
    startEmailTransition(async () => {
      const cleanup=await clearPrivateReadStateBeforeLogin();
      if(cleanup?.code==='UNAVAILABLE')setMessage(OFFLINE_DEVICE_STATUS_COPY.unavailable);
      await login(formData);
    });
  }

  const salutation = greeting(new Date().getHours());
  return <main className={styles.screen}>
    <section className={styles.loginPanel} data-mode={mode} aria-labelledby="login-title">
      <header className={styles.heading}>
        <Image className={styles.logo} src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={260} height={102} priority unoptimized />
        <h1 id="login-title">{mobile && !shortCodeRequired && remembered ? `${salutation}, ${firstName(remembered)}` : salutation}</h1>
        {skippedLogins > 0 ? <p className={styles.error} role="status">{PIN_LOGIN_COPY.wartungAusgeblendet(skippedLogins)}</p> : null}
        {loginUnavailable ? <div className={styles.error} role="alert"><p>{PIN_LOGIN_COPY.nichtVerfuegbar}</p>{safeSupportReference ? <small>Referenz: {safeSupportReference}</small> : null}</div> : null}
      </header>
      {mode === "pin" ? <>
        {!mobile && users.length > 0 ? <div ref={peopleRef} className={styles.users} data-many={users.length > groupCapacity || undefined}
          role="group" aria-label={PIN_LOGIN_COPY.personenleiste} onKeyDown={navigatePeople} onWheel={scrollPeople}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") swipeStart.current = { pointerId: event.pointerId, x: event.clientX };
          }} onPointerUp={finishSwipe} onPointerCancel={() => { swipeStart.current = null; }}>
          {activeGroup.map((user, index) => <Glasknopf
            key={user.loginHandle}
            className={styles.person}
            knopfform="kreis"
            bezeichnung={`${user.shortCode} ${firstName(user)}`}
            title={firstName(user)}
            data-testid={`pin-user-card-${user.loginHandle}`}
            data-login-index={groupStart + index}
            aria-pressed={selected?.loginHandle === user.loginHandle}
            tabIndex={groupStart + index === rovingIndex ? 0 : -1}
            onClick={() => {
              if (performance.now() < ignoreClickUntil.current) return;
              selectUser(user.loginHandle);
              codeRef.current?.focus();
            }}
            disabled={pinDisabled}
            icon={<span className={styles.personLabel}>{user.shortCode}<small>{firstName(user)}</small></span>}
          />)}
        </div> : null}
        {shortCodeRequired ? <label className={styles.shortCode}>
          {PIN_LOGIN_COPY.kuerzelLabel}
          <input ref={shortCodeRef} value={shortCode} disabled={pinDisabled} autoComplete="username" autoCapitalize="characters" enterKeyHint="next"
            spellCheck={false} onChange={(event) => {
              setShortCode(event.target.value.toUpperCase());
              setPin("");
              setMessage(null);
              setShowServerMessage(false);
            }} onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              codeRef.current?.focus();
            }} />
        </label> : null}
        <PinEingabe laenge={pin.length} meldung={message ?? serverMessage} gesperrt={pinDisabled} schuetteln={shaking}
          punktRef={codeRef} tastaturTabIndex={-1} onZiffer={(digit) => void enterDigit(digit)} onLoeschen={removeDigit} />
        <div className={styles.options}>
          {mobile && !shortCodeRequired && remembered ? <Glasknopf text={PIN_LOGIN_COPY.nichtDu(firstName(remembered))} ton="leise"
            disabled={pinDisabled} onClick={() => {
              setEnterShortCode(true);
              setPin("");
              setMessage(null);
              window.requestAnimationFrame(() => shortCodeRef.current?.focus());
            }} /> : null}
          {selected?.emailLoginAvailable ? <Glasknopf text={PIN_LOGIN_COPY.mitEmail} ton="leise" data-spec-id="login.email"
            disabled={pinDisabled} onClick={() => setMode("email")} /> : null}
        </div>
      </> : <form className={styles.emailForm} onSubmit={submitEmail}>
        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" required autoFocus disabled={loginUnavailable} onChange={() => setShowServerMessage(false)} />
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" enterKeyHint="go" required disabled={loginUnavailable} />
        {message || serverMessage ? <p className={styles.errorText} role="alert" aria-live="polite">{message ?? serverMessage}</p> : null}
        <Glasknopf ton="haupt" data-spec-id="login.email-anmelden" type="submit" disabled={!interactive || loginUnavailable || emailPending}
          text={emailPending ? PIN_LOGIN_COPY.meldetAn : PIN_LOGIN_COPY.anmelden} />
        <Glasknopf text={PIN_LOGIN_COPY.mitCode} ton="leise" disabled={!interactive} onClick={() => {
          setMode("pin");
          window.requestAnimationFrame(() => codeRef.current?.focus());
        }} />
      </form>}
    </section>
  </main>;
}

export function StartScreenClient({
  users,
  loginUnavailable = false,
  supportReference,
  skippedLogins,
}: {
  users: StartUserDto[];
  loginUnavailable?: boolean;
  supportReference?: string;
  skippedLogins?: number;
}) {
  usePageView();
  return <Suspense fallback={<div className={styles.loading}>{PIN_LOGIN_COPY.laedt}</div>}><StartContent users={users} loginUnavailable={loginUnavailable} supportReference={supportReference} skippedLogins={skippedLogins} /></Suspense>;
}
