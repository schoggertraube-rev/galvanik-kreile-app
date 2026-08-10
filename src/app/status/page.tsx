import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const foundationAvailability = "NOT_AVAILABLE";

export default function StatusPage() { return <FoundationUnavailable />; }
