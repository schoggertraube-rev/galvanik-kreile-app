import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageView } from "@/hooks/usePageView";

const pathname = vi.hoisted(() => ({ value: "/start" }));
const trackUiEvent = vi.hoisted(() => vi.fn(() => ({ ok: false as const, error: "NOT_AVAILABLE" as const, message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag." as const })));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/lib/tracking/tracking", () => ({ trackUiEvent }));

function Harness() {
  usePageView();
  return <div>page-view-harness</div>;
}

describe("W2C-B2M5I usePageView real render", () => {
  beforeEach(() => {
    pathname.value = "/start";
    vi.clearAllMocks();
  });

  afterEach(() => {
    pathname.value = "/start";
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("tracks mount and route changes through the stable denial port", () => {
    const view = render(<Harness />);
    expect(trackUiEvent).toHaveBeenLastCalledWith("page_view", { route: "/start" });
    pathname.value = "/orders/42";
    view.rerender(<Harness />);
    expect(trackUiEvent).toHaveBeenLastCalledWith("page_view", { route: "/orders/42" });
    expect(trackUiEvent).toHaveBeenCalledTimes(2);
  });
});
