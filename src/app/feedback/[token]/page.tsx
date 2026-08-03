"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, CheckCircle2 } from "lucide-react";

export default function FeedbackPage({ params }: { params: { token: string } }) {
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [googleClicked, setGoogleClicked] = useState(false);

  const handleSubmit = async () => {
    // In a real implementation this would post the feedback to the API using the token
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center p-6 text-text-main">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-black/5 relative overflow-hidden">
        
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-navy-900 rounded-full flex items-center justify-center">
            <span className="text-white font-serif font-bold text-xl">K</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-serif text-center mb-2">Wie zufrieden sind Sie?</h1>
              <p className="text-text-muted text-center mb-8 text-sm">
                Ihr Auftrag ist abgeschlossen. Wir hoffen, das Ergebnis gefällt Ihnen!
              </p>
              
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => { setRating(star); setTimeout(() => setStep(2), 500); }}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      rating >= star ? "bg-amber-100 text-amber-500 scale-110" : "bg-neutral-gray-100 text-text-muted hover:bg-neutral-gray-200"
                    }`}
                  >
                    <Star className="w-7 h-7" fill={rating >= star ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-serif text-center mb-2">Teilen Sie Ihre Meinung</h1>
              <p className="text-text-muted text-center mb-6 text-sm">
                Ihre Rückmeldung hilft uns, noch besser zu werden.
              </p>

              <textarea 
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Was hat Ihnen besonders gefallen? Was können wir verbessern?"
                className="w-full h-32 p-4 bg-bg-app rounded-xl border border-border focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none resize-none mb-6 text-sm"
              />

              {rating >= 4 && (
                <div className="bg-blue-50 text-blue-900 p-4 rounded-xl mb-6 text-sm">
                  <p className="font-bold mb-2">Google Bewertung</p>
                  <p className="mb-3">Unterstützen Sie unseren Handwerksbetrieb mit einer kurzen Bewertung auf Google!</p>
                  <a 
                    href="https://g.page/r/kreile/review" 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={() => setGoogleClicked(true)}
                    className="inline-block bg-white text-blue-700 px-4 py-2 rounded-lg font-bold shadow-sm"
                  >
                    Auf Google bewerten
                  </a>
                </div>
              )}

              <button 
                onClick={handleSubmit}
                className="w-full bg-navy-900 text-white font-bold py-4 rounded-xl hover:bg-navy-800 transition-colors"
              >
                Feedback absenden
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-serif mb-2">Vielen Dank!</h1>
              <p className="text-text-muted text-sm">
                Ihre Bewertung wurde erfolgreich übermittelt. Wir schätzen Ihre Zeit und Ihr Vertrauen in unser Handwerk.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      
      <div className="mt-8 text-xs text-text-muted opacity-50">
        Galvanik Kreile GmbH • Frankfurt am Main
      </div>
    </div>
  );
}
