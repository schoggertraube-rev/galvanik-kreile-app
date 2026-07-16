import React, { useEffect, useState } from "react";
import { getPriceLinesDb } from "@/app/actions/price-lines.actions";

interface PriceLinesEditorProps {
  orderId: string;
  itemId?: string;
}

interface PriceLine {
  id: string;
  positionText: string;
  qty: string | null;
  unitPriceEur: string;
  unitTotalEur: string | null;
}

export function PriceLinesEditor({ orderId, itemId }: PriceLinesEditorProps) {
  const [lines, setLines] = useState<PriceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadLines = async () => {
      setLoading(true);
      setError(null);
      const result = await getPriceLinesDb(orderId, itemId);
      if (!active) return;
      if (result.ok) {
        setLines(result.data);
      } else {
        setLines([]);
        setError(result.message);
      }
      setLoading(false);
    };

    void loadLines();
    return () => {
      active = false;
    };
  }, [orderId, itemId]);

  if (loading) {
    return <div className="text-sm text-text-muted">Preispositionen werden geladen …</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Preispositionen sind echt und mandantengebunden lesbar. Änderungen bleiben gesperrt, bis der versionierte Freigabe-, Idempotenz- und Auditvertrag angebunden ist.
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error-red/30 bg-error-red/5 p-3 text-xs text-error-red">
          {error}
        </div>
      )}

      {lines.map((line) => {
        const quantity = Number(line.qty ?? 0);
        const unitPrice = Number(line.unitPriceEur);
        const total = line.unitTotalEur == null ? quantity * unitPrice : Number(line.unitTotalEur);
        return (
          <div key={line.id} className="flex items-center gap-3 rounded-lg border border-neutral-gray-200 bg-white p-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-navy-900">{line.positionText}</div>
              <div className="text-[11px] text-text-muted">{quantity} × {unitPrice.toFixed(2)} €</div>
            </div>
            <div className="text-sm font-medium text-navy-900">{total.toFixed(2)} €</div>
          </div>
        );
      })}

      {!error && lines.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-gray-200 p-3 text-xs text-text-muted">
          Keine bestätigten Preispositionen hinterlegt.
        </div>
      )}
    </div>
  );
}
