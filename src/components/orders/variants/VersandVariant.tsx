'use client';

import React from 'react';
import { FoundationUnavailable } from '@/components/foundation/FoundationUnavailable';

interface VersandVariantProps {
  orderId: string;
  customerName: string;
}

export const VersandVariant: React.FC<VersandVariantProps> = (props) => {
  void props;
  return <FoundationUnavailable />;
};
