"use client";

import { useOverlayStore } from '@/lib/overlayStore';

export function useCustomerOverlay() {
  const openCustomer = useOverlayStore(state => state.openCustomer);
  const closeCustomer = useOverlayStore(state => state.pop);
  
  const stack = useOverlayStore(state => state.stack);
  // Find the most recent customer overlay in the stack
  const currentCustomer = [...stack].reverse().find(item => item.type === 'customer');
  
  return {
    customerId: currentCustomer && 'id' in currentCustomer ? currentCustomer.id : null,
    open: openCustomer,
    close: closeCustomer,
    isOpen: !!currentCustomer
  };
}
