'use client';

import React, { useState } from 'react';
import { transitionOrderProcess } from '@/app/actions/orders.actions';
import { Loader2 } from 'lucide-react';

interface WareneingangActiveProps {
  orderId: string;
}

export const WareneingangActive: React.FC<WareneingangActiveProps> = ({ orderId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await transitionOrderProcess({ orderId, action: 'complete' });
      if (!res.ok) {
        setError(res.error || res.message || 'Fehler bei der Übergabe');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="station-context highlight" style={{ background: 'var(--ci-bg)', border: '1px solid var(--ci-border)', borderLeft: '3px solid var(--ci-accent)', borderRadius: '18px', padding: '16px 18px', marginTop: '4px' }}>
      <div className="sc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="sc-title" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)' }}>
          Wareneingang
        </div>
      </div>

      <div className="erf-block" style={{ marginBottom: '14px' }}>
        <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '12px', fontWeight: 500 }}>
          Vollständigkeitsprüfung
        </div>
        <p style={{ fontSize: '13px', color: 'var(--ci-ink-3)', marginBottom: '16px' }}>
          Bitte prüfen Sie, ob Auftrag und Kunde korrekt erfasst sind, alle Teile mit Mengen und Fotos dokumentiert sind und das gewünschte Zielfinish festgelegt wurde.
        </p>

        {error && <div style={{ color: 'var(--ci-danger)', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}

        <button 
          onClick={handleTransition}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: 'var(--ci-ink)', color: 'var(--ci-surface)', borderRadius: '8px', fontWeight: 500, fontSize: '13px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Wird übergeben...' : 'Übergabe zur Bearbeitung'}
        </button>
      </div>
    </div>
  );
};
