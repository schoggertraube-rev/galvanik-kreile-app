import { StrictMode } from 'react';
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import * as protocol from '@/modules/logging/public';

const workspacePath = (...parts: string[]) => resolve(process.cwd(), ...parts);
const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

afterEach(() => {
  vi.restoreAllMocks();

  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

describe("ServiceWorkerRegister contract", () => {
  it("registers the root service worker exactly once per render", async () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegister />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(1);
    });
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("reuses the attempt across StrictMode and a root remount", async () => {
    const register = vi.fn().mockResolvedValue({scope:"/"});
    Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{register}});
    const first=render(<StrictMode><ServiceWorkerRegister /><ServiceWorkerRegister /></StrictMode>);
    await waitFor(()=>expect(register).toHaveBeenCalledTimes(1));
    first.unmount();
    render(<ServiceWorkerRegister />);
    await waitFor(()=>expect(register).toHaveBeenCalledTimes(1));
  });

  it("allows a later mount to recover a rejected registration", async () => {
    const register=vi.fn().mockRejectedValueOnce(new Error("TEST offline install")).mockResolvedValue({scope:"/"});
    const consoleError=vi.spyOn(console,"error").mockImplementation(()=>{});
    const diagnostic=vi.spyOn(protocol,'reportProtocolClientError').mockImplementation(()=>{});
    Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{register}});
    const first=render(<ServiceWorkerRegister />);
    await waitFor(()=>expect(diagnostic).toHaveBeenCalledWith('ACTION_REQUEST_FAILED'));
    expect(diagnostic.mock.calls.filter(([code])=>code==='ACTION_REQUEST_FAILED')).toEqual([['ACTION_REQUEST_FAILED']]);
    expect(consoleError.mock.calls.flat().some(value=>value instanceof Error)).toBe(false);first.unmount();
    render(<ServiceWorkerRegister />);
    await waitFor(()=>expect(register).toHaveBeenCalledTimes(2));
  });

  it("keeps exactly one active root registrar and no shell registrar", () => {
    const rootLayout = readFileSync(workspacePath("src", "app", "layout.tsx"), "utf8");
    const shell = readFileSync(
      workspacePath("src", "components", "layout", "KreileAppShell.tsx"),
      "utf8",
    );

    expect(rootLayout).toMatch(
      /import\s*\{\s*ServiceWorkerRegister\s*\}\s*from\s*["']@\/components\/ServiceWorkerRegister["'];/,
    );
    expect(rootLayout.match(/<ServiceWorkerRegister\s*\/>/g)).toHaveLength(1);
    expect(shell).not.toMatch(/from\s*["']\.\/PwaRegister["']/);
    expect(shell).not.toMatch(/\bPwaRegister\b/);
  });
});
