"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React from 'react';
import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';

export default function LieferantenPage() {
  return (
    <div className="min-h-screen bg-bg-app-soft p-8">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Lieferanten',href:'/lieferanten'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <div className="max-w-4xl mx-auto space-y-6">
        
        
        <div className="bg-white rounded-3xl p-8 border shadow-xs text-center space-y-4">
          <Building2 className="w-16 h-16 text-neutral-gray-400 mx-auto" />
          <h1 className="text-2xl font-bold font-serif text-navy-900">Lieferanten & Partner</h1>
          <p className="text-text-muted max-w-md mx-auto">
            Hier entsteht das zentrale Verzeichnis für alle Lieferanten, Dienstleister und Partner. Aktuell sind noch keine Stammdaten hinterlegt.
          </p>
          
          <div className="pt-8">
            <Link href="/buchhaltung/kosten" className="inline-flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-navy-800 transition-colors">
              Zurück zur Buchhaltung <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
