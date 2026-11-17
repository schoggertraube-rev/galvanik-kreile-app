"use client";
import {reportProtocolClientError} from '@/modules/logging/public';


import { useEffect, useState } from "react";
import { CLIENT_ACTION_ERROR_CODE } from "@/lib/client/runServerAction";
import styles from "./ClientActionErrorBanner.module.css";

export function ClientActionErrorBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUnhandledRejection = () => {
      reportProtocolClientError('ACTION_REQUEST_FAILED');
      setVisible(true);
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  if (!visible) return null;
  return <aside className={styles.banner} role="alert">
    <div>
      <strong>Anfrage nicht ausgeführt</strong>
      <p>Bitte die Seite neu laden und erneut versuchen. Fehlercode: {CLIENT_ACTION_ERROR_CODE}.</p>
    </div>
    <button type="button" onClick={() => setVisible(false)} aria-label="Fehlermeldung schließen">Schließen</button>
  </aside>;
}
