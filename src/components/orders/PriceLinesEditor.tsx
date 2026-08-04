import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { getPriceLinesDb, createPriceLineDb, updatePriceLineDb, deletePriceLineDb } from '@/app/actions/price-lines.actions';

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
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  
  const [formData, setFormData] = useState({
    position_text: '',
    qty: 1,
    unit_price_eur: 0
  });

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

  const loadLines = async () => {
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

  const handleSave = async () => {
    const payload = {
      order_id: orderId,
      item_id: itemId || null,
      position_text: formData.position_text,
      qty: formData.qty,
      unit_price_eur: formData.unit_price_eur,
      unit_total_eur: formData.qty * formData.unit_price_eur
    };

    if (editingId === 'new') {
      await createPriceLineDb(payload);
    } else {
      await updatePriceLineDb(editingId as string, payload);
    }
    
    setEditingId(null);
    loadLines();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Position löschen?')) {
      await deletePriceLineDb(id);
      loadLines();
    }
  };

  const startEdit = (line: PriceLine) => {
    setEditingId(line.id);
    setFormData({
      position_text: line.position_text,
      qty: Number(line.qty) || 1,
      unit_price_eur: Number(line.unit_price_eur) || 0
    });
  };

  const startNew = () => {
    setEditingId('new');
    setFormData({ position_text: '', qty: 1, unit_price_eur: 0 });
  };

  if (loading) return <div className="text-sm -()">Lade Preispositionen...</div>;

  return (
    <div className="space-y-3">
      {lines.map(line => (
        <div key={line.id} className="flex items-center gap-3 p-3 -() border -() rounded-lg">
          {editingId === line.id ? (
            <div className="flex-1 flex gap-2">
              <input value={formData.position_text} onChange={e => setFormData({...formData, position_text: e.target.value})} className="flex-1 p-2 -() border -() rounded text-sm outline-none" placeholder="Bezeichnung" />
              <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: Number(e.target.value)})} className="w-16 p-2 -() border -() rounded text-sm outline-none" />
              <input type="number" step="0.01" value={formData.unit_price_eur} onChange={e => setFormData({...formData, unit_price_eur: Number(e.target.value)})} className="w-24 p-2 -() border -() rounded text-sm outline-none" />
              <button onClick={handleSave} className="p-2 -() hover:-() rounded"><Save className="w-4 h-4"/></button>
              <button onClick={() => setEditingId(null)} className="p-2 -() hover:-() rounded"><X className="w-4 h-4"/></button>
            </div>
          ) : (
            <>
              <div className="flex-1">
                <div className="text-sm -()">{line.position_text}</div>
                <div className="text-[11px] -()">{Number(line.qty)}x à {Number(line.unit_price_eur).toFixed(2)} €</div>
              </div>
              <div className="text-sm font-medium -()">
                {Number(line.unit_total_eur || (line.qty * line.unit_price_eur)).toFixed(2)} €
              </div>
              <button onClick={() => startEdit(line)} className="p-1.5 -() hover:-() hover:-() rounded transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
              <button onClick={() => handleDelete(line.id)} className="p-1.5 -() hover:-() rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
            </>
          )}
        </div>
      ))}

      {editingId === 'new' ? (
        <div className="flex items-center gap-2 p-3 -() border -() rounded-lg">
          <input value={formData.position_text} onChange={e => setFormData({...formData, position_text: e.target.value})} className="flex-1 p-2 -() border -() rounded text-sm outline-none focus:-()" placeholder="Neue Position..." />
          <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: Number(e.target.value)})} className="w-16 p-2 -() border -() rounded text-sm outline-none focus:-()" placeholder="Menge" />
          <input type="number" step="0.01" value={formData.unit_price_eur} onChange={e => setFormData({...formData, unit_price_eur: Number(e.target.value)})} className="w-24 p-2 -() border -() rounded text-sm outline-none focus:-()" placeholder="Preis €" />
          <button onClick={handleSave} className="p-2 -() hover:-() rounded"><Save className="w-4 h-4"/></button>
          <button onClick={() => setEditingId(null)} className="p-2 -() hover:-() rounded"><X className="w-4 h-4"/></button>
        </div>
      ) : (
        <button onClick={startNew} className="w-full flex justify-center items-center gap-1.5 p-3 text-sm -() border border-dashed -() rounded-lg hover:-() hover:-() transition-colors">
          <Plus className="w-4 h-4"/> Position hinzufügen
        </button>
      )}
    </div>
  );
}
