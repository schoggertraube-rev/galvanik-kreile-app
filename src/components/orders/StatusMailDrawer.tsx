"use client";

import { X } from "lucide-react";

export function StatusMailDrawer({ onClose }: { orderData: unknown; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-[rgba(26,31,46,0.42)] px-4 pt-12" onClick={onClose}>
      <section className="w-full max-w-[560px] rounded-[18px] border border-[var(--ci-border)] bg-[var(--ci-surface)] p-6 shadow-[0_12px_32px_rgba(20,15,5,0.08)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-[var(--ci-ink)]">Status-Mail ist noch nicht freigegeben</h2>
            <p className="mt-2 text-sm text-[var(--ci-ink-3)]">
              Versand, Vorlage, Empfängerberechtigung und Empfangsquittung benötigen einen gemeinsamen Serververtrag. Es wird keine E-Mail vorbereitet oder versendet.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--ci-ink-3)] hover:bg-[var(--ci-surface-soft)]" aria-label="Schließen">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
