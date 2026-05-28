"use client";

interface EntityDecisionOverlayProps {
  onClose: () => void;
  onSelectOrder: () => void;
  onSelectCustomer: () => void;
  customerName: string;
  orderId: string;
}

export function EntityDecisionOverlay({
  onClose,
  onSelectOrder,
  onSelectCustomer,
  customerName,
  orderId
}: EntityDecisionOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-navy-900 mb-6 text-center">Was möchtest du sehen?</h3>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={onSelectOrder}
            className="w-full bg-navy-900 text-white font-bold py-4 rounded-xl hover:bg-navy-700 transition-colors active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <span className="text-sm">Auftrag ansehen</span>
            <span className="text-[10px] text-white/60">#{orderId.slice(0, 8).toUpperCase()}</span>
          </button>
          
          <button
            onClick={onSelectCustomer}
            className="w-full bg-white border-2 border-navy-900 text-navy-900 font-bold py-4 rounded-xl hover:bg-neutral-gray-100 transition-colors active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <span className="text-sm">Kunde ansehen</span>
            <span className="text-[10px] text-text-muted">{customerName}</span>
          </button>
        </div>

        <button 
          onClick={onClose}
          className="mt-6 w-full text-center text-sm font-bold text-text-muted hover:text-navy-900 py-2"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
