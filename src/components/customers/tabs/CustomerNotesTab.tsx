import React, { useState } from 'react';
import { updateCustomerCore } from '@/features/customers/customer-card/customerCard.actions';
import { Edit2, Save, FileText } from 'lucide-react';

export function CustomerNotesTab({ customerId, customerData }: { customerId: string, customerData: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(customerData?.internalNotes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await updateCustomerCore(customerId, { internalNotes: notes });
    if (res.ok) {
      setIsEditing(false);
      // In a real app we'd mutate SWR or update a higher state, but we'll let it be for now
    } else {
      alert("Fehler beim Speichern");
    }
    setIsSaving(false);
  };

  if (!customerData) return <div className="p-4 text-gray-500">Lade Notizen...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--ci-orange)]" /> Interne Notizen
        </h3>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Bearbeiten
          </button>
        ) : (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[var(--ci-blue)] text-white hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Speichert...' : 'Speichern'}
          </button>
        )}
      </div>

      <div className="bg-orange-50/30 border border-orange-100 rounded-xl p-6 min-h-[300px]">
        {isEditing ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-full min-h-[250px] p-4 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[var(--ci-orange)] resize-y bg-white text-gray-900"
            placeholder="Interne Notizen, Warnungen, Besonderheiten zum Kunden..."
            autoFocus
          />
        ) : (
          <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed">
            {notes || (
              <span className="text-gray-400 italic">Keine internen Notizen hinterlegt.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
