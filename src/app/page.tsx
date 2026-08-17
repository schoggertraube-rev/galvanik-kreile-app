import { redirect } from "next/navigation";

/** Root route redirects to the primary operational entry point. */
export default function RootPage() {
  redirect("/warendurchlauf");
}
