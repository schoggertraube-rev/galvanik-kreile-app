import { redirect } from "next/navigation";

/**
 * Redirect /finanzen → /buchhaltung für Abwärtskompatibilität.
 * Die alte /finanzen-Route leitet jetzt auf das neue Buchhaltungsmodul um.
 */
export default function FinanzenRedirectPage() {
  redirect("/buchhaltung");
}
