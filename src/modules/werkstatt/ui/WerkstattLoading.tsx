import styles from "./WerkstattView.module.css";

export function WerkstattLoading() {
  return (
    <section className={styles.screen} aria-labelledby="werkstatt-loading-title" aria-busy="true">
      <div className={styles.inner}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Werkstatt</p>
          <h1 id="werkstatt-loading-title" className={styles.title}>Werkstatt</h1>
          <p className={styles.lead}>Eingang prüfen, Arbeit sicher übergeben.</p>
        </header>

        <div className={styles.loadingPanel} role="status" aria-live="polite" data-testid="werkstatt-loading">
          <p className={styles.loadingStatus}>Werkstattdaten werden geladen.</p>
          <div className={styles.skeleton} aria-hidden="true" />
          <div className={styles.skeletonWide} aria-hidden="true" />
          <div className={styles.skeletonWide} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
