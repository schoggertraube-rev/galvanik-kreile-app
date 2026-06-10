import React, { useState, useEffect } from 'react';
import { X, Save, Box, Trash2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { PriceLinesEditor } from './PriceLinesEditor';

interface ItemDrawerProps {
  orderId: string;
  itemId: string | 'new' | null;
  existingItems: any[];
  onClose: () => void;
  onSaved: () => void;
}

const WORKFLOW_TEMPLATES = [
  { label: 'Standard Zink (Trommel)', sequence: ['wareneingang', 'entfettung', 'zink_trommel', 'passivierung', 'trocknung', 'warenausgang'] },
  { label: 'Gestell Nickel', sequence: ['wareneingang', 'schleiferei', 'entfettung', 'nickel_gestell', 'trocknung', 'warenausgang'] },
  { label: 'Nur Entlacken', sequence: ['wareneingang', 'entlackung', 'warenausgang'] }
];

export function ItemDrawer({ orderId, itemId, existingItems, onClose, onSaved }: ItemDrawerProps) {
  const isNew = itemId === 'new';
  const existingItem = isNew ? null : existingItems.find(i => i.id === itemId);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 1,
    material: '',
    surfaceRequested: '',
    stationSequence: [] as string[],
    internalNotes: ''
  });

  useEffect(() => {
    if (existingItem) {
      setFormData({
        name: existingItem.name || '',
        quantity: existingItem.quantity || 1,
        material: existingItem.material || '',
        surfaceRequested: existingItem.surfaceRequested || '',
        stationSequence: existingItem.stationSequence || [],
        internalNotes: existingItem.internalNotes || ''
      });
    }
  }, [existingItem]);

  const handleSave = async () => {
    setLoading(true);
    
    // In Phase 5 we should fetch customer_id from order
    const { data: orderData } = await supabase.from('orders').select('customer_id').eq('id', orderId).single();

    const payload = {
      order_id: orderId,
      customer_id: orderData?.customer_id || 'unknown',
      name: formData.name,
      quantity: formData.quantity,
      material: formData.material,
      surface_requested: formData.surfaceRequested,
      station_sequence: formData.stationSequence,
      internal_notes: formData.internalNotes
    };

    if (isNew) {
      await supabase.from('items').insert({ ...payload, current_station_id: 'wareneingang' });
    } else {
      await supabase.from('items').update(payload).eq('id', itemId);
    }
    
    setLoading(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (confirm('Dieses Teil wirklich löschen?')) {
      setLoading(true);
      await supabase.from('items').delete().eq('id', itemId);
      setLoading(false);
      onSaved();
      onClose();
    }
  };

  const applyTemplate = (sequence: string[]) => {
    setFormData(prev => ({ ...prev, stationSequence: sequence }));
  };

  if (!itemId) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--ci-bg)] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <h2 className="text-lg font-medium text-[var(--ci-ink)] flex items-center gap-2">
            <Box className="w-5 h-5"/>
            {isNew ? 'Neues Teil anlegen' : 'Teil bearbeiten'}
          </h2>
          <button onClick={onClose} className="p-2 text-[var(--ci-ink-3)] hover:text-[var(--ci-ink)] transition-colors rounded-full hover:bg-[var(--ci-surface-soft)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-1 block">Bezeichnung</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm outline-none focus:border-[var(--ci-accent)]"
                placeholder="z.B. Kotflügel Vorne Links"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-1 block">Menge</label>
                <input 
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm outline-none focus:border-[var(--ci-accent)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-1 block">Material (Ausgang)</label>
                <input 
                  value={formData.material}
                  onChange={e => setFormData({...formData, material: e.target.value})}
                  className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm outline-none focus:border-[var(--ci-accent)]"
                  placeholder="z.B. Stahl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-1 block">Zielfinish (Oberfläche)</label>
              <input 
                value={formData.surfaceRequested}
                onChange={e => setFormData({...formData, surfaceRequested: e.target.value})}
                className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm outline-none focus:border-[var(--ci-accent)]"
                placeholder="z.B. Zink Blau"
              />
            </div>
          </div>

          <div className="border-t border-[var(--ci-border)] pt-6">
            <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-3 block">Stationen-Abfolge (Workflow)</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {WORKFLOW_TEMPLATES.map((tmpl, i) => (
                <button 
                  key={i} 
                  onClick={() => applyTemplate(tmpl.sequence)}
                  className="text-xs px-3 py-1.5 rounded-md bg-[var(--ci-surface-soft)] border border-[var(--ci-border)] hover:bg-[var(--ci-border)] transition-colors text-[var(--ci-ink-2)]"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
            
            <div className="p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg min-h-[60px] text-sm text-[var(--ci-ink-2)] flex flex-wrap gap-2">
              {formData.stationSequence.length === 0 ? (
                <span className="text-[var(--ci-ink-3)]">Keine Stationen definiert...</span>
              ) : (
                formData.stationSequence.map((station, i) => (
                  <span key={i} className="flex items-center gap-1 bg-[var(--ci-bg)] px-2 py-1 rounded border border-[var(--ci-border)]">
                    <span className="text-[10px] text-[var(--ci-ink-3)]">{i+1}.</span> {station}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-[var(--ci-border)] pt-6">
             <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-1 block">Interne Notizen</label>
             <textarea 
                value={formData.internalNotes}
                onChange={e => setFormData({...formData, internalNotes: e.target.value})}
                className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm outline-none focus:border-[var(--ci-accent)] min-h-[100px]"
                placeholder="Besonderheiten für die Produktion..."
              />
          </div>

          {!isNew && (
            <div className="border-t border-[var(--ci-border)] pt-6">
              <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)] mb-3 flex items-center gap-1">
                <Tag className="w-3 h-3"/> Preispositionen (für dieses Teil)
              </label>
              <PriceLinesEditor orderId={orderId} itemId={itemId} />
            </div>
          )}

        </div>

        <div className="p-6 border-t border-[var(--ci-border)] bg-[var(--ci-surface)] flex gap-3">
          {!isNew && (
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="p-3 bg-[var(--ci-danger-soft)] text-[var(--ci-danger)] rounded-xl hover:bg-opacity-80 transition-colors"
              title="Teil löschen"
            >
              <Trash2 className="w-5 h-5"/>
            </button>
          )}
          <button 
            onClick={handleSave} 
            disabled={loading || !formData.name}
            className="flex-1 flex items-center justify-center gap-2 bg-[var(--ci-ink)] text-[var(--ci-surface)] py-3 rounded-xl font-medium hover:bg-opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? "Speichern..." : <><Save className="w-5 h-5"/> {isNew ? 'Anlegen' : 'Speichern'}</>}
          </button>
        </div>

      </div>
    </div>
  );
}
