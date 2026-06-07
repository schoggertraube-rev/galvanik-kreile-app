"use client";

import React from "react";
import { motion } from "framer-motion";
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
      <motion.div custom={1} variants={floatIn} className="mk-ideas">
        {vorschlaege.map(v => (
          <IdeenCard key={v.id} vorschlag={v} />
        ))}
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
        <span className="mk-idea-score">Wirkung <b>{vorschlag.score}</b></span>
        <button className="mk-idea-btn">
          {vorschlag.kanal === 'email' ? 'Mails prÃ¼fen' : vorschlag.kanal === 'google' ? 'Anfragen' : 'Ãœbernehmen'}
        </button>
      </div>
    </motion.div>
  );
}
