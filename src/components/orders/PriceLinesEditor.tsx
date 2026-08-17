import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { getPriceLinesDb } from '@/app/actions/price-lines.actions';

interface PriceLinesEditorProps {
  orderId: string;
  itemId?: string; // If provided, filters/adds to this specific item
}

interface PriceLine {
  id: string;
  position_text: string;
  qty: number;
  unit_price_eur: number;
  unit_total_eur?: number;
}

export function PriceLinesEditor({ orderId, itemId }: PriceLinesEditorProps) {
  const [lines, setLines] = useState<PriceLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInitialLines = async () => {
      setLoading(true);
      const result = await getPriceLinesDb(orderId, itemId);
      if (result.ok && result.data) {
        // Map from DB schema format (camelCase) back to component format (snake_case)
        const mapped = result.data.map(r => ({
          id: r.id,
          position_text: r.positionText,
          qty: r.qty,
          unit_price_eur: r.unitPriceEur,
          unit_total_eur: r.unitTotalEur
        }));
        setLines(mapped);
      } else {
        setLines([]);
      }
      setLoading(false);
    };

    loadInitialLines();
  }, [orderId, itemId]);

  if (loading) return <div className="text-sm -()">Lade Preispositionen...</div>;

  return (
    <div className="space-y-3">
      {lines.map(line => (
        <div key={line.id} className="flex items-center gap-3 p-3 -() border -() rounded-lg">
          <>
              <div className="flex-1">
                <div className="text-sm -()">{line.position_text}</div>
                <div className="text-[11px] -()">{Number(line.qty)}x à {Number(line.unit_price_eur).toFixed(2)} €</div>
              </div>
              <div className="text-sm font-medium -()">
                {Number(line.unit_total_eur || (line.qty * line.unit_price_eur)).toFixed(2)} €
              </div>
              <button disabled title="NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." className="p-1.5 -() rounded transition-colors opacity-50"><Edit2 className="w-3.5 h-3.5"/></button>
              <button disabled title="NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." className="p-1.5 -() rounded transition-colors opacity-50"><Trash2 className="w-3.5 h-3.5"/></button>
              <span className="text-[10px] -()">NOT_AVAILABLE</span>
            </>
        </div>
      ))}

      <button disabled title="NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." className="w-full flex justify-center items-center gap-1.5 p-3 text-sm -() border border-dashed -() rounded-lg opacity-50">
        <Plus className="w-4 h-4"/> Position hinzufügen (NOT_AVAILABLE)
      </button>
    </div>
  );
}
