import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FeedbackPage from "../page";
import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

const source = readFileSync(
  resolve(process.cwd(), "src", "app", "feedback", "[token]", "page.tsx"),
  "utf8",
);

describe("W2C-B2M6 feedback denial", () => {
  it("renders the actual exported page as the shared FoundationUnavailable denial", () => {
    expect(renderToStaticMarkup(<FeedbackPage />)).toBe(
      renderToStaticMarkup(<FoundationUnavailable />),
    );
  });

  it("keeps the route a synchronous fail-closed wrapper with no former feedback flow", () => {
    expect(source).toBe(`import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FeedbackPage() {
  return <FoundationUnavailable />;
}
`);
    expect(source).not.toMatch(
      /["']use client["']|\bparams?\b|\btoken\b|useState|useEffect|handleSubmit|setTimeout|textarea|<button|g\.page|Feedback absenden|Vielen Dank|erfolgreich übermittelt|Auftrag ist abgeschlossen|import\(|require\(|fetch\(|axios|https?:\/\//i,
    );
  });
});
