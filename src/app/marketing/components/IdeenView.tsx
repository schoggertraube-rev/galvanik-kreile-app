"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { floatIn } from "./SubNav";
import type { AktionVorschlag, SortMode } from "@/lib/marketing/marketingTypes";

export function IdeenView({
  vorschlaege, activeSort, onSort
}: {
  vorschlaege: AktionVorschlag[];
  activeSort: SortMode;
  onSort: (s: SortMode) => void;
}) {
  return (
    <motion.div key="ideen" initial="hidden" animate="visible" exit="exit">
      <motion.div custom={0} variants={floatIn}>
        <div className="mk-filterchips">
          {([["output", "Meister Output"], ["einfach", "Am einfachsten"], ["relevanz", "Relevanz"], ["kanal", "Nach Kanal"]] as [SortMode, string][]).map(([key, label]) => (
            <span key={key} className={`mk-fchip ${activeSort === key ? 'active' : ''}`} onClick={() => onSort(key)}>
              {label}
            </span>
          ))}
        </div>
      </motion.div>
      <motion.div custom={1} variants={floatIn} className={vorschlaege.length > 0 ? "mk-ideas" : ""}>
        {vorschlaege.length > 0 ? (
          vorschlaege.map(v => (
            <IdeenCard key={v.id} vorschlag={v} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-gray-100 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-neutral-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0012 3z"/></svg>
            </div>
            <h3 className="font-serif text-lg font-bold mb-2">Derzeit keine neuen Ideen.</h3>
            <p className="text-sm text-text-muted max-w-sm">Es liegen keine gespeicherten Vorschläge vor. Eine automatische Vorschlagsgenerierung ist nicht angebunden.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function IdeenCard({ vorschlag }: { vorschlag: AktionVorschlag }) {
  const kanalClass = vorschlag.kanal === 'instagram' ? 'ig' : vorschlag.kanal === 'email' ? 'mail' : 'google';
  const kanalIcon = vorschlag.kanal === 'instagram'
    ? <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
    : vorschlag.kanal === 'email'
    ? <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    : <svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 00-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 00-8-8z" /></svg>;

  return (
    <motion.div className="mk-idea" whileHover={{ y: -3 }}>
      <div className="mk-idea-head">
        <div className={`mk-idea-chan ${kanalClass}`}>{kanalIcon}</div>
        <h4>{vorschlag.titel}</h4>
      </div>
      <p>{vorschlag.quelle || vorschlag.begruendung}</p>
      <div className="mk-idea-foot">
        <span className="mk-idea-score">Wirkung <b>{vorschlag.score === null ? 'nicht bewertet' : vorschlag.score}</b></span>
        <Link href="/marketing/aktion" className="mk-idea-btn">
          In Aktionsliste prüfen
        </Link>
      </div>
    </motion.div>
  );
}
