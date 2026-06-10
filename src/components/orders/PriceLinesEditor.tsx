import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';

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
    loadLines();
  }, [orderId, itemId]);

  const loadLines = async () => {
    setLoading(true);
    let query = supabase.from('price_lines').select('*').eq('order_id', orderId);
    if (itemId) query = query.eq('item_id', itemId);
    
    const { data } = await query.order('sort_order', { ascending: true });
    setLines(data || []);
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
      await supabase.from('price_lines').insert(payload);
    } else {
      await supabase.from('price_lines').update(payload).eq('id', editingId);
    }
    
    setEditingId(null);
    loadLines();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Position löschen?')) {
      await supabase.from('price_lines').delete().eq('id', id);
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

  if (loading) return <div className="text-sm text-[var(--ci-ink-3)]">Lade Preispositionen...</div>;

  return (
    <div className="space-y-3">
      {lines.map(line => (
        <div key={line.id} className="flex items-center gap-3 p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg">
          {editingId === line.id ? (
            <div className="flex-1 flex gap-2">
              <input value={formData.position_text} onChange={e => setFormData({...formData, position_text: e.target.value})} className="flex-1 p-2 bg-[var(--ci-bg)] border border-[var(--ci-border)] rounded text-sm outline-none" placeholder="Bezeichnung" />
              <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: Number(e.target.value)})} className="w-16 p-2 bg-[var(--ci-bg)] border border-[var(--ci-border)] rounded text-sm outline-none" />
              <input type="number" step="0.01" value={formData.unit_price_eur} onChange={e => setFormData({...formData, unit_price_eur: Number(e.target.value)})} className="w-24 p-2 bg-[var(--ci-bg)] border border-[var(--ci-border)] rounded text-sm outline-none" />
              <button onClick={handleSave} className="p-2 text-[var(--ci-success)] hover:bg-[var(--ci-surface-soft)] rounded"><Save className="w-4 h-4"/></button>
              <button onClick={() => setEditingId(null)} className="p-2 text-[var(--ci-ink-3)] hover:bg-[var(--ci-surface-soft)] rounded"><X className="w-4 h-4"/></button>
            </div>
          ) : (
            <>
              <div className="flex-1">
                <div className="text-sm text-[var(--ci-ink)]">{line.position_text}</div>
                <div className="text-[11px] text-[var(--ci-ink-3)]">{Number(line.qty)}x à {Number(line.unit_price_eur).toFixed(2)} €</div>
              </div>
              <div className="text-sm font-medium text-[var(--ci-ink)]">
                {Number(line.unit_total_eur || (line.qty * line.unit_price_eur)).toFixed(2)} €
              </div>
              <button onClick={() => startEdit(line)} className="p-1.5 text-[var(--ci-ink-3)] hover:text-[var(--ci-ink)] hover:bg-[var(--ci-surface-soft)] rounded transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
              <button onClick={() => handleDelete(line.id)} className="p-1.5 text-[var(--ci-danger)] hover:bg-[var(--ci-danger-soft)] rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
            </>
          )}
        </div>
      ))}

      {editingId === 'new' ? (
        <div className="flex items-center gap-2 p-3 bg-[var(--ci-surface)] border border-[var(--ci-accent)] rounded-lg">
          <input value={formData.position_text} onChange={e => setFormData({...formData, position_text: e.target.value})} className="flex-1 p-2 bg-[var(--ci-bg)] border border-[var(--ci-border)] rounded text-sm outline-none focus:border-[var(--ci-accent)]" placeholder="Neue Position..." />
          <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: Number(e.target.value)})} className="w-16 p-2 bg-[var(--ci-bg)] border border-[var(--ci-border)] rounded text-sm outline-none focus:border-[var(--ci-accent)]" placeholder="Menge" />
          <input type="number" step="0.01" value={formData.unit_price_eur} onChange={e => setFormData({...formData, unit_price_eur: Number(e.target.value)})} className="w-24 p-2 bg-[var(--ci-bg)] border border-[var(--ci-border)] rounded text-sm outline-none focus:border-[var(--ci-accent)]" placeholder="Preis €" />
          <button onClick={handleSave} className="p-2 text-[var(--ci-success)] hover:bg-[var(--ci-surface-soft)] rounded"><Save className="w-4 h-4"/></button>
          <button onClick={() => setEditingId(null)} className="p-2 text-[var(--ci-ink-3)] hover:bg-[var(--ci-surface-soft)] rounded"><X className="w-4 h-4"/></button>
        </div>
      ) : (
        <button onClick={startNew} className="w-full flex justify-center items-center gap-1.5 p-3 text-sm text-[var(--ci-ink-2)] border border-dashed border-[var(--ci-border)] rounded-lg hover:bg-[var(--ci-surface)] hover:text-[var(--ci-ink)] transition-colors">
          <Plus className="w-4 h-4"/> Position hinzufügen
        </button>
      )}
    </div>
  );
}
