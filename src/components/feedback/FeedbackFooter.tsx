"use client";

import { useRef, useState, type FormEvent } from "react";
import { sanitizeTelemetryRoute } from "@/lib/telemetry/contract";

interface FeedbackFooterProps {
  pageTitle?: string;
  route?: string;
  variant?: "compact" | "full";
}

type SubmitState = "idle" | "sending" | "stored" | "error";

export function FeedbackFooter({ pageTitle, route, variant = "full" }: FeedbackFooterProps) {
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const isCompact = variant === "compact";

  async function handleFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = feedback.trim();
    if (message.length < 3 || message.length > 2_000 || state === "sending") return;
    requestId.current ||= crypto.randomUUID();
    setState("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/developer-feedback", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: requestId.current,
          route: sanitizeTelemetryRoute(route || window.location.pathname),
          message,
        }),
      });
      const body = await response.json() as { ok?: boolean; status?: string; code?: string };
      if (!response.ok || body.ok !== true || body.status !== "stored") {
        throw new Error(body.code === "CONFIGURATION_MISSING"
          ? "Der Entwickler-Feedbackkanal ist noch nicht konfiguriert."
          : body.code === "RATE_LIMITED"
            ? "Zu viele Feedbacks in kurzer Zeit. Bitte später erneut senden."
            : "Feedback konnte nicht dauerhaft bestätigt werden.");
      }
      setFeedback("");
      requestId.current = null;
      setState("stored");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Feedback konnte nicht gesendet werden.");
    }
  }

  return (
    <section className={`mx-auto mt-8 w-full ${isCompact ? "max-w-xl" : "max-w-2xl"} rounded-3xl border border-neutral-gray-200 bg-bg-app-soft p-6 text-center`}>
      <h3 className={`${isCompact ? "text-base" : "text-lg"} mb-2 font-serif font-bold text-navy-900`}>
        Was fehlt auf dieser Seite{pageTitle ? ` (${pageTitle})` : ""}?
      </h3>
      <p className="mb-4 text-xs text-text-muted">Explizites Feedback wird getrennt von Nutzungsmetriken gespeichert und erst nach Serverbestätigung als gesendet markiert.</p>

      <form onSubmit={handleFeedback} className="flex gap-2">
        <input
          type="text"
          value={feedback}
          maxLength={2_000}
          onChange={(event) => { setFeedback(event.target.value); if (state !== "sending") setState("idle"); }}
          placeholder="Zum Beispiel: Ich brauche hier …"
          aria-label="Entwickler-Feedback"
          className="flex-1 rounded-xl border border-neutral-gray-300 px-4 py-3 text-sm focus:border-navy-900 focus:outline-none focus:ring-1 focus:ring-navy-900"
        />
        <button
          type="submit"
          disabled={state === "sending" || feedback.trim().length < 3}
          className="shrink-0 rounded-xl bg-navy-900 px-6 py-3 font-bold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "sending" ? "Speichert …" : state === "stored" ? "Gespeichert" : "Senden"}
        </button>
      </form>
      {state === "error" && <p role="alert" className="mt-3 text-xs font-medium text-error-red">{errorMessage}</p>}
      {state === "stored" && <p role="status" className="mt-3 text-xs font-medium text-emerald-700">Feedback wurde dauerhaft bestätigt.</p>}
    </section>
  );
}
