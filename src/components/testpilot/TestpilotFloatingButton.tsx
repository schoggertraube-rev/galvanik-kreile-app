"use client";

import React, { useState } from 'react';
import { useTestpilot } from '@/components/testpilot/TestpilotProvider';
import { TestpilotOverlay } from '@/components/testpilot/TestpilotOverlay';
import { usePermissions } from '@/lib/auth/PermissionsContext';

export function TestpilotFloatingButton() {
  const { isActive } = useTestpilot();
  const { hasPermission } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const canUseTestpilot = hasPermission('perm_sys_diag');

  if (!canUseTestpilot || !isActive) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-testpilot-ignore="true"
        className="fixed bottom-6 right-6 z-9998 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-4 py-3 flex items-center gap-2 font-medium transition-transform hover:scale-105 active:scale-95"
      >
        <span className="text-xl">🐛</span>
        <span className="hidden sm:inline">Testnotiz</span>
      </button>

      {isOpen && <TestpilotOverlay onClose={() => setIsOpen(false)} />}
    </>
  );
}
