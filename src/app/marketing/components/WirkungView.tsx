"use client";

import React from "react";
import { motion } from "framer-motion";
import { floatIn } from "./SubNav";
import type { LernInsight } from "@/lib/marketing/marketingTypes";

export function WirkungView({ insights }: { insights: LernInsight[] }) {
  return (
    <motion.div key="wirkung" initial="hidden" animate="visible" exit="exit">
      <div className="mk-learns">
        {insights.map((insight, i) => (
          <motion.div key={insight.id} custom={i} variants={floatIn} className="mk-lcard">
            <span className="mk-lcard-badge">âœ¦ Gelernt</span>
            <h4>{insight.titel}</h4>
            <p dangerouslySetInnerHTML={{ __html: insight.text }} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
