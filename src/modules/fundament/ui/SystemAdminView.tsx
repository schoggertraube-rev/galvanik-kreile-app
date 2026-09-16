import Link from "next/link";
import styles from "./SystemAdminView.module.css";

export type SystemAdminViewProps = {
  displayName: "Gregor";
  responsibility: "Systemadministrator";
};

export function SystemAdminView({ displayName, responsibility }: SystemAdminViewProps) {
  return (
    <main className={styles.page} data-testid="gregor-system-admin">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Erhöhter Systemzugang</p>
        <h1>Systemadministration</h1>
        <p>Angemeldet als {displayName} · {responsibility}</p>
      </header>
      <section className={styles.status} aria-labelledby="admin-status-title">
        <div>
          <p className={styles.kicker}>Zugangsstatus</p>
          <h2 id="admin-status-title">Sitzung serverseitig bestätigt</h2>
        </div>
        <p>
          Dieser persönliche Zugang ist für kontrollierte Systempflege vorgesehen.
          Betriebliche Arbeit bleibt bei Rolf und Phillip.
        </p>
      </section>
      <nav aria-label="Reale Systemziele" className={styles.links}>
        <Link href="/orders">Aufträge ansehen</Link>
        <Link href="/customers">Kunden ansehen</Link>
      </nav>
    </main>
  );
}
