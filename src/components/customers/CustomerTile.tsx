import React from 'react';
import { useCustomerOverlay } from './useCustomerOverlay';

interface CustomerTileProps {
  customer: {
    id: string;
    name: string;
    company_name?: string | null;
    classification?: string | null;
  };
}

export function CustomerTile({ customer }: CustomerTileProps) {
  const { open } = useCustomerOverlay();

  const displayName = customer.company_name || customer.name;

  return (
    <div 
      onClick={() => open(customer.id)}
      className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col gap-2"
    >
      <div className="flex justify-between items-start">
        <h4 className="font-semibold text-gray-900">{displayName}</h4>
        {customer.classification && (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
            Klasse {customer.classification}
          </span>
        )}
      </div>
      {/* KPI placeholders */}
      <div className="text-sm text-gray-500">
        Klick für Details
      </div>
    </div>
  );
}
