import React from 'react';
import { Tag } from 'lucide-react';

export function CustomerTagEditor({ customerId }: { customerId: string }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-[var(--ci-ink)] flex items-center gap-2">
        <Tag className="w-5 h-5 text-gray-400" /> Tags
      </h3>
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">Stammkunde</span>
        <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-sm border border-gray-200 hover:bg-gray-100 cursor-pointer">+ Tag hinzufügen</span>
      </div>
    </div>
  );
}
