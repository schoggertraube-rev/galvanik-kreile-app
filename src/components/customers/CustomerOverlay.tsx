"use client";

import React, { useState } from 'react';
import { useCustomerOverlay } from './useCustomerOverlay';

import { X } from 'lucide-react';
import { useOverlayStore } from '@/lib/overlayStore';
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
  const { data: customerData, isLoading } = useCustomerData(customerId);
  const stack = useOverlayStore(state => state.stack);
  const [activeTab, setActiveTab] = useState('ueberblick');

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
            ) : customerData?.kpi ? (
              <CustomerHeader data={customerData.kpi} />
            ) : (
              <div className="h-16 flex items-center justify-center text-red-500">Kunde nicht gefunden.</div>
            )}
          </div>
        </div>

        {customerData && (
          <>
            <div className="px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-bg)]">
              {customerData.kpi ? <CustomerKpiRow data={customerData.kpi} /> : (
                <div className="bg-bg-app-soft/30 border border-neutral-gray-100 rounded-2xl p-6 text-center">
                  <p className="text-sm font-medium text-text-muted">Noch keine belastbaren Analysedaten vorhanden</p>
                </div>
              )}
            </div>

            {/* Main Tabs UI */}
            <div className="flex-1 bg-[var(--ci-surface)] flex flex-col min-h-[600px] max-h-[80vh] overflow-hidden">
              <div className="w-full overflow-x-auto border-b border-[var(--ci-border)] bg-[var(--ci-bg)] scrollbar-hide">
                <div className="flex gap-1 px-4 py-2 min-w-max">
                  {['Ueberblick', 'Auftraege', 'Historie', 'Teile', 'Preise', 'Kommunikation', 'Reklamationen', 'Rechnungen', 'Fotos', 'Analyse', 'Notizen'].map((tabName) => (
                    <button
                      key={tabName}
                      onClick={() => setActiveTab(tabName.toLowerCase())}
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
                {activeTab === 'preise' && <CustomerPricesTab customerId={customerId!} />}
                {activeTab === 'kommunikation' && <CustomerCommunicationTab customerId={customerId!} />}
                {activeTab === 'reklamationen' && <CustomerComplaintsTab customerId={customerId!} />}
                {activeTab === 'rechnungen' && <CustomerInvoicesTab customerId={customerId!} />}
                {activeTab === 'fotos' && <CustomerPhotosTab customerId={customerId!} />}
                {activeTab === 'analyse' && <CustomerAnalysisTab customerId={customerId!} customerData={customerData} />}
                {activeTab === 'notizen' && <CustomerNotesTab customerId={customerId!} customerData={customerData} />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
