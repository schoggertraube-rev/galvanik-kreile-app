"use client";
import { useEffect } from "react";
import { requestGlobalCreate } from "../requestGlobalCreate";

export function IntakeDirectEntry() {
  useEffect(() => {
    const open = () => {
      const fragment = location.hash.match(/^#uebergabe:([a-f0-9]{32})$/);
      const token=fragment?.[1] ?? (location.hash.startsWith("#uebergabe:")?location.hash.slice("#uebergabe:".length):null);
      requestGlobalCreate(token!==null ? { intent: "DIRECT_INTAKE", handoverToken: token } : "DIRECT_INTAKE");
    };
    const timer = setTimeout(open, 0);
    window.addEventListener("hashchange", open);
    return () => { clearTimeout(timer); window.removeEventListener("hashchange", open); };
  }, []);
  return null;
}
