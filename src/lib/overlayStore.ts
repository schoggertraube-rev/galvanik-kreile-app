import { create } from 'zustand';

export type OverlayType =
  | { type: 'quote'; id: string }
  | { type: 'order'; id: string;focus?:'photos' }
  | { type: 'customer'; id: string; prefill?: unknown }
  | { type: 'item'; orderId: string; itemId: string }
  | { type: 'invoice'; id: string }
  | { type: 'payment'; orderId: string };

interface OverlayState {
  stack: OverlayType[];

  openQuote: (id: string) => void;
  openOrder: (id: string,focus?:'photos') => void;
  openCustomer: (id: string,prefill?:unknown) => void;
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
  // The visible Dialog/Seitenblatt owns Esc and invokes pop after its dirty guard.

  return {
    stack: [],

    openQuote: (id) => set((state) => ({stack:[...state.stack,{type:'quote',id}]})),
    openOrder: (id,focus) => set((state) => ({
      stack: [...state.stack, { type: 'order', id,...(focus?{focus}:{}) }],
      orderStack: [...state.orderStack, id]
    })),
    openCustomer: (id,prefill) => set((state) => ({ stack: [...state.stack, { type: 'customer', id, prefill }] })),
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
