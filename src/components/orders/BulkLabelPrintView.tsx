"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  title: string;
  task?: string;
  parts: Record<string, unknown>[];
  intakeDate?: string;
  createdAt?: string;
}

interface BulkLabelPrintViewProps {
  orders: Order[];
  onClose?: () => void;
  onPrintComplete?: () => void;
}

export function BulkLabelPrintView({ orders, onClose }: BulkLabelPrintViewProps) {
  if (orders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl border border-amber-500/40 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
            <div>
              <h3 className="text-xl font-bold text-navy-900">Sammeldruck noch nicht freigegeben</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {orders.length} ausgewählte Aufträge bleiben unverändert. Der Druckweg wird erst nach einem belegten QR-, PDF- und Druckquittungs-Vertrag aktiviert.
              </p>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-muted hover:bg-neutral-gray-100">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {onClose && (
          <Button type="button" onClick={onClose} className="mt-6 w-full bg-navy-900 text-white">
            Schließen
          </Button>
        )}
      </div>
    </div>
  );
}
