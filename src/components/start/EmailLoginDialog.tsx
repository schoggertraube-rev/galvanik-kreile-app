"use client";

import { login } from "@/app/actions/auth";
import { useTransition } from "react";

export function EmailLoginDialog({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      // The server action owns both success and failure redirects. Do not
      // swallow its redirect signal or an unexpected transport failure.
      await login(formData);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm" data-testid="email-login-dialog">
      <div className="bg-white rounded-3xl shadow-elevated border border-neutral-gray-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-bg-app-soft px-6 py-5 border-b border-neutral-gray-100 flex items-center justify-between">
          <div>
            <p className="font-bold text-navy-900 text-sm">System Login</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Mit E-Mail anmelden</p>
          </div>
          <button type="button" aria-label="Schließen" onClick={onClose} className="text-text-muted hover:text-navy-900 text-2xl leading-none cursor-pointer">×</button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <input
                id="email"
                name="email"
                type="email"
                placeholder="E-Mail Adresse"
                required
                className="w-full bg-bg-app border border-neutral-gray-100 text-navy-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-600 focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-2">
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Passwort"
                required
                className="w-full bg-bg-app border border-neutral-gray-100 text-navy-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-600 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-navy-900 hover:bg-navy-700 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isPending ? "Lädt..." : "Einloggen"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
