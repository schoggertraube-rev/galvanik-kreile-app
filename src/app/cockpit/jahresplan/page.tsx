import { redirect } from "next/navigation";

/** Jahresplanung remains unavailable until its authorized atomic persistence adapter is complete. */
export default function JahresplanPage() {
  redirect("/performance");
}
