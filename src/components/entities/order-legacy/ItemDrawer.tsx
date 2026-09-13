import React, { useState } from 'react';
import { X, Save, Box, Trash2, Tag } from 'lucide-react';
import { PriceLinesEditor } from './PriceLinesEditor';
import type { getOrderWithDetails } from '@/lib/repositories/orderQueries';

type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderWithDetails>>>;
type EditableOrderItem = OrderDetails['items'][number];

interface ItemFormData {
  name: string;
  quantity: number;
  material: string;
  surfaceRequested: string;
  stationSequence: string[];
  internalNotes: string;
}

interface ItemDrawerProps {
  orderId: string;
  itemId: string | 'new' | null;
  existingItems: EditableOrderItem[];
  onClose: () => void;
  onSaved: () => void;
}

const WORKFLOW_TEMPLATES = [
  { label: 'Standard Zink (Trommel)', sequence: ['wareneingang', 'entfettung', 'zink_trommel', 'passivierung', 'trocknung', 'warenausgang'] },
  { label: 'Gestell Nickel', sequence: ['wareneingang', 'schleiferei', 'entfettung', 'nickel_gestell', 'trocknung', 'warenausgang'] },
  { label: 'Nur Entlacken', sequence: ['wareneingang', 'entlackung', 'warenausgang'] }
];

function toStationSequence(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((station): station is string => typeof station === 'string') : [];
}

function toItemForm(item: EditableOrderItem | undefined): ItemFormData {
  if (!item) {
    return {
      name: '',
      quantity: 1,
      material: '',
      surfaceRequested: '',
      stationSequence: [],
      internalNotes: '',
    };
  }

  return {
    name: item.name,
    quantity: item.quantity,
    material: item.material ?? '',
    surfaceRequested: item.surfaceRequested ?? '',
    stationSequence: toStationSequence(item.stationSequence),
    internalNotes: item.internalNotes ?? '',
  };
}

export function ItemDrawer({ orderId, itemId, existingItems, onClose }: ItemDrawerProps) {
  const isNew = itemId === 'new';
  const existingItem = isNew ? null : existingItems.find(i => i.id === itemId);

  const [formData, setFormData] = useState<ItemFormData>(() => toItemForm(existingItem ?? undefined));

  if (!itemId) return null;

  return (
    <div className="fixed inset-0 z-1000 bg-[rgba(26,31,46,0.42)] backdrop-blur-sm flex items-start justify-center pt-12 pb-12 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[560px] mx-4 -() rounded-[18px] border -() shadow-[0_1px_2px_rgba(20,15,5,0.04),0_12px_32px_rgba(20,15,5,0.08)]" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between px-6 py-4 border-b -() -()">
          <h2 className="text-lg font-medium -() flex items-center gap-2">
            <Box className="w-5 h-5"/>
            {isNew ? 'Neues Teil anlegen' : 'Teil bearbeiten'}
          </h2>
          <button onClick={onClose} className="p-2 -() hover:-() transition-colors rounded-full hover:-()">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider -() mb-1 block">Bezeichnung</label>
              <input 
                value={formData.name}
                disabled
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 -() border -() rounded-lg text-sm outline-none focus:-()"
                placeholder="z.B. Kotflügel Vorne Links"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider -() mb-1 block">Menge</label>
                <input 
                  type="number"
                  min="1"
                  value={formData.quantity}
                  disabled
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  className="w-full p-3 -() border -() rounded-lg text-sm outline-none focus:-()"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider -() mb-1 block">Material (Ausgang)</label>
                <input 
                  value={formData.material}
                  disabled
                  onChange={e => setFormData({...formData, material: e.target.value})}
                  className="w-full p-3 -() border -() rounded-lg text-sm outline-none focus:-()"
                  placeholder="z.B. Stahl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider -() mb-1 block">Zielfinish (Oberfläche)</label>
              <input 
                value={formData.surfaceRequested}
                disabled
                onChange={e => setFormData({...formData, surfaceRequested: e.target.value})}
                className="w-full p-3 -() border -() rounded-lg text-sm outline-none focus:-()"
                placeholder="z.B. Zink Blau"
              />
            </div>
          </div>

          <div className="border-t -() pt-6">
            <label className="text-xs uppercase tracking-wider -() mb-3 block">Stationen-Abfolge (Workflow)</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {WORKFLOW_TEMPLATES.map((tmpl, i) => (
                <button 
                  key={i} 
                  disabled
                  className="text-xs px-3 py-1.5 rounded-md -() border -() hover:-() transition-colors -()"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
            
            <div className="p-3 -() border -() rounded-lg min-h-[60px] text-sm -() flex flex-wrap gap-2">
              {formData.stationSequence.length === 0 ? (
                <span className="-()">Keine Stationen definiert...</span>
              ) : (
                formData.stationSequence.map((station, i) => (
                  <span key={i} className="flex items-center gap-1 -() px-2 py-1 rounded border -()">
                    <span className="text-[10px] -()">{i+1}.</span> {station}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="border-t -() pt-6">
             <label className="text-xs uppercase tracking-wider -() mb-1 block">Interne Notizen</label>
             <textarea 
                value={formData.internalNotes}
                disabled
                onChange={e => setFormData({...formData, internalNotes: e.target.value})}
                className="w-full p-3 -() border -() rounded-lg text-sm outline-none focus:-() min-h-[100px]"
                placeholder="Besonderheiten für die Produktion..."
              />
          </div>

          {!isNew && (
            <div className="border-t -() pt-6">
              <label className="text-xs uppercase tracking-wider -() mb-3 flex items-center gap-1">
                <Tag className="w-3 h-3"/> Preispositionen (für dieses Teil)
              </label>
              <PriceLinesEditor orderId={orderId} itemId={itemId} />
            </div>
          )}

        </div>

        <div className="p-6 border-t -() -() flex gap-3">
          {!isNew && (
            <button 
              disabled
              className="p-3 -() -() rounded-xl hover:bg-opacity-80 transition-colors"
              title="Teil löschen (NOT_AVAILABLE)"
            >
              <Trash2 className="w-5 h-5"/>
              <span className="text-xs">Löschen (NOT_AVAILABLE)</span>
            </button>
          )}
          <button 
            disabled
            className="flex-1 flex items-center justify-center gap-2 -() -() py-3 rounded-xl font-medium hover:bg-opacity-90 disabled:opacity-50 transition-all"
          >
            <><Save className="w-5 h-5"/> {isNew ? 'Anlegen' : 'Speichern'} (NOT_AVAILABLE)</>
          </button>
        </div>

      </div>
    </div>
  );
}
