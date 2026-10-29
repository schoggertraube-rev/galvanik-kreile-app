export function WerkstattLoading() {
  return (
    <div className="mock-kreile-phillip-home">
      <div className="body scroll" role="region" aria-label="Werkstatt" aria-busy="true">
        <h1 className="day-title" style={{ margin: 0 }}>Werkstatt</h1>
        <div className="pri">
          <div className="pi" role="status" aria-live="polite" data-testid="werkstatt-loading">
            <span className="pi-dot"></span>
            <div className="pi-main"><div className="pi-s">Werkstattdaten werden geladen.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
