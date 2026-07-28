import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function PrintQueuePage() {
  return (
    <FoundationUnavailable
      title="Druck-Warteschlange ist noch nicht freigegeben"
      reason="Ein Druckvorgang wurde bisher nur lokal aus der Oberfläche entfernt und nicht nachweisbar im Produktbestand gespeichert. Deshalb wird kein erledigter Druckzustand behauptet."
    />
  );
}
