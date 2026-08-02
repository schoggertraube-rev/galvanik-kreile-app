'use client';

import React from 'react';
import { ErfassungVariant } from './variants/ErfassungVariant';
import { VersandVariant } from './variants/VersandVariant';
import { WareneingangReadOnly } from './variants/WareneingangReadOnly';
import { WareneingangActive } from './variants/WareneingangActive';
import { getStationVariant } from '@/lib/orders/stationContext';
import { STATION_ORDER } from '@/lib/orders/stationContext';

interface StationContextBlockProps {
  orderId: string;
  activeStation: string;
  orderCurrentStation: string;
  orderRevenue: number;
  orderMargin: number;
  orderMarginPercent: number;
  customerName: string;
  isOrderCompleted: boolean;
  canViewFinance: boolean;
}

export const StationContextBlock: React.FC<StationContextBlockProps> = ({
  orderId,
  activeStation,
  orderCurrentStation,
  orderRevenue,
  orderMargin,
  orderMarginPercent,
  customerName,
  isOrderCompleted,
  canViewFinance,
}) => {
  const currentStationIndex = Math.max(
    0,
    STATION_ORDER.indexOf(orderCurrentStation as (typeof STATION_ORDER)[number]),
  );
  const activeStationIndex = Math.max(
    0,
    STATION_ORDER.indexOf(activeStation as (typeof STATION_ORDER)[number]),
  );

  const variant = getStationVariant(activeStation, currentStationIndex, activeStationIndex, isOrderCompleted);

  return (
    <div className="section" style={{ marginBottom: '22px' }}>
      {variant === 'wareneingang_readonly' && (
        <WareneingangReadOnly 
          orderId={orderId} 
          orderRevenue={orderRevenue}
          orderMargin={orderMargin}
          orderMarginPercent={orderMarginPercent}
          canViewFinance={canViewFinance}
        />
      )}
      
      {variant === 'versand' && (
        <VersandVariant 
          orderId={orderId} 
          customerName={customerName}
        />
      )}
      
      {variant === 'erfassung' && canViewFinance && (
        <ErfassungVariant 
          orderId={orderId} 
          station={activeStation} 
          orderRevenue={orderRevenue}
          orderMargin={orderMargin}
          orderMarginPercent={orderMarginPercent}
        />
      )}

      {variant === 'erfassung' && !canViewFinance && (
        <div className="station-context" id="station-context-block">
          Kosten- und Preiserfassung ist für diese Rolle nicht freigegeben.
        </div>
      )}
      
      {variant === 'wareneingang_active' && (
        <WareneingangActive orderId={orderId} />
      )}
    </div>
  );
};
