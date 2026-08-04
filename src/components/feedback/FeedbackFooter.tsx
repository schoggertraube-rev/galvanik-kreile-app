"use client";

import { useState } from "react";

interface FeedbackFooterProps {
  pageTitle?: string;
  route?: string;
  variant?: "compact" | "full";
}

export function FeedbackFooter({ pageTitle, route, variant = "full" }: FeedbackFooterProps) {
  void route;
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleFeedback = () => {
    if (!feedback.trim()) return;
    setFeedbackSent(true);
    setFeedback("");
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const isCompact = variant === "compact";

  return (
    <section className={`bg-bg-app-soft border border-neutral-gray-200 rounded-3xl p-6 text-center w-full ${isCompact ? 'max-w-xl' : 'max-w-2xl'} mx-auto mt-8`}>
      <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-bold font-serif text-navy-900 mb-2`}>
        Was fehlt auf dieser Seite{pageTitle ? ` (${pageTitle})` : ''}?
      </h3>
      <p className="text-xs text-text-muted mb-4">Feedback-Speicherung wird später angebunden (Demo-Modus).</p>
      
      <div className="flex gap-2">
        <input 
          type="text" 
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="Z.B. Ich brauche einen Knopf für..." 
          className="flex-1 rounded-xl border border-neutral-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
          onKeyDown={e => e.key === 'Enter' && handleFeedback()}
        />
        <button 
          onClick={handleFeedback}
          className="bg-navy-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-navy-800 transition-colors shrink-0 cursor-pointer"
        >
          {feedbackSent ? "Gemerkt!" : "Merken"}
        </button>
      </div>
    </section>
  );
}
