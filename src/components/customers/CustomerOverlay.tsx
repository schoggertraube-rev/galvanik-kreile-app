"use client";

import React, { useEffect, useState } from 'react';
import { useCustomerOverlay } from './useCustomerOverlay';
import { useCustomerKpi } from './useCustomerKpi';
import { X } from 'lucide-react';
import { CustomerTagEditor } from './CustomerTagEditor';
import { useOverlayStore } from '@/lib/overlayStore';
import { CustomerHeader } from './CustomerHeader';
import { CustomerKpiRow } from './CustomerKpiRow';
import { CustomerStammdaten } from './CustomerStammdaten';
import { CustomerAuftraege } from './CustomerAuftraege';
import { CustomerZahlungen } from './CustomerZahlungen';
import { CustomerKommHistorie } from './CustomerKommHistorie';
import { CustomerQuickActions } from './CustomerQuickActions';

export function CustomerOverlay() {
  const { customerId, isOpen, close } = useCustomerOverlay();
  const { data: kpiData, isLoading } = useCustomerKpi(customerId);
  const stack = useOverlayStore(state => state.stack);

  if (!isOpen) return null;

  // Calculate dynamic z-index based on stack position
  const stackIndex = stack.findLastIndex(item => item.type === 'customer' && item.id === customerId);
  const zIndex = 1000 + stackIndex * 10;

  return (
    <div 
      className="fixed inset-0 bg-[rgba(26,31,46,0.42)] backdrop-blur-[8px] flex items-start justify-center pt-12 pb-12 overflow-y-auto" 
      style={{ zIndex }}
      onClick={close}
    >
      <div 
        className="w-full max-w-[1200px] mx-4 bg-[var(--ci-surface)] rounded-[18px] border border-[var(--ci-border)] shadow-[0_1px_2px_rgba(20,15,5,0.04),0_12px_32px_rgba(20,15,5,0.08)]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header Close Button */}
        <div className="flex justify-end p-4 border-b border-[var(--ci-border)] relative">
          <button 
            onClick={close}
            className="p-2 hover:bg-[var(--ci-bg)] rounded-full transition-colors absolute right-4 top-4"
          >
            <X className="w-5 h-5 text-[var(--ci-ink-3)]" />
          </button>
          
          <div className="w-full">
            {isLoading ? (
              <div className="h-16 animate-pulse bg-gray-200 rounded"></div>
            ) : kpiData ? (
              <CustomerHeader data={kpiData} />
            ) : (
              <div className="h-16 flex items-center justify-center text-red-500">Kunde nicht gefunden.</div>
            )}
          </div>
        </div>

        {kpiData && (
          <>
            <div className="px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-bg)]">
              <CustomerKpiRow data={kpiData} />
            </div>

            <div className="flex flex-col lg:flex-row min-h-[600px]">
              {/* Left Column (Content) */}
              <div className="flex-1 border-r border-[var(--ci-border)] p-6 space-y-8">
                <CustomerStammdaten customerId={customerId!} />
                <CustomerTagEditor customerId={customerId!} />
                <CustomerAuftraege customerId={customerId!} />
                <CustomerZahlungen customerId={customerId!} />
              </div>

              {/* Right Column (Sidebar) */}
              <div className="w-full lg:w-96 bg-[var(--ci-bg)] flex flex-col">
                <div className="p-6 border-b border-[var(--ci-border)]">
                  <CustomerQuickActions customerId={customerId!} />
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                  <CustomerKommHistorie customerId={customerId!} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
