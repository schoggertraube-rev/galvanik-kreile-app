import { redirect } from "next/navigation";

/** Legacy cockpit mixed measured data with synthetic fallbacks. */
export default function CockpitPage() {
  redirect("/performance");
}
