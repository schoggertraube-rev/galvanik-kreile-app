import styles from "./PhillipWerkstatt.module.css";

export default function WarendurchlaufLoading() {
  return (
    <section className={styles.screen} aria-labelledby="werkstatt-loading-title" aria-busy="true">
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Phillip · Werkstatt</p>
            <h1 id="werkstatt-loading-title" className={styles.title}>Werkstatt</h1>
            <p className={styles.lead}>Eingang prüfen, Arbeit sicher übergeben.</p>
          </div>
          <div className={styles.heroSignal} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </header>

        <div
          className={styles.loadingWorkbench}
          data-testid="phillip-loading-workbench"
          role="status"
          aria-live="polite"
        >
          <div className={styles.loadingPanel}>
            <header className={styles.loadingPanelHeader}>
              <p className={styles.panelKicker}>Annahme</p>
              <h2 className={styles.sectionTitle}>Wareneingang</h2>
            </header>
            <p className={styles.loadingStatus}>Werkstattdaten werden geladen.</p>
            <div className={styles.skeleton} aria-hidden="true" />
            <div className={styles.skeletonWide} aria-hidden="true" />
          </div>
          <div className={`${styles.loadingPanel} ${styles.loadingPanelSecondary}`} aria-hidden="true">
            <header className={styles.loadingPanelHeader}>
              <p className={styles.panelKicker}>Ein Galvanik-Schritt</p>
              <h2 className={styles.sectionTitle}>Galvanik / fertig gemeldet</h2>
            </header>
            <div className={styles.skeleton} />
            <div className={styles.skeletonWide} />
          </div>
        </div>
      </div>
    </section>
  );
}
