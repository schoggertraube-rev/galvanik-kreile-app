"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React from 'react';
import { use } from 'react';
import Link from 'next/link';
import { Building2, Package, FileText } from 'lucide-react';

export default function LieferantenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-bg-app-soft p-8">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Lieferanten',href:'/lieferanten'}, {label:'[id]'}]} />
        <BackButton label="Lieferanten" href="/lieferanten" />
      </div>
      
      <div className="max-w-5xl mx-auto space-y-6">
        
        
        <div className="bg-white rounded-3xl p-8 border shadow-xs">
          <div className="flex items-center gap-4 border-b pb-6 mb-6">
            <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-navy-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-navy-900">Lieferanten-Profil</h1>
              <p className="text-sm font-bold text-text-muted">ID: {id}</p>
            </div>
          </div>
          
          <div className="text-center py-12 space-y-4">
            <p className="text-text-muted">Noch keine Stammdaten oder verknüpfte Belege vorhanden.</p>
            
            <div className="flex justify-center gap-4 pt-4">
              <Link href="/buchhaltung/kosten" className="inline-flex items-center gap-2 bg-white border border-neutral-gray-200 text-navy-900 px-6 py-3 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors">
                <FileText className="w-4 h-4" /> Belege (Kosten)
              </Link>
              <Link href="/lager" className="inline-flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-navy-800 transition-colors">
                <Package className="w-4 h-4" /> Zum Lager
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
