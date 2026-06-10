import { create } from 'zustand';

export type OverlayType = 
  | { type: 'order'; id: string }
  | { type: 'customer'; id: string }
  | { type: 'item'; orderId: string; itemId: string }
  | { type: 'invoice'; id: string }
  | { type: 'payment'; orderId: string };

interface OverlayState {
  stack: OverlayType[];
  
  openOrder: (id: string) => void;
  openCustomer: (id: string) => void;
  openItem: (orderId: string, itemId: string) => void;
  openInvoice: (id: string) => void;
  openPayment: (orderId: string) => void;
  
  pop: () => void;
  closeAll: () => void;

  // Legacy compat functions temporarily
  orderStack: string[];
  pushOrder: (id: string) => void;
  popOrder: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => {
  // Listen to ESC key globally to pop the stack
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        set((state) => {
          if (state.stack.length > 0) {
            return { 
              stack: state.stack.slice(0, -1),
              // Sync legacy
              orderStack: state.stack.length > 0 && state.stack[state.stack.length-1].type === 'order' 
                ? state.orderStack.slice(0, -1) 
                : state.orderStack
            };
          }
          return state;
        });
      }
    });
  }

  return {
    stack: [],
    
    openOrder: (id) => set((state) => ({ 
      stack: [...state.stack, { type: 'order', id }],
      orderStack: [...state.orderStack, id]
    })),
    openCustomer: (id) => set((state) => ({ stack: [...state.stack, { type: 'customer', id }] })),
    openItem: (orderId, itemId) => set((state) => ({ stack: [...state.stack, { type: 'item', orderId, itemId }] })),
    openInvoice: (id) => set((state) => ({ stack: [...state.stack, { type: 'invoice', id }] })),
    openPayment: (orderId) => set((state) => ({ stack: [...state.stack, { type: 'payment', orderId }] })),
    
    pop: () => set((state) => ({ 
      stack: state.stack.slice(0, -1),
      orderStack: state.stack.length > 0 && state.stack[state.stack.length-1].type === 'order' 
        ? state.orderStack.slice(0, -1) 
        : state.orderStack
    })),
    closeAll: () => set({ stack: [], orderStack: [] }),

    // Legacy compat
    orderStack: [],
    pushOrder: (id) => set((state) => ({ 
      stack: [...state.stack, { type: 'order', id }],
      orderStack: [...state.orderStack, id] 
    })),
    popOrder: () => set((state) => ({ 
      stack: state.stack.slice(0, -1),
      orderStack: state.orderStack.slice(0, -1) 
    }))
  };
});
