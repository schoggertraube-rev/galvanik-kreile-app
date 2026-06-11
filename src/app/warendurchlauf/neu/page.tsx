"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NeuerWarendurchlaufPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Weiterleitung zum Wareneingang mit geöffnetem Erfassungs-Modal (Scan/Manuell wird dort über UI gewählt)
    router.replace("/warendurchlauf/wareneingang");
  }, [router]);

  return <div className="p-8 text-center text-text-muted">Weiterleitung zum Wareneingang...</div>;
}
