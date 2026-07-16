"use client";

import React, { useState } from 'react';
import { useCustomerOverlay } from './useCustomerOverlay';

import { X } from 'lucide-react';
import { useOverlayStore } from '@/lib/overlayStore';
import { AppOverlayPortal } from '@/components/ui/AppOverlayPortal';
import { CustomerHeader } from './CustomerHeader';
import { CustomerKpiRow } from './CustomerKpiRow';
import { CustomerOverviewTab } from './tabs/CustomerOverviewTab';
import { CustomerOrdersTab } from './tabs/CustomerOrdersTab';
import { CustomerHistorySimilarTab } from './tabs/CustomerHistorySimilarTab';
import { CustomerItemsProfileTab } from './tabs/CustomerItemsProfileTab';
import { CustomerPricesTab } from './tabs/CustomerPricesTab';
import { CustomerCommunicationTab } from './tabs/CustomerCommunicationTab';
import { CustomerComplaintsTab } from './tabs/CustomerComplaintsTab';
import { CustomerInvoicesTab } from './tabs/CustomerInvoicesTab';
import { CustomerPhotosTab } from './tabs/CustomerPhotosTab';
import { CustomerAnalysisTab } from './tabs/CustomerAnalysisTab';
import { CustomerNotesTab } from './tabs/CustomerNotesTab';
import { useCustomerData } from './useCustomerData';

export function CustomerOverlay() {
  const { customerId, isOpen, close } = useCustomerOverlay();
  const { data: customerData, isLoading, error } = useCustomerData(customerId);
  const stack = useOverlayStore(state => state.stack);
  const [tabSelection, setTabSelection] = useState<{ customerId: string | null; tab: string }>({
    customerId: null,
    tab: "ueberblick",
  });
  const activeTab = tabSelection.customerId === customerId ? tabSelection.tab : "ueberblick";

  if (!isOpen) return null;

  // Calculate dynamic z-index based on stack position
  const stackIndex = stack.findLastIndex(item => item.type === 'customer' && item.id === customerId);
  const zIndex = 1000 + stackIndex * 10;
  const capabilities = customerData?.capabilities ?? {
    canViewPrices: false,
    canCreateOrders: false,
    canManageQa: false,
  };
  const tabs = [
    'Ueberblick',
    'Auftraege',
    'Historie',
    'Teile',
    ...(capabilities.canViewPrices ? ['Preise'] : []),
    'Kommunikation',
    ...(capabilities.canManageQa ? ['Reklamationen'] : []),
    ...(capabilities.canViewPrices ? ['Rechnungen'] : []),
    'Fotos',
    ...(capabilities.canViewPrices && customerData?.kpi ? ['Analyse'] : []),
    'Notizen',
  ];

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000]">
        <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={close}></div>
        <div 
          className="relative h-full w-full flex items-center justify-center p-0 sm:p-3" 
          style={{ zIndex }}
        >
          <div 
            className={`
              flex flex-col bg-[var(--ci-surface)] shadow-lg
              fixed inset-0 h-[100dvh] w-screen overflow-y-auto
              sm:inset-auto sm:relative
              sm:w-full sm:md:w-[92vw] sm:lg:max-w-6xl
              sm:h-auto sm:max-h-[92dvh]
              sm:rounded-2xl
            `}
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
            ) : error ? (
              <div role="alert" className="flex h-16 items-center justify-center text-red-600">{error}</div>
            ) : customerData ? (
              <CustomerHeader customer={customerData} capabilities={capabilities} />
            ) : (
              <div className="h-16 flex items-center justify-center text-red-500">Kunde nicht gefunden.</div>
            )}
          </div>
        </div>

        {customerData && (
          <>
            <div className="px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-bg)]">
              {capabilities.canViewPrices && customerData.kpi ? <CustomerKpiRow data={customerData.kpi} /> : (
                <div className="bg-bg-app-soft/30 border border-neutral-gray-100 rounded-2xl p-6 text-center">
                  <p className="text-sm font-medium text-text-muted">{capabilities.canViewPrices ? "Analysedaten sind noch nicht belastbar verbunden." : "Finanzkennzahlen sind für diese Rolle nicht freigegeben."}</p>
                </div>
              )}
            </div>

            {/* Main Tabs UI */}
            <div className="flex-1 bg-[var(--ci-surface)] flex flex-col min-h-[600px] max-h-[80vh] overflow-hidden">
              <div className="w-full overflow-x-auto border-b border-[var(--ci-border)] bg-[var(--ci-bg)] scrollbar-hide">
                <div className="flex gap-1 px-4 py-2 min-w-max">
                  {tabs.map((tabName) => (
                    <button
                      key={tabName}
                      onClick={() => setTabSelection({ customerId, tab: tabName.toLowerCase() })}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        activeTab === tabName.toLowerCase() 
                          ? 'bg-white text-[var(--ci-ink)] shadow-sm' 
                          : 'text-[var(--ci-ink-3)] hover:text-[var(--ci-ink)] hover:bg-gray-50'
                      }`}
                    >
                      {tabName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                {activeTab === 'ueberblick' && <CustomerOverviewTab customerId={customerId!} customerData={customerData} />}
                {activeTab === 'auftraege' && <CustomerOrdersTab customerId={customerId!} />}
                {activeTab === 'historie' && <CustomerHistorySimilarTab customerId={customerId!} />}
                {activeTab === 'teile' && <CustomerItemsProfileTab customerId={customerId!} />}
                {activeTab === 'preise' && capabilities.canViewPrices && <CustomerPricesTab key={customerId} customerId={customerId!} />}
                {activeTab === 'kommunikation' && <CustomerCommunicationTab customerId={customerId!} />}
                {activeTab === 'reklamationen' && capabilities.canManageQa && <CustomerComplaintsTab customerId={customerId!} />}
                {activeTab === 'rechnungen' && capabilities.canViewPrices && <CustomerInvoicesTab key={customerId} customerId={customerId!} />}
                {activeTab === 'fotos' && <CustomerPhotosTab customerId={customerId!} />}
                {activeTab === 'analyse' && capabilities.canViewPrices && customerData.kpi && <CustomerAnalysisTab customerId={customerId!} customerData={customerData} />}
                {activeTab === 'notizen' && <CustomerNotesTab customerId={customerId!} customerData={customerData} />}
              </div>
            </div>
          </>
        )}
          </div>
        </div>
      </div>
    </AppOverlayPortal>
  );
}
