'use client';

import React, { useState } from 'react';
import { saveShipmentInfo, sendShippingConfirmation } from '@/features/orders/shipment.actions';

interface VersandVariantProps {
  orderId: string;
  customerName: string;
}

export const VersandVariant: React.FC<VersandVariantProps> = ({ orderId, customerName }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [carrier, setCarrier] = useState('dhl');
  const [tracking, setTracking] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const handleSend = async () => {
    setSaving(true);
    setError(null);
    setMissingFields([]);
    
    const resSave = await saveShipmentInfo({ orderId, carrier, trackingNumber: tracking });
    
    if (!resSave.success) {
      setError(resSave.error || 'Fehler beim Speichern der Versanddaten');
      // @ts-ignore
      if (resSave.missingFields) setMissingFields(resSave.missingFields);
      setSaving(false);
      return;
    }
    
    const res = await sendShippingConfirmation({ orderId, carrier, trackingNumber: tracking });
    setSaving(false);
    if (!res.success) setError('Fehler beim Versand');
  };

  return (
    <div className="station-context" style={{ background: 'var(--ci-bg)', border: '1px solid var(--ci-border)', borderLeft: '3px solid var(--ci-success)', borderRadius: '18px', padding: '16px 18px', marginTop: '4px' }}>
      <div className="sc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="sc-title" style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)' }}>
          Versand & Übergabe · <span className="sc-station" style={{ color: 'var(--ci-success)' }}>Warenausgang</span>
        </div>
        <div className="sc-toggle" style={{ display: 'flex', gap: '4px' }}>
          <button className="sc-collapse" onClick={() => setCollapsed(!collapsed)} style={{ background: 'transparent', border: '1px solid var(--ci-border)', color: 'var(--ci-ink-3)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer' }}>
            <i className={`ti ${collapsed ? 'ti-chevron-down' : 'ti-chevron-up'}`} style={{ fontSize: '12px' }}></i> {collapsed ? 'ausklappen' : 'einklappen'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="erf-block" style={{ marginBottom: '14px' }}>
            <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500 }}>Lieferart wählen</div>
            <div className="vers-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div 
                className={`vers-card ${carrier === 'dhl' ? 'active' : ''}`} 
                onClick={() => setCarrier('dhl')}
                style={{ background: 'var(--ci-surface)', border: `1px solid ${carrier === 'dhl' ? 'var(--ci-accent)' : 'var(--ci-border)'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer' }}
              >
                <div className="vers-icon" style={{ fontSize: '22px', color: carrier === 'dhl' ? 'var(--ci-accent)' : 'var(--ci-ink-2)', marginBottom: '6px' }}><i className="ti ti-truck"></i></div>
                <div className="vers-title" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ci-ink)' }}>Versand DHL</div>
                <div className="vers-sub" style={{ fontSize: '11px', color: 'var(--ci-ink-3)', marginTop: '2px' }}>Kundenwunsch · Adresse vorhanden</div>
              </div>
              <div 
                className={`vers-card ${carrier === 'selbstabholung' ? 'active' : ''}`} 
                onClick={() => setCarrier('selbstabholung')}
                style={{ background: 'var(--ci-surface)', border: `1px solid ${carrier === 'selbstabholung' ? 'var(--ci-accent)' : 'var(--ci-border)'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer' }}
              >
                <div className="vers-icon" style={{ fontSize: '22px', color: carrier === 'selbstabholung' ? 'var(--ci-accent)' : 'var(--ci-ink-2)', marginBottom: '6px' }}><i className="ti ti-shopping-bag"></i></div>
                <div className="vers-title" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ci-ink)' }}>Selbstabholung</div>
                <div className="vers-sub" style={{ fontSize: '11px', color: 'var(--ci-ink-3)', marginTop: '2px' }}>Kunde erscheint vor Ort</div>
              </div>
            </div>
          </div>

          {carrier === 'dhl' && (
            <>
              <div className="erf-block" style={{ marginBottom: '14px' }}>
                <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500 }}>Versanddetails</div>
                <div style={{ background: 'var(--ci-surface)', border: '1px solid var(--ci-border)', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--ci-ink-3)', textTransform: 'uppercase' }}>Empfänger</div>
                      <div style={{ marginTop: '2px' }}>{customerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ci-ink-2)' }}>Anschrift 1</div>
                      <div style={{ fontSize: '11px', color: 'var(--ci-ink-2)' }}>12345 Stadt</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--ci-ink-3)', textTransform: 'uppercase' }}>Paket</div>
                      <div style={{ marginTop: '2px', fontFamily: 'var(--ci-font-serif)' }}>2 Kolli · 12,4 kg</div>
                      <div style={{ fontSize: '11px', color: 'var(--ci-ink-2)' }}>Versicherung 1.500 €</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="erf-block" style={{ marginBottom: '14px' }}>
                <div className="erf-block-label" style={{ fontSize: '11px', color: 'var(--ci-ink-2)', marginBottom: '8px', fontWeight: 500 }}>Tracking</div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--ci-surface)', border: '1px solid var(--ci-border)', borderRadius: '10px', padding: '10px 12px' }}>
                  <input 
                    type="text" 
                    placeholder="Tracking-Nr. eintragen" 
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--ci-font-sans)', fontSize: '12px', color: 'var(--ci-ink)', outline: 'none' }} 
                  />
                  <button className="erf-book-btn" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', background: 'var(--ci-ink)', color: 'var(--ci-surface)', border: 'none', cursor: 'pointer' }}><i className="ti ti-printer" style={{ fontSize: '11px' }}></i> Label drucken</button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{ color: 'var(--ci-danger)', fontSize: '12px', marginBottom: '10px', background: '#ffebee', padding: '10px', borderRadius: '8px', border: '1px solid #ffcdd2' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Fehler: {error}</strong>
              {missingFields.length > 0 && (
                <div>
                  <p style={{ margin: '4px 0' }}>Die Versandadresse ist unvollständig. Folgende Felder fehlen:</p>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {missingFields.map(field => <li key={field}>{field}</li>)}
                  </ul>
                  <p style={{ margin: '6px 0 0', fontWeight: 500 }}>Bitte wählen Sie "Selbstabholung" oder ergänzen Sie die Stammdaten des Kunden.</p>
                </div>
              )}
            </div>
          )}

          <div className="erf-foot" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--ci-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="erf-foot-sum" style={{ fontSize: '11px', color: 'var(--ci-ink-3)' }}>
              Versandkosten netto
              <b style={{ fontFamily: 'var(--ci-font-serif)', fontSize: '16px', color: 'var(--ci-ink)', fontWeight: 500, display: 'block', marginTop: '2px' }}>14,90 €</b>
              <span style={{ fontSize: '10px' }}>DHL Paket bis 31,5 kg + Versicherung</span>
            </div>
            <button 
              className="erf-book-btn" 
              onClick={handleSend}
              disabled={saving}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: 'var(--ci-ink)', color: 'var(--ci-surface)', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              <i className="ti ti-send" style={{ fontSize: '11px' }}></i> {saving ? 'Sendet...' : 'Versandmail senden'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
